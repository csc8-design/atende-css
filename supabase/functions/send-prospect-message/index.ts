import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

  try {
    const { leadId, message } = await req.json();
    if (!leadId || !message) return json({ error: "leadId and message required" }, 400);

    // Fetch lead via RLS
    const { data: lead, error: leadErr } = await supabase
      .from("prospect_leads")
      .select("id, company_name, contact_name, phone")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) return json({ error: "Lead not found or access denied" }, 404);

    // ---- Evolution API config (somente para prospecção) ----
    const evoUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const evoInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    if (!evoUrlRaw || !evoKey || !evoInstance) {
      return json({ error: "Evolution API não configurada (EVOLUTION_API_URL/KEY/INSTANCE_NAME)" }, 500);
    }
    // Sanitiza: aceita URL com `/manager/...` colado e reduz para o origin
    let evoUrl = evoUrlRaw.replace(/\/+$/, "");
    try {
      const u = new URL(evoUrl);
      evoUrl = `${u.protocol}//${u.host}`;
    } catch {
      // mantém como está se não for URL válida
    }

    // Normalize phone to E.164 BR
    let phone = (lead.phone || "").replace(/\D/g, "");
    if (phone.startsWith("55") && phone.length > 11) phone = phone.slice(2);
    if (phone.length === 10) phone = phone.slice(0, 2) + "9" + phone.slice(2); // adiciona 9 do celular
    phone = "55" + phone;

    const extractFirstName = (...values: Array<string | null | undefined>): string => {
      for (const value of values) {
        const normalized = (value || "").trim();
        if (!normalized) continue;
        if (/^\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,4})?$/.test(normalized)) continue;
        if (/^[\d\s\/\-.()+]+$/.test(normalized)) continue;

        const first = normalized
          .split(/\s+/)
          .map((part) => part.replace(/[^\p{L}\p{M}'-]/gu, ""))
          .find((part) => part && !/^\d/.test(part));

        if (first) {
          return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
        }
      }

      return "Cliente";
    };
    const firstName = extractFirstName(lead.contact_name, lead.company_name);

    // Substitui placeholders
    const finalMessage = String(message)
      .replace(/\{empresa\}/gi, lead.company_name || "")
      .replace(/\{contato\}/gi, firstName);

    // ---- Envia via Evolution API: POST /message/sendText/{instance} ----
    const evoPayload = {
      number: phone,
      text: finalMessage,
    };

    const evo = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
      method: "POST",
      headers: {
        apikey: evoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evoPayload),
    });

    const evoData = await evo.json().catch(() => ({}));

    if (!evo.ok) {
      const rawMsg = evoData?.response?.message || evoData?.message || JSON.stringify(evoData);
      let userMsg = `Evolution API erro (${evo.status}): ${rawMsg}`;

      if (evo.status === 401 || evo.status === 403) userMsg = "Evolution API: chave inválida ou sem permissão.";
      if (evo.status === 404) userMsg = `Evolution API: instância "${evoInstance}" não encontrada.`;
      if (typeof rawMsg === "string" && /not.*registered|not.*exist|not.*on.*whatsapp/i.test(rawMsg)) {
        userMsg = `Número ${phone} não está no WhatsApp.`;
      }

      console.error("Evolution send error:", evo.status, evoData);
      return json({ error: userMsg, status: evo.status, raw: evoData }, 400);
    }

    const evoMsgId =
      evoData?.key?.id ||
      evoData?.messageId ||
      evoData?.id ||
      null;

    // Update lead: mark as sent
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdmin
      .from("prospect_leads")
      .update({ message_sent_at: new Date().toISOString() })
      .eq("id", leadId);

    return json({ success: true, messageId: evoMsgId, sentTo: phone, mode: "evolution" });
  } catch (err: any) {
    console.error("send-prospect-message error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

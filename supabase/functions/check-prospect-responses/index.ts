import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhoneBR(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (p.startsWith("55") && p.length > 11) p = p.slice(2);
  if (p.length === 10) p = p.slice(0, 2) + "9" + p.slice(2);
  return "55" + p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const leadIds: string[] | undefined = body?.leadIds;

    // Evolution API config
    const evoUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const evoInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    if (!evoUrlRaw || !evoKey || !evoInstance) {
      return json({ error: "Evolution API não configurada" }, 500);
    }
    let evoUrl = evoUrlRaw.replace(/\/+$/, "");
    try {
      const u = new URL(evoUrl);
      evoUrl = `${u.protocol}//${u.host}`;
    } catch { /* keep as-is */ }

    // Fetch leads (only ones already dispatched via prospecting)
    let query = supabase
      .from("prospect_leads")
      .select("id, phone, message_sent_at, last_interaction_at, interaction_status")
      .not("message_sent_at", "is", null);
    if (leadIds && leadIds.length > 0) query = query.in("id", leadIds);

    const { data: leads, error: leadsErr } = await query;
    if (leadsErr) return json({ error: leadsErr.message }, 500);
    if (!leads || leads.length === 0) return json({ checked: 0, updated: 0, results: [] });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let updated = 0;
    const results: any[] = [];

    const buildBodies = (remoteJid: string) => [
      { where: { key: { remoteJid } }, page: 1, offset: 50 },
      { where: { remoteJid }, page: 1, offset: 50 },
      { where: { key: { remoteJid } } },
      { jid: remoteJid, limit: 50 },
      { remoteJid, limit: 50 },
    ];

    for (const lead of leads) {
      const phone = normalizePhoneBR(lead.phone);
      const remoteJid = `${phone}@s.whatsapp.net`;
      try {
        let evo: Response | null = null;
        let lastErrBody = "";
        for (const body of buildBodies(remoteJid)) {
          const resp = await fetch(
            `${evoUrl}/chat/findMessages/${encodeURIComponent(evoInstance)}`,
            {
              method: "POST",
              headers: { apikey: evoKey, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          );
          if (resp.ok) { evo = resp; break; }
          lastErrBody = await resp.text().catch(() => "");
          if (resp.status === 400 || resp.status === 422) continue;
          evo = resp;
          break;
        }

        if (!evo || !evo.ok) {
          const status = evo?.status ?? 0;
          console.error(`Evolution findMessages falhou (${status}) p/ ${remoteJid}: ${lastErrBody.slice(0, 300)}`);
          results.push({ id: lead.id, error: `Evolution (${status}): ${lastErrBody.slice(0, 200)}` });
          continue;
        }

        const data = await evo.json();
        // Evolution can return either an array directly or { messages: { records: [...] } }
        const records: any[] = Array.isArray(data)
          ? data
          : data?.messages?.records || data?.records || [];

        const sentAtMs = lead.message_sent_at ? new Date(lead.message_sent_at).getTime() : 0;

        // Find latest inbound message (fromMe=false) AFTER our dispatch
        let latestInboundMs = 0;
        for (const m of records) {
          const fromMe = m?.key?.fromMe ?? false;
          if (fromMe) continue;
          const tsRaw = m?.messageTimestamp ?? m?.message_timestamp ?? 0;
          // Evolution returns seconds (epoch)
          const tsMs = typeof tsRaw === "number"
            ? (tsRaw < 1e12 ? tsRaw * 1000 : tsRaw)
            : (typeof tsRaw === "string" ? new Date(tsRaw).getTime() : 0);
          if (tsMs > latestInboundMs) latestInboundMs = tsMs;
        }

        if (latestInboundMs > 0 && latestInboundMs >= sentAtMs) {
          const lastIso = new Date(latestInboundMs).toISOString();
          await admin
            .from("prospect_leads")
            .update({
              last_interaction_at: lastIso,
              interaction_status: "sim",
            })
            .eq("id", lead.id);
          updated++;
          results.push({ id: lead.id, replied: true, last_interaction_at: lastIso });
        } else {
          results.push({ id: lead.id, replied: false });
        }
      } catch (err: any) {
        results.push({ id: lead.id, error: err.message });
      }
    }

    return json({ checked: leads.length, updated, results });
  } catch (err: any) {
    console.error("check-prospect-responses error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});

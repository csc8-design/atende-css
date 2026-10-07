import { getMetaCreds } from "../_shared/meta-creds.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHATSAPP_API = "https://graph.facebook.com/v23.0";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("55") && p.length > 11) p = p.slice(2);
  if (p.length === 10) p = p.slice(0, 2) + "9" + p.slice(2);
  return "55" + p;
}

function firstName(name?: string | null, fallback?: string | null): string {
  for (const v of [name, fallback]) {
    const s = (v || "").trim();
    if (!s) continue;
    if (/^[\d\s\/\-.()+]+$/.test(s)) continue;
    const first = s.split(/\s+/).find((p) => p && !/^\d/.test(p));
    if (first) {
      const clean = first.replace(/[^\p{L}\p{M}'-]/gu, "");
      if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
  }
  return "Cliente";
}

// Preenche as variáveis do corpo do template: {{1}} = primeiro nome,
// {{2}} = cidade, demais = valor genérico. Templates sem variáveis enviam vazio.
function buildTemplateComponents(lead: any, varCount: number, headerMediaUrl?: string | null) {
  const components: any[] = [];
  if (headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerMediaUrl } }],
    });
  }
  if (varCount > 0) {
    const nome = firstName(lead.nome, lead.empresa) || "tudo bem";
    const cidade = (lead.cidade || "").trim() || "sua região";
    const values = [nome, cidade];
    const vars = Array.from({ length: varCount }, (_, i) => values[i] || "atendimento");
    components.push({
      type: "body",
      parameters: vars.map((v) => ({ type: "text", text: v })),
    });
  }
  return components;
}

async function sendOne(admin: any, token: string, phoneNumberId: string, lead: any, templateName: string, language: string, headerMediaUrl: string | null, varCount: number) {
  const phone = normalizePhone(lead.telefone_normalizado || lead.telefone);
  if (!phone || phone.length < 12) {
    await admin.from("mass_campaign_leads").update({
      status: "failed", error_message: "Telefone inválido", updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return { ok: false, reason: "invalid_phone" };
  }

  const components = buildTemplateComponents(lead, varCount, headerMediaUrl);
  const body: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "pt_BR" },
    },
  };
  if (components.length > 0) body.template.components = components;

  try {
    const res = await fetch(`${WHATSAPP_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    const msgId = data?.messages?.[0]?.id || null;

    if (!res.ok || !msgId) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      const errCode = data?.error?.code || 0;
      await admin.from("mass_campaign_leads").update({
        status: "failed",
        error_message: `Meta ${errCode ? `(${errCode}) ` : ""}${errMsg}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      return { ok: false, reason: errMsg, rateLimited: errCode === 130429 };
    }

    const sentAt = new Date().toISOString();
    await admin.from("mass_campaign_leads").update({
      status: "sent", sent_at: sentAt,
      evolution_message_id: msgId, // reusa coluna existente para armazenar o wamid
      final_message: `[template:${templateName}]`,
      error_message: null, updated_at: sentAt,
    }).eq("id", lead.id);
    return { ok: true };
  } catch (err: any) {
    await admin.from("mass_campaign_leads").update({
      status: "failed", error_message: (err.message || "Erro").slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return { ok: false, reason: err.message };
  }
}

async function refreshCounters(admin: any, campaignId: string) {
  const { data: rows } = await admin.from("mass_campaign_leads").select("status").eq("campaign_id", campaignId);
  const total = rows?.length || 0;
  const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
  const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
  const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
  await admin.from("mass_campaigns").update({
    total_leads: total, sent_count: sent, failed_count: failed, replied_count: replied,
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, campaignId, leadId, maxBatch } = await req.json();
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const { data: campaign, error: cErr } = await admin
      .from("mass_campaigns").select("*").eq("id", campaignId).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.channel !== "meta_template") return json({ error: "Campaign channel is not meta_template" }, 400);
    if (!campaign.meta_template_name) return json({ error: "meta_template_name is required" }, 400);
    if (action === "pause") {
      await admin.from("mass_campaigns").update({ status: "paused" }).eq("id", campaignId);
      return json({ ok: true });
    }
    if (action === "cancel") {
      await admin.from("mass_campaigns").update({ status: "cancelled" }).eq("id", campaignId);
      return json({ ok: true });
    }

    const creds = await getMetaCreds();
    const token = creds.token!;
    const phoneNumberId = creds.phoneNumberId!;
    if (!token || !phoneNumberId) return json({ error: "WhatsApp API não configurada" }, 500);

    const templateName = campaign.meta_template_name;
    const language = campaign.meta_template_language || "pt_BR";

    // Descobre quantas variáveis o template aprovado usa (consulta à Meta).
    let templateVarCount = 0;
    try {
      const tplRes = await fetch(
        `https://graph.facebook.com/v23.0/${creds.businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,language,components&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tplJson = await tplRes.json().catch(() => ({}));
      const found = (tplJson?.data || []).find(
        (t: any) => t.name === templateName && (t.language || "").toLowerCase() === (language || "pt_BR").toLowerCase()
      );
      const bodyText = (found?.components || []).find((c: any) => c.type === "BODY")?.text || "";
      templateVarCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
    } catch (e) {
      console.error("Failed to fetch template definition:", e);
    }
    // The whatsapp-media bucket is private: Meta can't download a "public" URL from it.
    // Convert it into a signed URL (valid 7 days) so Meta can fetch the header image.
    let headerMediaUrl: string | null = campaign.meta_header_media_url || null;
    if (headerMediaUrl) {
      const m = headerMediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
      if (m) {
        const { data: signed, error: sErr } = await admin.storage
          .from(m[1]).createSignedUrl(decodeURIComponent(m[2]), 60 * 60 * 24 * 7);
        if (sErr || !signed?.signedUrl) {
          console.error("Failed to sign header media:", sErr);
          return json({ error: "Não foi possível gerar o link da imagem do cabeçalho" }, 500);
        }
        headerMediaUrl = signed.signedUrl;
      }
    }

    if (action === "send_one") {
      if (!leadId) return json({ error: "leadId required" }, 400);
      const { data: lead } = await admin.from("mass_campaign_leads").select("*").eq("id", leadId).single();
      if (!lead) return json({ error: "Lead not found" }, 404);
      const r = await sendOne(admin, token, phoneNumberId, lead, templateName, language, headerMediaUrl, templateVarCount);
      await refreshCounters(admin, campaignId);
      return json(r);
    }

    if (action === "send_batch" || action === "retry_failed") {
      if (action === "retry_failed") {
        await admin.from("mass_campaign_leads")
          .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
          .eq("campaign_id", campaignId).eq("status", "failed");
      }

      await admin.from("mass_campaigns").update({
        status: "sending",
        started_at: campaign.started_at || new Date().toISOString(),
      }).eq("id", campaignId);

      const limit = Math.min(maxBatch || 500, 1000);
      const { data: leads } = await admin.from("mass_campaign_leads").select("*")
        .eq("campaign_id", campaignId).eq("status", "pending").limit(limit);

      const throttle = Math.max(campaign.throttle_ms || 1500, 500);
      let sent = 0, failed = 0, rateLimited = false;

      for (const lead of leads || []) {
        const { data: cur } = await admin.from("mass_campaigns").select("status").eq("id", campaignId).single();
        if (cur?.status === "paused" || cur?.status === "cancelled") break;

        const r = await sendOne(admin, token, phoneNumberId, lead, templateName, language, headerMediaUrl, templateVarCount);
        if (r.ok) sent++; else failed++;
        if ((r as any).rateLimited) {
          rateLimited = true;
          await admin.from("mass_campaigns").update({ status: "paused" }).eq("id", campaignId);
          break;
        }
        await new Promise((res) => setTimeout(res, throttle));
      }

      const { count: pendingLeft } = await admin.from("mass_campaign_leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId).eq("status", "pending");

      if (!rateLimited) {
        const finalStatus = pendingLeft === 0 ? "completed" : "paused";
        await admin.from("mass_campaigns").update({
          status: finalStatus,
          completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
        }).eq("id", campaignId);
      }

      await refreshCounters(admin, campaignId);
      return json({ ok: true, sent, failed, pendingLeft, rateLimited });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("send-meta-mass-campaign error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});

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

function renderMessage(tpl: string, lead: any): string {
  const nome = firstName(lead.nome, lead.empresa);
  const empresa = (lead.empresa || lead.nome || "sua empresa").toString().trim();
  const modelo = (lead.modelo || "").toString().trim();
  const cidade = (lead.cidade || "").toString().trim();
  return (tpl || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, nome)
    .replace(/\{\{\s*empresa\s*\}\}/gi, empresa)
    .replace(/\{\{\s*modelo\s*\}\}/gi, modelo)
    .replace(/\{\{\s*cidade\s*\}\}/gi, cidade);
}

async function sendOneLead(supabaseAdmin: any, evoUrl: string, evoKey: string, evoInstance: string, lead: any, template: string, media?: { url: string; type: string; mime?: string | null }) {
  const phone = normalizePhone(lead.telefone_normalizado || lead.telefone);
  if (!phone || phone.length < 12) {
    await supabaseAdmin.from("mass_campaign_leads").update({
      status: "failed",
      error_message: "Telefone inválido",
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return { ok: false, reason: "invalid_phone" };
  }

  const finalMessage = renderMessage(template, lead);
  const hasMedia = !!(media && media.url);

  try {
    // Humanização: presença "digitando" por 5-12s (aleatório). Períodos maiores estouram o timeout HTTP.
    const TYPING_MS = 5000 + Math.floor(Math.random() * 7000);
    try {
      await fetch(`${evoUrl}/chat/sendPresence/${encodeURIComponent(evoInstance)}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, presence: "composing", delay: TYPING_MS }),
      });
    } catch (e) { console.error("sendPresence failed", e); }
    await new Promise((res) => setTimeout(res, TYPING_MS));

    let evo: Response;
    if (hasMedia) {
      // Evolution sendMedia: image | video | document | audio
      const mt = (media!.type || "image").toLowerCase();
      const fileName = media!.url.split("/").pop()?.split("?")[0] || `arquivo.${mt === "image" ? "jpg" : "bin"}`;
      evo = await fetch(`${evoUrl}/message/sendMedia/${encodeURIComponent(evoInstance)}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: phone,
          mediatype: mt,
          mimetype: media!.mime || (mt === "image" ? "image/jpeg" : undefined),
          caption: finalMessage,
          media: media!.url,
          fileName,
        }),
      });
    } else {
      evo = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, text: finalMessage }),
      });
    }
    const data = await evo.json().catch(() => ({}));

    const msgId = data?.key?.id || data?.messageId || data?.id || null;
    const waStatus = (data?.status || data?.key?.status || "").toString().toUpperCase();
    const failedStatus = waStatus === "ERROR" || waStatus === "FAILED";

    if (!evo.ok || !msgId || failedStatus) {
      const raw = data?.response?.message || data?.message || JSON.stringify(data);
      let msg = !evo.ok
        ? `Evolution (${evo.status}): ${typeof raw === "string" ? raw : JSON.stringify(raw)}`
        : !msgId
          ? `Evolution não retornou messageId — instância provavelmente desconectada`
          : `Evolution status ${waStatus}`;
      if (typeof raw === "string" && /not.*registered|not.*exist|not.*on.*whatsapp/i.test(raw)) {
        msg = `Número ${phone} não está no WhatsApp`;
      }
      await supabaseAdmin.from("mass_campaign_leads").update({
        status: "failed",
        error_message: msg.slice(0, 500),
        final_message: finalMessage,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      return { ok: false, reason: msg };
    }

    // msgId já calculado acima
    const sentAtIso = new Date().toISOString();
    await supabaseAdmin.from("mass_campaign_leads").update({
      status: "sent",
      sent_at: sentAtIso,
      evolution_message_id: msgId,
      final_message: finalMessage,
      error_message: null,
      updated_at: sentAtIso,
    }).eq("id", lead.id);

    // Espelha envio na Qualificação IA (apenas leitura — sem expor histórico privado)
    try {
      await upsertQualOutbound(supabaseAdmin, {
        phone,
        contactName: firstName(lead.nome, lead.empresa),
        text: finalMessage,
        mediaUrl: hasMedia ? media!.url : null,
        mediaType: hasMedia ? (media!.type || null) : null,
        evolutionMessageId: msgId,
        sentAt: sentAtIso,
        evolutionInstance: evoInstance,
      });
    } catch (e) { console.error("qual mirror failed", e); }

    return { ok: true };
  } catch (err: any) {
    await supabaseAdmin.from("mass_campaign_leads").update({
      status: "failed",
      error_message: (err.message || "Erro inesperado").slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return { ok: false, reason: err.message };
  }
}

async function upsertQualOutbound(admin: any, p: {
  phone: string; contactName: string; text: string;
  mediaUrl: string | null; mediaType: string | null;
  evolutionMessageId: string | null; sentAt: string;
  evolutionInstance: string;
}) {
  const preview = (p.text || `[${p.mediaType || "mídia"}]`).slice(0, 120);
  const { data: existing } = await admin
    .from("qual_conversations")
    .select("id")
    .eq("phone", p.phone)
    .maybeSingle();

  let convId: string;
  if (existing) {
    convId = existing.id;
    await admin.from("qual_conversations").update({
      last_message_preview: preview,
      last_message_at: p.sentAt,
      evolution_instance: p.evolutionInstance,
      unread_count: 0,
    }).eq("id", convId);
  } else {
    const { data: ins, error: insErr } = await admin
      .from("qual_conversations")
      .insert({
        phone: p.phone,
        contact_name: p.contactName || p.phone,
        last_message_preview: preview,
        last_message_at: p.sentAt,
        evolution_instance: p.evolutionInstance,
        unread_count: 0,
      })
      .select("id").single();
    if (insErr) throw insErr;
    convId = ins.id;
  }

  if (p.evolutionMessageId) {
    const { data: dup } = await admin
      .from("qual_messages").select("id")
      .eq("evolution_message_id", p.evolutionMessageId).maybeSingle();
    if (dup) return convId;
  }

  await admin.from("qual_messages").insert({
    conversation_id: convId,
    direction: "outbound",
    content: p.text || null,
    media_url: p.mediaUrl,
    media_type: p.mediaType,
    evolution_message_id: p.evolutionMessageId,
    sender_name: "Campanha",
    sent_at: p.sentAt,
    metadata: { source: "mass_campaign" },
  });

  await admin
    .from("qual_lead_qualification")
    .upsert({ conversation_id: convId }, { onConflict: "conversation_id", ignoreDuplicates: true });

  return convId;
}


async function refreshCounters(supabaseAdmin: any, campaignId: string) {
  const { data: rows } = await supabaseAdmin
    .from("mass_campaign_leads")
    .select("status")
    .eq("campaign_id", campaignId);
  const total = rows?.length || 0;
  const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
  const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
  const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
  await supabaseAdmin.from("mass_campaigns").update({
    total_leads: total,
    sent_count: sent,
    failed_count: failed,
    replied_count: replied,
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, campaignId, leadId, maxBatch } = await req.json();
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("mass_campaigns").select("*").eq("id", campaignId).single();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    if (action === "pause") {
      await supabaseAdmin.from("mass_campaigns").update({ status: "paused" }).eq("id", campaignId);
      return json({ ok: true });
    }
    if (action === "cancel") {
      await supabaseAdmin.from("mass_campaigns").update({ status: "cancelled" }).eq("id", campaignId);
      return json({ ok: true });
    }


    if (action === "instance_status") {
      const evoUrlRaw0 = Deno.env.get("EVOLUTION_API_URL");
      const evoKey0 = Deno.env.get("EVOLUTION_API_KEY");
      if (!evoUrlRaw0 || !evoKey0) return json({ ok: false, state: "unknown", error: "Evolution não configurada" });
      let u0 = evoUrlRaw0.replace(/\/+$/, "");
      try { const uu = new URL(u0); u0 = `${uu.protocol}//${uu.host}`; } catch {}
      const inst = (campaign.evolution_instance || "COMERCIAL_THEO").trim();
      try {
        const r = await fetch(`${u0}/instance/connectionState/${encodeURIComponent(inst)}`, {
          headers: { apikey: evoKey0 },
        });
        const d = await r.json().catch(() => ({}));
        const state = d?.instance?.state || d?.state || "unknown";
        return json({ ok: r.ok, state, instance: inst, raw: d });
      } catch (e: any) {
        return json({ ok: false, state: "unknown", instance: inst, error: e.message });
      }
    }

    const evoUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    // Chip Evolution definido por campanha (padrão COMERCIAL_THEO)
    const evoInstance = (campaign.evolution_instance || "COMERCIAL_THEO").trim();
    if (!evoUrlRaw || !evoKey) return json({ error: "Evolution API não configurada" }, 500);
    let evoUrl = evoUrlRaw.replace(/\/+$/, "");
    try { const u = new URL(evoUrl); evoUrl = `${u.protocol}//${u.host}`; } catch {}

    if (!campaign.message_template || !String(campaign.message_template).trim()) {
      return json({ error: "Campanha sem mensagem (message_template vazio). Edite a campanha e defina a mensagem antes de disparar." }, 400);
    }

    const media = campaign.media_url
      ? { url: campaign.media_url, type: campaign.media_type || "image", mime: campaign.media_mime }
      : undefined;

    // Checa estado da instância antes de qualquer envio real
    async function ensureInstanceOpen(): Promise<{ ok: boolean; state: string; error?: string }> {
      try {
        const r = await fetch(`${evoUrl}/instance/connectionState/${encodeURIComponent(evoInstance)}`, {
          headers: { apikey: evoKey },
        });
        const d = await r.json().catch(() => ({}));
        const state = (d?.instance?.state || d?.state || "unknown").toString();
        if (state !== "open") {
          return { ok: false, state, error: `Instância ${evoInstance} não está conectada (estado: ${state}). Abra o Evolution Manager e reconecte o chip antes de disparar.` };
        }
        return { ok: true, state };
      } catch (e: any) {
        return { ok: false, state: "unknown", error: `Falha ao verificar estado da instância: ${e.message}` };
      }
    }

    // Send single lead

    if (action === "send_one") {
      if (!leadId) return json({ error: "leadId required" }, 400);
      const chk = await ensureInstanceOpen();
      if (!chk.ok) return json({ error: chk.error, state: chk.state }, 400);
      const { data: lead } = await supabaseAdmin
        .from("mass_campaign_leads").select("*").eq("id", leadId).single();
      if (!lead) return json({ error: "Lead not found" }, 404);
      const result = await sendOneLead(supabaseAdmin, evoUrl, evoKey, evoInstance, lead, campaign.message_template, media);
      await refreshCounters(supabaseAdmin, campaignId);
      return json(result);
    }

    // Send batch (all pending) or retry all failed
    if (action === "send_batch" || action === "retry_failed") {
      const chk = await ensureInstanceOpen();
      if (!chk.ok) return json({ error: chk.error, state: chk.state }, 400);


      if (action === "retry_failed") {
        await supabaseAdmin
          .from("mass_campaign_leads")
          .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
          .eq("campaign_id", campaignId)
          .eq("status", "failed");
      }

      await supabaseAdmin.from("mass_campaigns").update({
        status: "sending",
        started_at: campaign.started_at || new Date().toISOString(),
      }).eq("id", campaignId);

      const limit = Math.min(maxBatch || 500, 1000);
      const { data: leads } = await supabaseAdmin
        .from("mass_campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .limit(limit);

      const throttle = Math.max(campaign.throttle_ms || 1500, 500);
      let sent = 0, failed = 0;

      for (const lead of leads || []) {
        // check pause
        const { data: cur } = await supabaseAdmin
          .from("mass_campaigns").select("status").eq("id", campaignId).single();
        if (cur?.status === "paused" || cur?.status === "cancelled") break;

        const r = await sendOneLead(supabaseAdmin, evoUrl, evoKey, evoInstance, lead, campaign.message_template, media);
        if (r.ok) sent++; else failed++;
        await new Promise((res) => setTimeout(res, throttle));
      }


      // Check if anything remains pending
      const { count: pendingLeft } = await supabaseAdmin
        .from("mass_campaign_leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      const finalStatus = pendingLeft === 0 ? "completed" : "paused";
      await supabaseAdmin.from("mass_campaigns").update({
        status: finalStatus,
        completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
      }).eq("id", campaignId);

      await refreshCounters(supabaseAdmin, campaignId);
      return json({ ok: true, sent, failed, pendingLeft });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("send-mass-campaign error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});

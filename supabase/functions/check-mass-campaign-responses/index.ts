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

function digitsOnly(raw: string | null | undefined): string {
  return String(raw || "").replace(/\D/g, "");
}

function phoneVariants(raw: string | null | undefined): string[] {
  const digits = digitsOnly(raw);
  if (!digits) return [];

  const set = new Set<string>([digits]);
  if (digits.startsWith("55")) set.add(digits.slice(2));
  else set.add(`55${digits}`);

  if (digits.length >= 11) {
    const last11 = digits.slice(-11);
    set.add(last11);
    set.add(`55${last11}`);
  }
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    set.add(last10);
    set.add(`55${last10}`);
  }

  for (const v of Array.from(set)) {
    // BR mobile with 9th digit: 55 + DDD + 9 + number
    if (v.length === 13 && v.startsWith("55") && v[4] === "9") set.add(v.slice(0, 4) + v.slice(5));
    if (v.length === 11 && v[2] === "9") set.add(v.slice(0, 2) + v.slice(3));
    // BR mobile without 9th digit: add it after DDD
    if (v.length === 12 && v.startsWith("55")) set.add(v.slice(0, 4) + "9" + v.slice(4));
    if (v.length === 10) set.add(v.slice(0, 2) + "9" + v.slice(2));
  }

  return Array.from(set).filter((v) => v.length >= 10);
}

function preferredPhones(raw: string | null | undefined): string[] {
  return phoneVariants(raw)
    .filter((v) => v.startsWith("55") && v.length >= 12)
    .sort((a, b) => b.length - a.length);
}

function parseMessageTimestamp(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === "string") {
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      return n < 1e12 ? n * 1000 : n;
    }
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function extractEvolutionRecords(data: any): any[] {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.messages?.records,
    data?.messages,
    data?.records,
    data?.data?.records,
    data?.data?.messages,
    data?.data,
    data?.result?.records,
    data?.result,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function buildFindMessageBodies(remoteJid: string) {
  return [
    { where: { key: { remoteJid } }, page: 1, offset: 100, limit: 100 },
    { where: { remoteJid }, page: 1, offset: 100, limit: 100 },
    { where: { key: { remoteJid } }, limit: 100 },
    { jid: remoteJid, limit: 100 },
    { remoteJid, limit: 100 },
  ];
}

async function fetchAllCampaignLeads(admin: any, campaignId: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("mass_campaign_leads")
      .select("id, campaign_id, nome, empresa, telefone, telefone_normalizado, sent_at, replied_at, status")
      .eq("campaign_id", campaignId)
      .in("status", ["sent", "replied"])
      .not("sent_at", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function findLocalInboundReplies(admin: any, leads: any[]) {
  const byVariant = new Map<string, any[]>();
  if (leads.length === 0) return byVariant;

  const allVariants = new Set<string>();
  let earliestMs = Date.now();
  for (const lead of leads) {
    for (const v of phoneVariants(lead.telefone_normalizado || lead.telefone)) allVariants.add(v);
    const t = new Date(lead.sent_at).getTime();
    if (Number.isFinite(t) && t < earliestMs) earliestMs = t;
  }

  const variants = Array.from(allVariants);
  const conversations: any[] = [];
  for (let i = 0; i < variants.length; i += 100) {
    const chunk = variants.slice(i, i + 100);
    const { data } = await admin
      .from("qual_conversations")
      .select("id, phone")
      .in("phone", chunk);
    conversations.push(...(data || []));
  }

  if (conversations.length === 0) return byVariant;

  const convIds = conversations.map((c) => c.id);
  const phoneByConv = new Map(conversations.map((c) => [c.id, c.phone]));
  const since = new Date(Math.max(0, earliestMs - 60_000)).toISOString();
  const messages: any[] = [];

  for (let i = 0; i < convIds.length; i += 100) {
    const chunk = convIds.slice(i, i + 100);
    const { data } = await admin
      .from("qual_messages")
      .select("conversation_id, sent_at, content, media_type")
      .in("conversation_id", chunk)
      .eq("direction", "inbound")
      .gte("sent_at", since)
      .order("sent_at", { ascending: true })
      .limit(10000);
    messages.push(...(data || []));
  }

  for (const msg of messages) {
    const phone = phoneByConv.get(msg.conversation_id);
    if (!phone) continue;
    for (const v of phoneVariants(phone)) {
      const list = byVariant.get(v) || [];
      list.push(msg);
      byVariant.set(v, list);
    }
  }

  return byVariant;
}

function findLocalReplyForLead(lead: any, inboundByVariant: Map<string, any[]>) {
  const sentMs = new Date(lead.sent_at).getTime();
  if (!Number.isFinite(sentMs)) return null;

  let best: any | null = null;
  for (const v of phoneVariants(lead.telefone_normalizado || lead.telefone)) {
    const messages = inboundByVariant.get(v) || [];
    for (const msg of messages) {
      const msgMs = new Date(msg.sent_at).getTime();
      if (Number.isFinite(msgMs) && msgMs >= sentMs && (!best || msgMs < new Date(best.sent_at).getTime())) {
        best = msg;
      }
    }
  }
  return best;
}

async function findEvolutionReply(evoUrl: string, evoKey: string, evoInstance: string, lead: any) {
  const sentAtMs = new Date(lead.sent_at).getTime();
  if (!Number.isFinite(sentAtMs)) return null;

  for (const phone of preferredPhones(lead.telefone_normalizado || lead.telefone)) {
    const remoteJid = `${phone}@s.whatsapp.net`;
    let lastErrBody = "";
    for (const body of buildFindMessageBodies(remoteJid)) {
      const resp = await fetch(`${evoUrl}/chat/findMessages/${encodeURIComponent(evoInstance)}`, {
        method: "POST",
        headers: { apikey: evoKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        lastErrBody = await resp.text().catch(() => "");
        if (resp.status === 400 || resp.status === 422) continue;
        console.error(`Evolution findMessages falhou (${resp.status}) p/ ${remoteJid}: ${lastErrBody.slice(0, 300)}`);
        break;
      }

      const records = extractEvolutionRecords(await resp.json().catch(() => ({})));
      let bestMs = 0;
      for (const m of records) {
        const fromMe = m?.key?.fromMe ?? m?.fromMe ?? false;
        if (fromMe) continue;
        const tsMs = parseMessageTimestamp(m?.messageTimestamp ?? m?.message_timestamp ?? m?.timestamp ?? m?.createdAt ?? m?.created_at);
        if (tsMs >= sentAtMs && (bestMs === 0 || tsMs < bestMs)) bestMs = tsMs;
      }
      if (bestMs > 0) return new Date(bestMs).toISOString();
      break;
    }
  }

  return null;
}

async function refreshCounters(admin: any, campaignId: string) {
  const { data: rows } = await admin
    .from("mass_campaign_leads")
    .select("status")
    .eq("campaign_id", campaignId);
  const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
  const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
  const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
  await admin.from("mass_campaigns").update({
    sent_count: sent,
    replied_count: replied,
    failed_count: failed,
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);

  return { sent, replied, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const headerKey = req.headers.get("apikey") || req.headers.get("x-api-key");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!anonKey || !serviceRoleKey || !supabaseUrl) return json({ error: "Supabase não configurado" }, 500);

  const supabase = createClient(
    supabaseUrl,
    anonKey,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );

  const isTrustedKey = token === serviceRoleKey || token === anonKey || headerKey === anonKey || headerKey === serviceRoleKey;
  if (!isTrustedKey) {
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { campaignId } = await req.json().catch(() => ({}));

    const evoUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evoUrlRaw || !evoKey) return json({ error: "Evolution API não configurada" }, 500);
    let evoUrl = evoUrlRaw.replace(/\/+$/, "");
    try { const u = new URL(evoUrl); evoUrl = `${u.protocol}//${u.host}`; } catch {}

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Se não veio campaignId, processa todas as campanhas evolution ativas (uso via cron)
    let campaigns: any[] = [];
    if (campaignId) {
      const { data } = await admin
        .from("mass_campaigns")
        .select("id, name, evolution_instance, channel")
        .eq("id", campaignId)
        .maybeSingle();
      campaigns = data ? [data] : [];
    } else {
      const { data: camps } = await admin
        .from("mass_campaigns")
        .select("id, name, evolution_instance, channel")
        .eq("channel", "evolution")
        .gt("sent_count", 0);
      campaigns = camps || [];
    }

    let grandChecked = 0;
    let grandNewReplies = 0;
    let grandTotalReplied = 0;
    const details: any[] = [];

    for (const campaign of campaigns) {
      const cid = campaign.id;
      const evoInstance = (campaign.evolution_instance || "COMERCIAL_THEO").trim();
      const leads = await fetchAllCampaignLeads(admin, cid);
      if (leads.length === 0) {
        details.push({ campaign_id: cid, campaign_name: campaign.name, checked: 0, new_replies: 0, total_replied: 0 });
        continue;
      }

      const inboundByVariant = await findLocalInboundReplies(admin, leads);
      let newReplies = 0;
      const repliedLeads: any[] = [];

      for (const lead of leads) {
        try {
          let repliedAt: string | null = null;
          const localReply = findLocalReplyForLead(lead, inboundByVariant);
          if (localReply?.sent_at) repliedAt = localReply.sent_at;

          if (!repliedAt && lead.status !== "replied") {
            repliedAt = await findEvolutionReply(evoUrl, evoKey, evoInstance, lead);
          }

          if (repliedAt) {
            if (lead.status !== "replied" || !lead.replied_at) {
              await admin
                .from("mass_campaign_leads")
                .update({ status: "replied", replied_at: repliedAt, updated_at: new Date().toISOString() })
                .eq("id", lead.id);
              if (lead.status !== "replied") newReplies++;
            }
            repliedLeads.push({
              id: lead.id,
              nome: lead.nome || lead.empresa || "Lead",
              telefone: lead.telefone_normalizado || lead.telefone,
              replied_at: repliedAt,
              source: localReply ? "qual/evolution-webhook" : "evolution-api",
            });
          }
        } catch (err: any) {
          console.error("reply check lead error", lead.id, err?.message || err);
        }
      }

      const counters = await refreshCounters(admin, cid);
      grandChecked += leads.length;
      grandNewReplies += newReplies;
      grandTotalReplied += counters.replied;
      details.push({
        campaign_id: cid,
        campaign_name: campaign.name,
        instance: evoInstance,
        checked: leads.length,
        new_replies: newReplies,
        total_replied: counters.replied,
        replied_leads: repliedLeads,
      });
    }

    return json({ checked: grandChecked, replied: grandNewReplies, total_replied: grandTotalReplied, campaigns: campaigns.length, details });
  } catch (err: any) {
    console.error("check-mass-campaign-responses error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});


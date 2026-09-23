// Webhook público para Evolution API (APIATENDE)
// Recebe eventos de mensagem e grava no módulo de Qualificação Inteligente.
// Configure este endpoint no painel da Evolution apontando para:
// https://rivfqexositrxqtwmmpi.supabase.co/functions/v1/qual-webhook
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-api-key",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type ParsedMessage = {
  id: string | null;
  fromMe: boolean;
  phone: string;
  pushName: string | null;
  text: string;
  media: { url: string | null; type: string | null };
  sentAt: string;
  instance: string | null;
  raw: unknown;
};

function normalizePhone(value: string | null | undefined): string {
  return (value || "").split("@")[0].replace(/\D/g, "");
}

function extractText(message: any): string {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.text?.body ||
    message.button?.text ||
    message.interactive?.button_reply?.title ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.image?.caption ||
    message.video?.caption ||
    message.document?.caption ||
    ""
  );
}

function extractMedia(message: any): { url: string | null; type: string | null } {
  if (!message) return { url: null, type: null };
  if (message.imageMessage || message.image) return { url: message.imageMessage?.url || message.image?.link || null, type: "image" };
  if (message.audioMessage || message.audio) return { url: message.audioMessage?.url || message.audio?.link || null, type: "audio" };
  if (message.videoMessage || message.video) return { url: message.videoMessage?.url || message.video?.link || null, type: "video" };
  if (message.documentMessage || message.document) return { url: message.documentMessage?.url || message.document?.link || null, type: "document" };
  return { url: null, type: null };
}

function parseTimestamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "number") return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseEvolutionItem(item: any, body: any): ParsedMessage | null {
  const key = item?.key || {};
  const remoteJid = key.remoteJid || item?.remoteJid || item?.chatId || item?.jid || item?.from || item?.sender;
  if (!remoteJid || String(remoteJid).includes("@g.us")) return null;

  const phone = normalizePhone(remoteJid);
  if (!phone) return null;

  const message = item?.message || item?.messages?.[0]?.message || item;
  const text = extractText(message);
  const media = extractMedia(message);
  if (!text && !media.url && !media.type) return null;

  return {
    id: key.id || item?.id || item?.messageId || null,
    fromMe: Boolean(key.fromMe ?? item?.fromMe ?? false),
    phone,
    pushName: item?.pushName || item?.notifyName || item?.senderName || item?.contact?.name || null,
    text,
    media,
    sentAt: parseTimestamp(item?.messageTimestamp || item?.timestamp || item?.date_time),
    instance: body?.instance || item?.instance || null,
    raw: body,
  };
}

function parseMetaPayload(body: any): ParsedMessage[] {
  const parsed: ParsedMessage[] = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const contactByPhone = new Map<string, string>();
      for (const contact of value.contacts || []) {
        contactByPhone.set(contact.wa_id, contact.profile?.name || contact.wa_id);
      }
      for (const msg of value.messages || []) {
        const phone = normalizePhone(msg.from);
        if (!phone) continue;
        parsed.push({
          id: msg.id || null,
          fromMe: false,
          phone,
          pushName: contactByPhone.get(msg.from) || null,
          text: extractText(msg),
          media: extractMedia(msg),
          sentAt: parseTimestamp(msg.timestamp),
          instance: value.metadata?.phone_number_id || null,
          raw: body,
        });
      }
    }
  }
  return parsed.filter((msg) => msg.text || msg.media.url || msg.media.type);
}

function parsePayload(body: any): ParsedMessage[] {
  if (body?.entry?.length) return parseMetaPayload(body);

  const event = String(body?.event || body?.type || "").toLowerCase();
  if (event && !event.includes("message")) return [];

  const data = body?.data ?? body;
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : [data];

  return items
    .map((item) => parseEvolutionItem(item, body))
    .filter((item): item is ParsedMessage => Boolean(item));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const messages = parsePayload(body);
    console.log("qual-webhook received", { event: body?.event || body?.type || null, count: messages.length });

    if (messages.length === 0) return json({ ok: true, ignored: "no_supported_messages" });

    const results = [];
    for (const msg of messages) {
      results.push(await saveMessage(msg));
    }

    return json({ ok: true, processed: results.length, conversations: results });
  } catch (err: any) {
    console.error("qual-webhook error:", err);
    return json({ error: err.message }, 500);
  }
});

async function saveMessage(msg: ParsedMessage) {
  const preview = (msg.text || `[${msg.media.type || "mídia"}]`).slice(0, 120);

  // Preserve contact_name across messages — only set from inbound and only if missing/placeholder.
  const { data: existingConv } = await supabase
    .from("qual_conversations")
    .select("id, unread_count, contact_name")
    .eq("phone", msg.phone)
    .maybeSingle();

  let convId: string;
  let prevUnread = 0;

  if (existingConv) {
    convId = existingConv.id;
    prevUnread = existingConv.unread_count || 0;
    const updatePayload: Record<string, unknown> = {
      last_message_preview: preview,
      last_message_at: msg.sentAt,
      evolution_instance: msg.instance,
    };
    if (!msg.fromMe && msg.pushName && (!existingConv.contact_name || existingConv.contact_name === msg.phone)) {
      updatePayload.contact_name = msg.pushName;
    }
    if (msg.fromMe) updatePayload.unread_count = 0;
    await supabase.from("qual_conversations").update(updatePayload).eq("id", convId);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("qual_conversations")
      .insert({
        phone: msg.phone,
        contact_name: (!msg.fromMe && msg.pushName) ? msg.pushName : msg.phone,
        last_message_preview: preview,
        last_message_at: msg.sentAt,
        evolution_instance: msg.instance,
        unread_count: 0,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    convId = inserted.id;
  }

  if (!msg.fromMe) {
    await supabase
      .from("qual_conversations")
      .update({ unread_count: prevUnread + 1 })
      .eq("id", convId);

    // Parear resposta com leads de campanha em massa (Evolution APIATENDE)
    try { await markMassCampaignReply(msg.phone, msg.sentAt); } catch (e) { console.error("mass reply pairing", e); }
  }

  const conv = { id: convId };

  const messagePayload = {
    conversation_id: conv.id,
    direction: msg.fromMe ? "outbound" : "inbound",
    content: msg.text || null,
    media_url: msg.media.url,
    media_type: msg.media.type,
    evolution_message_id: msg.id,
    sender_name: msg.pushName,
    sent_at: msg.sentAt,
    metadata: { raw: msg.raw },
  };

  if (msg.id) {
    const { data: existing, error: existingErr } = await supabase
      .from("qual_messages")
      .select("id")
      .eq("evolution_message_id", msg.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return conv.id;
  }

  const { data: insertedMsg, error: msgErr } = await supabase
    .from("qual_messages")
    .insert(messagePayload)
    .select("id")
    .single();
  if (msgErr) throw msgErr;

  const { error: qualErr } = await supabase
    .from("qual_lead_qualification")
    .upsert({ conversation_id: conv.id }, { onConflict: "conversation_id", ignoreDuplicates: true });
  if (qualErr) throw qualErr;

  // Dispara transcrição em background para áudios recebidos do cliente
  if (!msg.fromMe && msg.media.type === "audio" && msg.media.url && insertedMsg?.id) {
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // fire-and-forget
      fetch(`${url}/functions/v1/qual-transcribe-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ messageId: insertedMsg.id }),
      }).catch((e) => console.error("transcribe trigger", e));
    } catch (e) {
      console.error("transcribe dispatch", e);
    }
  }

  return conv.id;
}

async function markMassCampaignReply(phone: string, sentAt: string) {
  // phone vem normalizado (apenas dígitos). Gera variações (com/sem DDI 55 e com/sem 9º dígito).
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return;
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.startsWith("55")) variants.add(digits.slice(2));
  else variants.add("55" + digits);
  // sem 9º dígito (celular BR)
  for (const v of [...variants]) {
    if (v.length === 13 && v.startsWith("55") && v[4] === "9") variants.add(v.slice(0,4)+v.slice(5));
    if (v.length === 11 && v[2] === "9") variants.add(v.slice(0,2)+v.slice(3));
  }

  // Busca lead mais recente "sent" para qualquer variação
  const { data: leads } = await supabase
    .from("mass_campaign_leads")
    .select("id, campaign_id, status, sent_at, telefone_normalizado, telefone")
    .or([...variants].map(v => `telefone_normalizado.eq.${v},telefone.eq.${v}`).join(","))
    .in("status", ["sent"])
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(5);

  if (!leads || leads.length === 0) return;

  const lead = leads[0];
  const sentMs = lead.sent_at ? new Date(lead.sent_at).getTime() : 0;
  const replyMs = new Date(sentAt).getTime();
  if (replyMs < sentMs) return; // resposta antes do envio = ignora

  await supabase.from("mass_campaign_leads").update({
    status: "replied",
    replied_at: sentAt,
    updated_at: new Date().toISOString(),
  }).eq("id", lead.id);

  // Recalcula contadores
  const { data: rows } = await supabase
    .from("mass_campaign_leads")
    .select("status")
    .eq("campaign_id", lead.campaign_id);
  const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
  const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
  const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
  await supabase.from("mass_campaigns").update({
    sent_count: sent,
    replied_count: replied,
    failed_count: failed,
    updated_at: new Date().toISOString(),
  }).eq("id", lead.campaign_id);

  console.log("mass campaign reply paired", { leadId: lead.id, campaignId: lead.campaign_id, replied });
}

function json(d: any, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

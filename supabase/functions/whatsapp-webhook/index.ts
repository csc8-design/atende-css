import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot user ID (created via setup)
const BOT_USER_ID = "326e1876-a385-4502-bb53-c6f52487ca9d";

// Menu flow mapping: option number → department ID (direct routing)
const MENU_INICIAL_ID = "d7481ace-4b58-484b-ad3b-f9f85bfacae7";
const ASSISTENTE_ID = "bbadfe28-5f5d-4500-b488-9a9c73e77886";

// Menu Inicial options → department IDs (direct transfer, no submenus)
const MENU_INICIAL_OPTIONS: Record<string, string> = {
  "1":  "DEPT:11111111-0001-4000-8000-000000000001", // Comercial
  "2":  "DEPT:11111111-0001-4000-8000-000000000002", // Financeiro
  "3":  "DEPT:11111111-0001-4000-8000-000000000003", // Pós-Vendas
  "4":  "DEPT:11111111-0001-4000-8000-000000000004", // Peças Balcão
  "5":  "DEPT:11111111-0001-4000-8000-000000000005", // Loja Online
  "6":  "DEPT:11111111-0001-4000-8000-000000000006", // Importação
  "7":  "DEPT:11111111-0001-4000-8000-000000000007", // Seguros
  "8":  "DEPT:11111111-0001-4000-8000-000000000008", // Consórcios
  "9":  "DEPT:11111111-0001-4000-8000-000000000009", // Consultoria Especializada
  "10": "DEPT:11111111-0001-4000-8000-000000000010", // Governo
  "11": "DEPT:11111111-0001-4000-8000-000000000011", // Telemetria
  "12": "DEPT:11111111-0001-4000-8000-000000000012", // Compras (Fornecedores)
  "13": "DEPT:11111111-0001-4000-8000-000000000013", // RH
};

// Legacy submenus kept as empty maps (no-op safeguards)
// Legacy submenus kept as empty maps (no-op safeguards)
const SUBMENU_PECAS_ID = "__legacy_disabled__";
const SUBMENU_OPTIONS: Record<string, Record<string, string>> = {};
const AGENT_ARENALDO_ID = "";
const AGENT_EDIS_ID = "";
const DEPT_COMERCIAL_PECAS = "";
const DEPT_POS_VENDAS_PECAS = "";


async function getMediaUrl(mediaId: string): Promise<string | null> {
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!WHATSAPP_TOKEN) return null;

  try {
    // Step 1: Get the media URL from WhatsApp API
    const res = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    const data = await res.json();
    console.log("Media metadata:", JSON.stringify(data));

    if (!data.url) return null;

    // Step 2: Download the media binary
    const mediaRes = await fetch(data.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });

    if (!mediaRes.ok) {
      console.error("Failed to download media:", mediaRes.status);
      return null;
    }

    const blob = await mediaRes.blob();
    const mimeType = data.mime_type || "application/octet-stream";
    const ext = mimeType.split("/")[1]?.split(";")[0] || "bin";
    const fileName = `${mediaId}.${ext}`;

    // Step 3: Upload to Supabase Storage using Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient: createStorageClient } = await import("npm:@supabase/supabase-js@2");
    const storageClient = createStorageClient(supabaseUrl, serviceRoleKey);

    const arrayBuffer = await blob.arrayBuffer();
    const fileBody = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await storageClient.storage
      .from("whatsapp-media")
      .upload(fileName, fileBody, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    // Return the public URL
    return `${supabaseUrl}/storage/v1/object/public/whatsapp-media/${fileName}`;
  } catch (err) {
    console.error("getMediaUrl error:", err);
    return null;
  }
}

async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not configured, skipping transcription");
    return null;
  }

  try {
    // Download audio from Supabase Storage
    const audioRes = await fetch(mediaUrl);
    if (!audioRes.ok) {
      console.error("Failed to download audio for transcription:", audioRes.status);
      return null;
    }
    const audioBlob = await audioRes.blob();
    
    // Convert audio to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);
    const mimeType = audioBlob.type || "audio/ogg";

    // Use Lovable AI Gateway with audio input
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes("ogg") ? "ogg" : mimeType.includes("webm") ? "webm" : "mp3",
                },
              },
              {
                type: "text",
                text: "Transcreva exatamente o que foi dito neste áudio. Retorne APENAS o texto transcrito, sem formatação, sem aspas, sem explicações.",
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI transcription error:", aiResponse.status);
      return null;
    }

    const aiData = await aiResponse.json();
    const transcript = aiData.choices?.[0]?.message?.content?.trim();
    return transcript || null;
  } catch (err) {
    console.error("transcribeAudio error:", err);
    return null;
  }
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn("WhatsApp credentials not configured");
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    }
  );
  const result = await res.json();
  console.log("WhatsApp send result:", JSON.stringify(result));
  return result;
}

async function sendWhatsAppTemplate(phone: string, templateName: string, languageCode: string = "pt_BR", components: any[] = []) {
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn("WhatsApp credentials not configured");
    return;
  }

  const body: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components.length > 0) {
    body.template.components = components;
  }

  const res = await fetch(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const result = await res.json();
  console.log("WhatsApp template send result:", JSON.stringify(result));
  return result;
}

async function notifyDepartmentAgents(conversationId: string, departmentId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notify-agent-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, department_id: departmentId }),
    });

    const text = await response.text();
    console.log("notify-agent-whatsapp result:", response.status, text);
  } catch (error) {
    console.error("notifyDepartmentAgents error:", error);
  }
}

// ============ Lead Collection Helpers ============
const LEAD_STEPS = ["nome", "email", "cnpj", "empresa"] as const;
type LeadStep = typeof LEAD_STEPS[number];

const LEAD_PROMPTS: Record<LeadStep, string> = {
  nome: "Qual seu nome completo? Se preferir não informar, digite pular.",
  email: "Qual seu E-mail? Se preferir não informar, digite pular.",
  cnpj: "Qual seu CNPJ ou CPF? Se preferir não informar, digite pular.",
  empresa: "Você fala de qual empresa? Se preferir não informar, digite pular.",
};

// Extract CNPJ pattern from any text (XX.XXX.XXX/XXXX-XX or 14 digits)
function extractCnpj(text: string): string | null {
  if (!text) return null;
  const m = text.match(/\b(\d{2}[.\-/ ]?\d{3}[.\-/ ]?\d{3}[.\-/ ]?\d{4}[.\-/ ]?\d{2})\b/);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
}

function getMarker(messages: any[], prefix: string): string | null {
  const m = messages.find((x: any) => x.role === "system" && typeof x.content === "string" && x.content.startsWith(prefix));
  return m ? m.content.replace(prefix, "") : null;
}

function setMarker(messages: any[], prefix: string, value: string) {
  const idx = messages.findIndex((x: any) => x.role === "system" && typeof x.content === "string" && x.content.startsWith(prefix));
  const entry = { role: "system", content: `${prefix}${value}` };
  if (idx !== -1) messages[idx] = entry;
  else messages.push(entry);
}

function clearMarker(messages: any[], prefix: string) {
  const idx = messages.findIndex((x: any) => x.role === "system" && typeof x.content === "string" && x.content.startsWith(prefix));
  if (idx !== -1) messages.splice(idx, 1);
}

function nextLeadStep(current: LeadStep): LeadStep | null {
  const i = LEAD_STEPS.indexOf(current);
  return i < LEAD_STEPS.length - 1 ? LEAD_STEPS[i + 1] : null;
}

async function callChatbotAI(supabaseUrl: string, serviceRoleKey: string, chatbotId: string, message: string, history: any[]) {
  const response = await fetch(`${supabaseUrl}/functions/v1/chatbot-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      chatbotId,
      message,
      conversationHistory: history,
    }),
  });
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  // GET = webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST = incoming message
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook payload:", JSON.stringify(body));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages) {
        return new Response(JSON.stringify({ status: "no messages" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const message of value.messages) {
        const contactInfo = value.contacts?.[0];
        const waId = message.from;
        const profileName = contactInfo?.profile?.name || waId;
        let messageText = message.text?.body || message.caption || "";
        let messageType = message.type || "text";
        const whatsappMessageId = message.id;

        // Capture raw payload for ANY unsupported / unknown type for diagnostics
        const isUnsupported = messageType === "unsupported" || message.errors?.[0]?.code === 131051;
        const rawPayloadForDebug = isUnsupported ? message : null;
        if (isUnsupported) {
          console.log("[UNSUPPORTED MESSAGE - RAW PAYLOAD]:", JSON.stringify(message, null, 2));
        }

        // Handle unsupported message types (stickers/reactions/new formats Meta can't parse)
        if (isUnsupported) {
          const errMsg = message.errors?.[0]?.title || message.errors?.[0]?.message || "formato desconhecido";
          messageText = `⚠️ Mensagem não suportada (${errMsg}). Peça para reenviar como texto, imagem ou áudio.`;
          messageType = "text";
        } else if (messageType === "reaction") {
          const emoji = message.reaction?.emoji || "";
          messageText = `Reagiu ${emoji ? "com " + emoji : ""} a uma mensagem`;
          messageType = "text";
        } else if (!messageText && messageType === "text") {
          messageText = "(mensagem vazia)";
        }

        // Resolve media URL if present
        const mediaId = message.image?.id || message.audio?.id || message.video?.id || message.document?.id || message.sticker?.id || null;
        let resolvedMediaUrl: string | null = null;
        if (mediaId) {
          resolvedMediaUrl = await getMediaUrl(mediaId);
          console.log("Resolved media URL:", resolvedMediaUrl);
        }

        // Check if this is a satisfaction rating response (1-5)
        const trimmedText = messageText.trim();
        if (/^[1-5]$/.test(trimmedText)) {
          const { data: ratingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("phone", waId)
            .single();

          if (ratingContact) {
            const { data: pendingRating } = await supabase
              .from("satisfaction_ratings")
              .select("id")
              .eq("contact_id", ratingContact.id)
              .is("rating", null)
              .order("requested_at", { ascending: false })
              .limit(1)
              .single();

            if (pendingRating) {
              try {
                const ratingResponse = await fetch(
                  `${supabaseUrl}/functions/v1/satisfaction-rating`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${serviceRoleKey}`,
                    },
                    body: JSON.stringify({
                      action: "submit-rating",
                      contactId: ratingContact.id,
                      rating: parseInt(trimmedText),
                    }),
                  }
                );
                console.log("Rating submitted:", await ratingResponse.json());
              } catch (ratingErr) {
                console.error("Rating submission error:", ratingErr);
              }
              continue;
            }
          }
        }

        // Upsert contact
        const { data: contact, error: contactError } = await supabase
          .from("contacts")
          .upsert(
            { phone: waId, whatsapp_id: waId, name: profileName },
            { onConflict: "phone" }
          )
          .select()
          .single();

        if (contactError) {
          console.error("Contact upsert error:", contactError);
          continue;
        }

        // Find or create conversation
        let { data: conversation } = await supabase
          .from("conversations")
          .select("*")
          .eq("contact_id", contact.id)
          .in("status", ["open", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const isNewConversation = !conversation;

        // Check if this phone matches a recently-sent mass campaign lead (Meta template)
        // → route the incoming reply directly to the campaign's handoff department
        let campaignDeptId: string | null = null;
        let campaignContextToInject: { text: string; mediaUrl: string | null; mediaType: string | null; templateName: string; campaignName: string } | null = null;
        {
          const digits = waId.replace(/\D/g, "");
          // Try multiple variants: full, without country code 55, with 55, and last 10/11 digits
          const variants = new Set<string>([digits]);
          if (digits.startsWith("55")) variants.add(digits.slice(2));
          else variants.add("55" + digits);
          if (digits.length >= 11) variants.add(digits.slice(-11));
          if (digits.length >= 10) variants.add(digits.slice(-10));
          const list = Array.from(variants).filter(Boolean);
          const orFilter = list
            .flatMap((v) => [`telefone_normalizado.eq.${v}`, `telefone.eq.${v}`])
            .join(",");

          const { data: campLead } = await supabase
            .from("mass_campaign_leads")
            .select("id, campaign_id, status, nome, empresa, sent_at, mass_campaigns!inner(name, handoff_department_id, channel, message_template, meta_template_name, meta_header_media_url)")
            .or(orFilter)
            .in("status", ["sent", "replied"])
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (campLead) {
            const camp: any = (campLead as any).mass_campaigns;
            if (camp?.handoff_department_id) campaignDeptId = camp.handoff_department_id;
            if (campLead.status !== "replied") {
              await supabase.from("mass_campaign_leads").update({
                status: "replied",
                replied_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", campLead.id);

              // Prepare campaign template message to inject as context (first reply only)
              if (camp?.message_template) {
                const rawName = ((campLead as any).nome || (campLead as any).empresa || "").trim();
                const firstName = rawName.split(/\s+/)[0] || "Cliente";
                const rendered = String(camp.message_template).replace(/\{\{\s*1\s*\}\}/g, firstName);
                const headerUrl = camp.meta_header_media_url || null;
                campaignContextToInject = {
                  text: rendered,
                  mediaUrl: headerUrl,
                  mediaType: headerUrl ? "image" : null,
                  templateName: camp.meta_template_name || "",
                  campaignName: camp.name || "",
                };
              }
            }
          }
        }

        if (!conversation) {
          let assignedAgentId: string | null = null;

          // 1) PORTFOLIO (carteira): if contact has an assigned agent, route directly to them (skip URA)
          if ((contact as any).assigned_agent_id) {
            const { data: portfolioAgent } = await supabase
              .from("profiles")
              .select("is_active")
              .eq("user_id", (contact as any).assigned_agent_id)
              .single();
            if (portfolioAgent?.is_active) {
              assignedAgentId = (contact as any).assigned_agent_id;
              console.log("Portfolio (carteira) match, routing to:", assignedAgentId);
            }
          }

          // 2) AFFINITY fallback: last agent who handled this contact
          if (!assignedAgentId && !campaignDeptId) {
            const { data: lastConv } = await supabase
              .from("conversations")
              .select("assigned_agent_id")
              .eq("contact_id", contact.id)
              .not("assigned_agent_id", "is", null)
              .in("status", ["resolved", "closed"])
              .order("closed_at", { ascending: false })
              .limit(1)
              .single();

            if (lastConv?.assigned_agent_id) {
              const { data: agentProfile } = await supabase
                .from("profiles")
                .select("is_active")
                .eq("user_id", lastConv.assigned_agent_id)
                .single();

              if (agentProfile?.is_active) {
                assignedAgentId = lastConv.assigned_agent_id;
                console.log("Agent affinity match:", assignedAgentId);
              }
            }
          }

          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({
              contact_id: contact.id,
              channel: "whatsapp",
              status: (assignedAgentId || campaignDeptId) ? "open" : "pending",
              assigned_agent_id: assignedAgentId,
              department_id: campaignDeptId,
            })
            .select()
            .single();

          if (convError) {
            console.error("Conversation create error:", convError);
            continue;
          }
          conversation = newConv;
        } else if (campaignDeptId && !conversation.department_id && !conversation.assigned_agent_id) {
          // Existing pending conversation: apply campaign department routing
          await supabase.from("conversations").update({
            department_id: campaignDeptId,
            status: "open",
          }).eq("id", conversation.id);
          conversation.department_id = campaignDeptId;
          conversation.status = "open";
        }


        // Transcribe audio if it's an audio message
        let audioTranscript: string | null = null;
        if (messageType === "audio" && resolvedMediaUrl) {
          audioTranscript = await transcribeAudio(resolvedMediaUrl);
          console.log("Audio transcript:", audioTranscript);
        }

        // Insert incoming message
        const messageMetadata: Record<string, any> = {};
        if (audioTranscript) {
          messageMetadata.audio_transcript = audioTranscript;
        }
        if (rawPayloadForDebug) {
          messageMetadata.raw_meta_payload = rawPayloadForDebug;
        }

        // Inject campaign template as context (first reply to a Meta template campaign)
        if (campaignContextToInject) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "agent",
            content: campaignContextToInject.text,
            message_type: campaignContextToInject.mediaType === "image" ? "image" : "text",
            media_url: campaignContextToInject.mediaUrl,
            metadata: {
              campaign_context: true,
              campaign_name: campaignContextToInject.campaignName,
              template_name: campaignContextToInject.templateName,
            },
          });
        }

        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_type: "contact",
          content: audioTranscript || messageText,
          message_type: messageType,
          whatsapp_message_id: whatsappMessageId,
          media_url: resolvedMediaUrl,
          metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : {},
        });

        // Passive extraction: capture CNPJ from any message if not yet stored
        const detectedCnpj = extractCnpj(audioTranscript || messageText || "");
        if (detectedCnpj && !(contact as any).cnpj) {
          await supabase.from("contacts").update({ cnpj: detectedCnpj }).eq("id", contact.id);
        }

        // Update conversation timestamp
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: (conversation.unread_count || 0) + 1,
          })
          .eq("id", conversation.id);

        // Notificação ao grupo do dpto é disparada APENAS pelo trigger
        // trg_notify_dept_agents_update quando o lead seleciona um departamento.
        // Não notificamos em toda mensagem recebida.

        // ====== CHATBOT FLOW ======
        // Load state before deciding whether to skip the bot: after the immediate
        // department transfer, the bot must remain active until all lead questions finish.
        let { data: chatLog } = await supabase
          .from("chatbot_logs")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const storedChatMessages: any[] = chatLog?.messages ? (chatLog.messages as any[]) : [];
        const isCollectingLead = Boolean(
          getMarker(storedChatMessages, "__lead_step:") &&
          getMarker(storedChatMessages, "__pending_transfer:")
        );

        // Skip chatbot only after the data collection is complete.
        if ((conversation.assigned_agent_id || (conversation.status === "open" && conversation.department_id)) && !isCollectingLead) {
          console.log("Conversation has agent/department assigned and no active lead collection; skipping chatbot. Agent:", conversation.assigned_agent_id);
          if (conversation.status === "pending") {
            await supabase.from("conversations").update({ status: "open" }).eq("id", conversation.id);
          }
          continue;
        }

        // Determine current chatbot state
        let currentChatbotId = chatLog?.chatbot_config_id || null;
        let chatMessages: any[] = storedChatMessages;

        // New conversation → send welcome message from Menu Inicial
        if (isNewConversation || !chatLog) {
          currentChatbotId = MENU_INICIAL_ID;

          // Get welcome message
          const { data: menuConfig } = await supabase
            .from("chatbot_configs")
            .select("welcome_message")
            .eq("id", MENU_INICIAL_ID)
            .single();

          const welcomeMsg = menuConfig?.welcome_message || "Olá! Como posso ajudar?";

          // Send welcome via WhatsApp
          await sendWhatsAppMessage(waId, welcomeMsg);

          // Save bot message
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "system",
            sender_id: BOT_USER_ID,
            content: welcomeMsg,
            message_type: "text",
          });

          // Create chatbot log (only store the welcome, user msg will be processed on next message)
          chatMessages = [
            { role: "assistant", content: welcomeMsg },
          ];

          await supabase
            .from("chatbot_logs")
            .insert({
              conversation_id: conversation.id,
              contact_id: contact.id,
              chatbot_config_id: currentChatbotId,
              messages: chatMessages,
            });

          // Stop here for new conversations - just sent the welcome/menu
          continue;
        } else {
          // Existing conversation → add user message to history
          chatMessages.push({ role: "user", content: messageText });
        }

        // ============ LEAD COLLECTION HELPERS ============
        const persistLog = async (extra: Record<string, any> = {}) => {
          if (chatLog) {
            await supabase.from("chatbot_logs")
              .update({ messages: chatMessages, chatbot_config_id: currentChatbotId, ...extra })
              .eq("id", chatLog.id);
          }
        };
        const sendBot = async (text: string) => {
          await sendWhatsAppMessage(waId, text);
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "system",
            sender_id: BOT_USER_ID,
            content: text,
            message_type: "text",
          });
          chatMessages.push({ role: "assistant", content: text });
        };
        const executeTransfer = async (pending: { deptId: string | null; agentId?: string | null; locationName?: string | null }) => {
          let deptName = "atendimento";
          if (pending.deptId) {
            const { data: dept } = await supabase
              .from("departments").select("name").eq("id", pending.deptId).single();
            deptName = dept?.name || deptName;
          }
          const locSuffix = pending.locationName ? ` - ${pending.locationName}` : "";
          const alreadyCollected = getMarker(chatMessages, "__lead_done:") === "1";
          let transferMsg: string;
          if (alreadyCollected) {
            transferMsg = pending.deptId
              ? `Perfeito! Vou transferir você para o setor de *${deptName}*${locSuffix}. Um atendente entrará em contato em breve. Aguarde um momento! 🙋`
              : "Entendido! Vou transferir você para um atendente humano. Por favor, aguarde um momento. 🙋";
          } else {
            transferMsg = pending.deptId
              ? `Vou transferir você para o setor ${deptName}${locSuffix}, mas antes de transferir, pode responder algumas perguntas para agilizar o atendimento?`
              : "Vou transferir você para um atendente, mas antes de transferir, pode responder algumas perguntas para agilizar o atendimento?";
          }
          await sendBot(transferMsg);
          const updatePayload: any = { status: "open", last_message_at: new Date().toISOString() };
          if (pending.deptId) updatePayload.department_id = pending.deptId;
          if (pending.agentId) updatePayload.assigned_agent_id = pending.agentId;
          await supabase.from("conversations").update(updatePayload).eq("id", conversation.id);
          // Notification is handled by DB trigger trg_notify_dept_agents_update on conversations
          // (avoids duplicate WhatsApp messages)
          await persistLog({ transferred_to_agent: true });
        };
        const beginTransfer = async (pending: { deptId: string | null; agentId?: string | null; locationName?: string | null }) => {
          const alreadyDone = getMarker(chatMessages, "__lead_done:") === "1";
          // Transferência e notificação imediatas, sem esperar a coleta de dados
          await executeTransfer(pending);
          if (alreadyDone) return;
          setMarker(chatMessages, "__pending_transfer:", JSON.stringify(pending));
          setMarker(chatMessages, "__lead_step:", "nome");
          await sendBot(LEAD_PROMPTS["nome"]);
          await persistLog();
        };

        // If user is mid lead-collection, capture answer and advance
        const currentLeadStep = getMarker(chatMessages, "__lead_step:") as LeadStep | null;
        const pendingTransferRaw = getMarker(chatMessages, "__pending_transfer:");
        if (currentLeadStep && pendingTransferRaw && (LEAD_STEPS as readonly string[]).includes(currentLeadStep)) {
          const answer = messageText.trim();
          const isSkip = /^(pular|skip|não|nao|n\/a|na|-)$/i.test(answer);
          if (!isSkip && answer) {
            const update: any = {};
            if (currentLeadStep === "nome") { update.chatbot_name = answer; update.name = answer; }
            else if (currentLeadStep === "email" && /\S+@\S+\.\S+/.test(answer)) update.email = answer;
            else if (currentLeadStep === "empresa") update.company_name = answer;
            else if (currentLeadStep === "cnpj") {
              const c = extractCnpj(answer);
              const digits = answer.replace(/\D/g, "");
              if (c) update.cnpj = c;
              else if (digits.length === 11) update.cnpj = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`;
              else update.cnpj = answer;
            }
            if (Object.keys(update).length > 0) {
              await supabase.from("contacts").update(update).eq("id", contact.id);
            }
          }
          const next = nextLeadStep(currentLeadStep);
          if (next) {
            setMarker(chatMessages, "__lead_step:", next);
            await sendBot(LEAD_PROMPTS[next]);
            await persistLog();
            continue;
          } else {
            clearMarker(chatMessages, "__lead_step:");
            clearMarker(chatMessages, "__pending_transfer:");
            setMarker(chatMessages, "__lead_done:", "1");
            await sendBot("Obrigado, um atendente irá te atender.");
            await persistLog({ transferred_to_agent: true });
            continue;
          }
        }

        // Check for transfer keywords first
        const lowerMsg = messageText.toLowerCase();
        const transferKeywords = ["atendente", "humano", "pessoa", "agente"];
        const wantsTransfer = transferKeywords.some((kw) => lowerMsg.includes(kw));

        if (wantsTransfer) {
          await beginTransfer({ deptId: null });
          continue;
        }

        // Process menu navigation
        const option = trimmedText.trim();
        let botReply: string | null = null;
        let shouldTransferToDept: string | null = null;

        if (currentChatbotId === MENU_INICIAL_ID) {
          // User is at Menu Inicial
          const target = MENU_INICIAL_OPTIONS[option];
          if (target) {
            if (target.startsWith("DEPT:")) {
              // Direct department transfer (Licitação)
              shouldTransferToDept = target.replace("DEPT:", "");
            } else {
              // Navigate to submenu
              currentChatbotId = target;
              const { data: submenuConfig } = await supabase
                .from("chatbot_configs")
                .select("welcome_message")
                .eq("id", target)
                .single();
              botReply = submenuConfig?.welcome_message || "Selecione uma opção:";
            }
          } else {
            // Invalid option or free text → use AI assistant
            const aiResult = await callChatbotAI(supabaseUrl, serviceRoleKey, ASSISTENTE_ID, messageText, chatMessages.slice(0, -1));
            botReply = aiResult.reply || "Desculpa, não entendi. Selecionar uma das opções do menu que um atendendo humano irá te atender em breve.";
            if (aiResult.transfer) {
              await beginTransfer({ deptId: null });
              continue;
            }
          }
        } else if (currentChatbotId === SUBMENU_PECAS_ID) {
          // User is at Submenu Peças (location selection)
          if (option === "0") {
            // Go back to origin submenu (Comercial or Pós-Vendas)
            const originMarker = chatMessages.find((m: any) => m.role === "system" && m.content?.startsWith("__origin:"));
            const origin = originMarker?.content?.replace("__origin:", "") || "comercial";
            const parentId = origin === "pos-vendas"
              ? "62c0d61c-1bdd-4e3e-8493-1fec03f40008"  // Submenu Pós-Vendas
              : "65d59849-8784-4618-b6ac-ab4d56f04dbb";  // Submenu Comercial
            currentChatbotId = parentId;

            // Remove origin marker from history
            const originIdx = chatMessages.findIndex((m: any) => m.role === "system" && m.content?.startsWith("__origin:"));
            if (originIdx !== -1) chatMessages.splice(originIdx, 1);

            const { data: parentConfig } = await supabase
              .from("chatbot_configs")
              .select("welcome_message")
              .eq("id", parentId)
              .single();
            botReply = parentConfig?.welcome_message || "Selecione uma opção:";
          } else if (option === "1" || option === "2") {
            // Determine origin to pick correct department
            const originMarker = chatMessages.find((m: any) => m.role === "system" && m.content?.startsWith("__origin:"));
            const origin = originMarker?.content?.replace("__origin:", "") || "comercial";
            const pecasDeptId = origin === "pos-vendas" ? DEPT_POS_VENDAS_PECAS : DEPT_COMERCIAL_PECAS;
            const agentId = option === "1" ? AGENT_ARENALDO_ID : AGENT_EDIS_ID;
            const locationName = option === "1" ? "Brasília DF" : "Goiânia GO";

            const { data: dept } = await supabase
              .from("departments")
              .select("name")
              .eq("id", pecasDeptId)
              .single();

            await beginTransfer({ deptId: pecasDeptId, agentId, locationName });
            continue;
          } else {
            // Invalid option → repeat Peças menu
            const { data: pecasConfig } = await supabase
              .from("chatbot_configs")
              .select("welcome_message")
              .eq("id", SUBMENU_PECAS_ID)
              .single();
            botReply = `Opção inválida. Por favor, selecione uma das opções:\n\n${pecasConfig?.welcome_message || "Selecione uma opção:"}`;
          }
        } else if (SUBMENU_OPTIONS[currentChatbotId!]) {
          // User is at a submenu
          const deptOptions = SUBMENU_OPTIONS[currentChatbotId!];
          if (option === "0") {
            // Go back to Menu Inicial
            currentChatbotId = MENU_INICIAL_ID;
            const { data: menuConfig } = await supabase
              .from("chatbot_configs")
              .select("welcome_message")
              .eq("id", MENU_INICIAL_ID)
              .single();
            botReply = menuConfig?.welcome_message || "Selecione uma opção:";
          } else {
            const target = deptOptions[option];
            if (target) {
              if (target.startsWith("SUBMENU_PECAS:")) {
                // Navigate to Submenu Peças with origin tracking
                const origin = target.replace("SUBMENU_PECAS:", "");
                currentChatbotId = SUBMENU_PECAS_ID;

                // Store origin marker in chat messages
                chatMessages.push({ role: "system", content: `__origin:${origin}` });

                const { data: pecasConfig } = await supabase
                  .from("chatbot_configs")
                  .select("welcome_message")
                  .eq("id", SUBMENU_PECAS_ID)
                  .single();
                botReply = pecasConfig?.welcome_message || "Selecione sua região:";
              } else {
                shouldTransferToDept = target;
              }
            } else {
              // Invalid option → repeat menu
              const { data: currentConfig } = await supabase
                .from("chatbot_configs")
                .select("welcome_message")
                .eq("id", currentChatbotId!)
                .single();
              botReply = `Opção inválida. Por favor, selecione uma das opções:\n\n${currentConfig?.welcome_message || "Selecione uma opção:"}`;
            }
          }
        } else {
          // Fallback to AI assistant
          const aiResult = await callChatbotAI(supabaseUrl, serviceRoleKey, ASSISTENTE_ID, messageText, chatMessages.slice(0, -1));
          botReply = aiResult.reply || "Desculpe, não consegui processar sua mensagem.";
        }

        // Handle department transfer
        if (shouldTransferToDept) {
          await beginTransfer({ deptId: shouldTransferToDept });
          continue;
        }

        // Send bot reply
        if (botReply) {
          await sendWhatsAppMessage(waId, botReply);
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "system",
            sender_id: BOT_USER_ID,
            content: botReply,
            message_type: "text",
          });

          chatMessages.push({ role: "assistant", content: botReply });

          if (chatLog) {
            await supabase
              .from("chatbot_logs")
              .update({
                messages: chatMessages,
                chatbot_config_id: currentChatbotId,
              })
              .eq("id", chatLog.id);
          }
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

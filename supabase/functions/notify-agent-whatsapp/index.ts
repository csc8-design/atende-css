import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_URL = "https://atendimento.appcbmaq.com.br/";
const DEDUPE_WINDOW_SECONDS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, department_id } = await req.json();
    if (!conversation_id || !department_id) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca grupo do departamento
    const { data: group } = await supabase
      .from("department_whatsapp_groups")
      .select("group_jid, group_name")
      .eq("department_id", department_id)
      .maybeSingle();

    if (!group) {
      console.warn(`Sem grupo cadastrado para department_id=${department_id}`);
      return new Response(JSON.stringify({ ok: true, notified: 0, reason: "no group configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicação: usa agent_notification_log com agent_id = department_id como chave do grupo
    const recentCutoff = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("agent_notification_log")
      .select("id")
      .eq("conversation_id", conversation_id)
      .eq("agent_id", department_id)
      .gte("notified_at", recentCutoff)
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0, reason: "deduped" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dados do contato e departamento
    const [convRes, deptRes] = await Promise.all([
      supabase.from("conversations").select("contact_id").eq("id", conversation_id).maybeSingle(),
      supabase.from("departments").select("name").eq("id", department_id).maybeSingle(),
    ]);

    const contactId = convRes.data?.contact_id ?? null;
    const departmentName = deptRes.data?.name || "departamento";

    let contactName = "Lead";
    let contactPhone = "";
    if (contactId) {
      const { data: contact } = await supabase
        .from("contacts").select("name, phone").eq("id", contactId).maybeSingle();
      contactName = contact?.name || contactName;
      contactPhone = contact?.phone || "";
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const INSTANCE = Deno.env.get("EVOLUTION_NOTIFY_INSTANCE") || "ENVIO_NOT";
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "no creds" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    try { const u = new URL(baseUrl); baseUrl = `${u.protocol}//${u.host}`; } catch {}

    // Verifica estado da instância antes de enviar
    try {
      const stRes = await fetch(`${baseUrl}/instance/connectionState/${INSTANCE}`, {
        headers: { "apikey": EVOLUTION_API_KEY },
      });
      const stJson = await stRes.json().catch(() => ({}));
      const state = stJson?.instance?.state || stJson?.state || "unknown";
      console.log(`[notify] instance=${INSTANCE} state=${state}`);
      if (state !== "open") {
        console.error(`[notify] instância ${INSTANCE} não está conectada (state=${state})`);
        return new Response(JSON.stringify({ ok: false, error: `instance ${INSTANCE} state=${state}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error(`[notify] erro ao checar state:`, e);
    }

    const templatePhone = contactPhone || "Sem telefone";
    const text =
      `🔔 Novo atendimento no setor ${departmentName}\n\n` +
      `👤 Contato: ${contactName}\n` +
      `📞 Telefone: ${templatePhone}\n\n` +
      `Acesse a plataforma para atender: ${PLATFORM_URL}`;

    console.log(`[notify] enviando para grupo=${group.group_jid} via ${INSTANCE}`);
    const waRes = await fetch(`${baseUrl}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { "apikey": EVOLUTION_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ number: group.group_jid, text }),
    });

    const waJson = await waRes.json().catch(() => ({}));
    const msgId = waJson?.key?.id || waJson?.messageId || waJson?.id || null;
    console.log(`[notify] resposta Evolution status=${waRes.status} msgId=${msgId} body=${JSON.stringify(waJson).slice(0, 400)}`);

    if (!waRes.ok || !msgId) {
      console.error(`[notify] Falha ao notificar grupo ${group.group_jid}:`, JSON.stringify(waJson));
      return new Response(JSON.stringify({ ok: false, error: waJson }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("agent_notification_log").insert({
      agent_id: department_id, // reaproveita coluna como "chave do alvo" (grupo do dpto)
      conversation_id,
    });

    return new Response(JSON.stringify({ ok: true, notified: 1, group: group.group_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-agent-whatsapp error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

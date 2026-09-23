import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_URL = "atendimento.appcbmaq.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const INSTANCE = Deno.env.get("EVOLUTION_NOTIFY_INSTANCE") || "ENVIO_NOT";
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "no creds" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    try { const u = new URL(baseUrl); baseUrl = `${u.protocol}//${u.host}`; } catch { /* keep */ }

    const now = Date.now();
    const tenMin = new Date(now - 10 * 60 * 1000).toISOString();
    const twoHours = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    // Conversas abertas/pendentes COM departamento atribuído
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("id, contact_id, assigned_agent_id, department_id, last_message_at, contacts(name), departments(name)")
      .in("status", ["open", "pending"])
      .not("department_id", "is", null)
      .lte("last_message_at", tenMin)
      .gte("last_message_at", twoHours);

    if (convError) throw convError;

    const results: any[] = [];

    for (const conv of conversations || []) {
      // Última mensagem precisa ser do cliente (sem resposta)
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMsg = lastMessages?.[0];
      if (!lastMsg || lastMsg.sender_type !== "contact") continue;

      const elapsedMin = (now - new Date(lastMsg.created_at).getTime()) / 60000;
      let level: "10m" | "30m" | "1h" | null = null;
      if (elapsedMin >= 60) level = "1h";
      else if (elapsedMin >= 30) level = "30m";
      else if (elapsedMin >= 10) level = "10m";
      if (!level) continue;

      // Dedupe pela combinação conversa + nível + horário da mensagem
      const { data: already } = await supabase
        .from("conversation_reply_alerts")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("level", level)
        .eq("last_message_at", lastMsg.created_at)
        .limit(1);
      if (already && already.length > 0) continue;

      // Grupo do departamento
      const { data: group } = await supabase
        .from("department_whatsapp_groups")
        .select("group_jid, group_name")
        .eq("department_id", conv.department_id)
        .maybeSingle();
      if (!group) continue;

      const contactName = (conv as any).contacts?.name || "Cliente";
      const departmentName = (conv as any).departments?.name || "-";

      let agentName = "Sem agente atribuído";
      if (conv.assigned_agent_id) {
        const { data: prof } = await supabase
          .from("profiles").select("full_name").eq("user_id", conv.assigned_agent_id).maybeSingle();
        agentName = prof?.full_name || agentName;
      }

      const label = level === "1h" ? "1 Hora" : level === "30m" ? "30 minutos" : "10 minutos";
      const text =
        `⚠️ Existe um atendimento ha ${label} sem resposta.\n\n` +
        `Cliente: ${contactName}\n` +
        `Agente: ${agentName}\n` +
        `Departamento: ${departmentName}\n\n` +
        `Acesse: ${PLATFORM_URL}`;

      const waRes = await fetch(`${baseUrl}/message/sendText/${INSTANCE}`, {
        method: "POST",
        headers: { "apikey": EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ number: group.group_jid, text }),
      });
      const waJson = await waRes.json().catch(() => ({}));
      const ok = waRes.ok && (waJson?.key?.id || waJson?.messageId || waJson?.id);

      if (!ok) {
        console.error(`[no-reply] falha grupo=${group.group_jid}`, JSON.stringify(waJson).slice(0, 300));
        results.push({ conversation_id: conv.id, level, sent: false });
        continue;
      }

      await supabase.from("conversation_reply_alerts").insert({
        conversation_id: conv.id,
        level,
        last_message_at: lastMsg.created_at,
      });

      results.push({ conversation_id: conv.id, level, group: group.group_name, sent: true });
    }

    return new Response(JSON.stringify({ ok: true, alerts: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-no-reply error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

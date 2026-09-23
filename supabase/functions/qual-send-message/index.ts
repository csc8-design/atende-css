import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const { conversationId, text } = await req.json();
    if (!conversationId || !text) return json({ error: "conversationId and text required" }, 400);

    const { data: conv, error: convErr } = await supabase
      .from("qual_conversations")
      .select("id, phone, evolution_instance")
      .eq("id", conversationId)
      .single();
    if (convErr || !conv) return json({ error: "Conversation not found" }, 404);

    const evoUrlRaw = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const evoInstance = conv.evolution_instance || Deno.env.get("EVOLUTION_INSTANCE_NAME");
    if (!evoUrlRaw || !evoKey || !evoInstance) {
      return json({ error: "Evolution API não configurada" }, 500);
    }
    let evoUrl = evoUrlRaw.replace(/\/+$/, "");
    try {
      const u = new URL(evoUrl);
      evoUrl = `${u.protocol}//${u.host}`;
    } catch {}

    const evo = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
      method: "POST",
      headers: { apikey: evoKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: conv.phone, text }),
    });
    const evoData = await evo.json().catch(() => ({}));

    if (!evo.ok) {
      const raw = evoData?.response?.message || evoData?.message || JSON.stringify(evoData);
      return json({ error: `Evolution API erro (${evo.status}): ${raw}`, raw: evoData }, 400);
    }

    const evoMsgId = evoData?.key?.id || evoData?.messageId || evoData?.id || null;
    const now = new Date().toISOString();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("qual_messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      content: text,
      evolution_message_id: evoMsgId,
      sent_at: now,
    });
    await admin
      .from("qual_conversations")
      .update({ last_message_preview: text.slice(0, 120), last_message_at: now })
      .eq("id", conv.id);

    return json({ success: true, messageId: evoMsgId });
  } catch (err: any) {
    console.error("qual-send-message error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(d: any, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Transcreve áudios da aba Qualificação IA usando Lovable AI (gpt-4o-mini-transcribe).
// Áudios do WhatsApp vêm criptografados (mmg.whatsapp.net/...enc) — não dá pra baixar direto.
// Por isso pedimos o base64 já decriptado para a Evolution API
// (POST /chat/getBase64FromMediaMessage/{instance}).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messageId } = await req.json();
    if (!messageId) return json({ error: "messageId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg } = await admin
      .from("qual_messages")
      .select("id, media_url, media_type, metadata, conversation_id, evolution_message_id")
      .eq("id", messageId)
      .maybeSingle();

    if (!msg) return json({ error: "message not found" }, 404);
    if (msg.media_type !== "audio") return json({ skipped: "not audio" });
    const meta: any = msg.metadata || {};
    if (meta.transcription) return json({ skipped: "already transcribed" });

    const { data: conv } = await admin
      .from("qual_conversations")
      .select("id, evolution_instance, last_message_preview")
      .eq("id", msg.conversation_id)
      .maybeSingle();

    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const instance = conv?.evolution_instance || Deno.env.get("EVOLUTION_INSTANCE_NAME");

    let audioBlob: Blob | null = null;
    let mimeType = "audio/ogg";

    // 1) Tentar Evolution getBase64FromMediaMessage (decriptado)
    if (evoUrl && evoKey && instance && msg.evolution_message_id) {
      try {
        const evoResp = await fetch(
          `${evoUrl.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${instance}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evoKey,
            },
            body: JSON.stringify({
              message: { key: { id: msg.evolution_message_id } },
              convertToMp4: false,
            }),
          },
        );
        if (evoResp.ok) {
          const j = await evoResp.json();
          const b64: string | undefined = j?.base64 || j?.media?.base64 || j?.data?.base64;
          mimeType = j?.mimetype || j?.media?.mimetype || mimeType;
          if (b64) {
            const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            audioBlob = new Blob([bin], { type: mimeType });
          }
        } else {
          const txt = await evoResp.text().catch(() => "");
          console.error("evolution base64 failed", evoResp.status, txt.slice(0, 300));
        }
      } catch (e) {
        console.error("evolution base64 error", e);
      }
    }

    // 2) Fallback: tentar baixar direto (funciona se for URL pública não-WhatsApp)
    if (!audioBlob && msg.media_url && !msg.media_url.includes(".enc")) {
      const r = await fetch(msg.media_url);
      if (r.ok) {
        audioBlob = await r.blob();
        mimeType = r.headers.get("content-type") || audioBlob.type || mimeType;
      }
    }

    if (!audioBlob || audioBlob.size < 256) {
      return json({ error: "could not retrieve audio", media_url: msg.media_url }, 502);
    }

    const ext =
      mimeType.includes("mpeg") ? "mp3" :
      mimeType.includes("wav") ? "wav" :
      mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" :
      mimeType.includes("webm") ? "webm" :
      "ogg";

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const form = new FormData();
    form.append("file", audioBlob, `audio.${ext}`);
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const sttResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}` },
      body: form,
    });

    if (!sttResp.ok) {
      const errTxt = await sttResp.text().catch(() => "");
      console.error("STT error", sttResp.status, errTxt);
      return json({ error: `stt ${sttResp.status}`, detail: errTxt }, 502);
    }

    const sttJson = await sttResp.json();
    const transcription: string = (sttJson.text || "").trim();
    if (!transcription) return json({ skipped: "empty transcription" });

    await admin
      .from("qual_messages")
      .update({
        metadata: { ...meta, transcription },
        content: `🎤 ${transcription}`,
      })
      .eq("id", messageId);

    if (conv) {
      await admin
        .from("qual_conversations")
        .update({ last_message_preview: `🎤 ${transcription.slice(0, 80)}` })
        .eq("id", conv.id);
    }

    return json({ ok: true, transcription });
  } catch (err: any) {
    console.error("qual-transcribe-audio error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(d: any, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

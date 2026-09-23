import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, conversationId, contactId, rating, comment, agentId } = await req.json();

    // ACTION: send-survey — called when conversation is closed
    if (action === "send-survey") {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: "conversationId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get conversation details
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("*, contacts(*)")
        .eq("id", conversationId)
        .single();

      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already has a pending rating for this conversation
      const { data: existing } = await supabase
        .from("satisfaction_ratings")
        .select("id")
        .eq("conversation_id", conversationId)
        .is("rating", null)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ message: "Survey already sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert rating record (pending response)
      const { data: ratingRecord, error: ratingErr } = await supabase
        .from("satisfaction_ratings")
        .insert({
          conversation_id: conversationId,
          contact_id: conv.contact_id,
          agent_id: agentId || conv.assigned_agent_id,
          department_id: conv.department_id,
        })
        .select()
        .single();

      if (ratingErr) {
        console.error("Rating insert error:", ratingErr);
        return new Response(JSON.stringify({ error: ratingErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send WhatsApp message with rating request
      const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const phone = conv.contacts?.phone;

      const surveyMessage =
        `📊 *Avaliação de Atendimento - CBMaq*\n\n` +
        `Olá ${conv.contacts?.name || ""}! Seu atendimento foi finalizado.\n\n` +
        `Por favor, avalie nosso atendimento com uma nota de *1 a 5*:\n\n` +
        `⭐ 1 - Muito Ruim\n` +
        `⭐⭐ 2 - Ruim\n` +
        `⭐⭐⭐ 3 - Regular\n` +
        `⭐⭐⭐⭐ 4 - Bom\n` +
        `⭐⭐⭐⭐⭐ 5 - Excelente\n\n` +
        `Responda apenas com o número da nota (1 a 5).`;

      if (WHATSAPP_TOKEN && PHONE_NUMBER_ID && phone) {
        try {
          const waResponse = await fetch(
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
                text: { body: surveyMessage },
              }),
            }
          );

          const waResult = await waResponse.json();
          console.log("WhatsApp survey sent:", JSON.stringify(waResult));

          // Store the WhatsApp message ID for matching responses
          if (waResult.messages?.[0]?.id) {
            await supabase
              .from("satisfaction_ratings")
              .update({ whatsapp_message_id: waResult.messages[0].id })
              .eq("id", ratingRecord.id);
          }
        } catch (waErr) {
          console.error("WhatsApp send error:", waErr);
        }
      } else {
        console.warn("WhatsApp not configured, survey saved locally only");
      }

      // Also save the survey message to the conversation
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "system",
        content: surveyMessage,
        message_type: "text",
      });

      return new Response(JSON.stringify({ success: true, ratingId: ratingRecord.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: submit-rating — called by webhook when client responds
    if (action === "submit-rating") {
      if (!contactId || !rating) {
        return new Response(JSON.stringify({ error: "contactId and rating required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the most recent pending rating for this contact
      const { data: pendingRating, error: findErr } = await supabase
        .from("satisfaction_ratings")
        .select("*")
        .eq("contact_id", contactId)
        .is("rating", null)
        .order("requested_at", { ascending: false })
        .limit(1)
        .single();

      if (findErr || !pendingRating) {
        return new Response(JSON.stringify({ error: "No pending rating found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update with the rating
      const { error: updateErr } = await supabase
        .from("satisfaction_ratings")
        .update({
          rating: Math.min(5, Math.max(1, parseInt(rating))),
          comment: comment || null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", pendingRating.id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send thank you message
      const thankYouMessages: Record<number, string> = {
        1: "Lamentamos que sua experiência não tenha sido boa. Vamos trabalhar para melhorar! 🙏",
        2: "Agradecemos seu feedback. Vamos nos esforçar para atendê-lo melhor! 🙏",
        3: "Obrigado pela avaliação! Vamos trabalhar para melhorar ainda mais. 😊",
        4: "Que bom que gostou do nosso atendimento! Obrigado! 😊",
        5: "Ficamos muito felizes com sua avaliação! Obrigado pela confiança! 🌟",
      };

      const ratingNum = Math.min(5, Math.max(1, parseInt(rating)));
      const thankYou = thankYouMessages[ratingNum] || "Obrigado pela avaliação!";

      // Get contact phone for WhatsApp reply
      const { data: contact } = await supabase
        .from("contacts")
        .select("phone, name")
        .eq("id", contactId)
        .single();

      const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (WHATSAPP_TOKEN && PHONE_NUMBER_ID && contact?.phone) {
        try {
          await fetch(
            `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: contact.phone,
                type: "text",
                text: { body: thankYou },
              }),
            }
          );
        } catch (e) {
          console.error("Thank you message error:", e);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Satisfaction rating error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

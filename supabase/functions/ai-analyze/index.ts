import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisResult {
  sentiment: string;
  sentiment_score: number;
  lead_score: string;
  summary: string;
  suggested_responses: string[];
  alert_supervisor: boolean;
  alert_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId, conversationIds, background, action } = await req.json();

    // Batch background mode
    if (Array.isArray(conversationIds) && conversationIds.length > 0) {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const projectUrl = `${supabaseUrl}/functions/v1/ai-analyze`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const runBatch = async () => {
        for (let i = 0; i < conversationIds.length; i++) {
          if (i > 0) await sleep(4000);
          try {
            const r = await fetch(projectUrl, {
              method: "POST",
              headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId: conversationIds[i] }),
            });
            // retry once on 429
            if (r.status === 429) {
              await sleep(4000);
              await fetch(projectUrl, {
                method: "POST",
                headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: conversationIds[i] }),
              });
            }
          } catch (e) {
            console.error("batch item error", conversationIds[i], e);
          }
        }
      };
      if (background) {
        // @ts-ignore
        EdgeRuntime.waitUntil(runBatch());
        return new Response(JSON.stringify({ success: true, queued: conversationIds.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await runBatch();
      return new Response(JSON.stringify({ success: true, processed: conversationIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch conversation + contact
    const { data: conversation, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("*, contacts(name, phone, tags)")
      .eq("id", conversationId)
      .single();

    if (convErr || !conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent messages (last 30)
    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("content, sender_type, created_at, message_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages to analyze" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build conversation transcript
    const transcript = messages
      .filter(m => m.content)
      .map(m => `[${m.sender_type === "contact" ? "Cliente" : m.sender_type === "agent" ? "Agente" : "Sistema"}]: ${m.content}`)
      .join("\n");

    const systemPrompt = `Você é um analista de atendimento ao cliente especializado. Analise a conversa abaixo e retorne uma análise JSON com os seguintes campos:

1. **sentiment**: O sentimento predominante do CLIENTE. Valores: "positivo", "neutro", "negativo", "irritado", "satisfeito"
2. **sentiment_score**: Score de -1.0 (muito negativo) a 1.0 (muito positivo)
3. **lead_score**: Classificação do lead. Valores: "quente", "morno", "frio"
4. **summary**: Resumo conciso da conversa em 1-3 frases
5. **suggested_responses**: Array com 2-3 sugestões de resposta para o agente (curtas e diretas)
6. **alert_supervisor**: Boolean - true se o cliente está muito irritado, ameaçando cancelar, ou situação requer atenção urgente
7. **alert_reason**: Se alert_supervisor=true, motivo do alerta

Informações do contato:
- Nome: ${conversation.contacts?.name || "Desconhecido"}
- Tags: ${(conversation.contacts?.tags || []).join(", ") || "Nenhuma"}

Responda APENAS com o JSON válido, sem markdown ou texto adicional.`;

    const aiPayload = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversa:\n${transcript}` },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    };
    const callAI = () => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(aiPayload),
    });
    const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let aiResponse = await callAI();
    // Retry up to 3x on 429 with backoff
    let attempts = 0;
    while (aiResponse.status === 429 && attempts < 3) {
      attempts++;
      await sleepMs(2000 * attempts);
      aiResponse = await callAI();
    }

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "AI processing error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown code blocks if present
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update conversation with analysis results
    await supabaseAdmin
      .from("conversations")
      .update({
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        lead_score: analysis.lead_score,
        ai_summary: analysis.summary,
      })
      .eq("id", conversationId);

    // Store suggested responses
    if (analysis.suggested_responses?.length > 0) {
      // Delete old suggestions for this conversation
      await supabaseAdmin
        .from("ai_suggestions")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("is_used", false);

      // Insert new ones
      const suggestions = analysis.suggested_responses.map(s => ({
        conversation_id: conversationId,
        suggestion_type: "response",
        content: s,
      }));
      await supabaseAdmin.from("ai_suggestions").insert(suggestions);
    }

    // Create alert notification if needed
    if (analysis.alert_supervisor) {
      // Find supervisors/managers linked to conversation department
      const deptId = conversation.department_id;
      let supervisorIds: string[] = [];

      if (deptId) {
        const { data: deptAgents } = await supabaseAdmin
          .from("agent_departments")
          .select("agent_id")
          .eq("department_id", deptId);
        
        if (deptAgents) {
          // Check which are managers/admins
          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .in("user_id", deptAgents.map(d => d.agent_id))
            .in("role", ["manager", "admin"]);
          if (roles) supervisorIds = roles.map(r => r.user_id);
        }
      }

      // Also get all admins
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins) {
        supervisorIds = [...new Set([...supervisorIds, ...admins.map(a => a.user_id)])];
      }

      // Create notifications
      const notifications = supervisorIds.map(uid => ({
        user_id: uid,
        title: `⚠️ Alerta: ${conversation.contacts?.name || "Cliente"}`,
        body: analysis.alert_reason || `Cliente com sentimento ${analysis.sentiment}`,
        type: "sentiment_alert",
        reference_id: conversationId,
      }));

      if (notifications.length > 0) {
        await supabaseAdmin.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      analysis: {
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        lead_score: analysis.lead_score,
        summary: analysis.summary,
        suggested_responses: analysis.suggested_responses,
        alert_supervisor: analysis.alert_supervisor,
        alert_reason: analysis.alert_reason,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-analyze error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

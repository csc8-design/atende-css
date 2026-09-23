// Análise de qualificação via Lovable AI Gateway (Gemini).
// Lê todo o histórico da conversa, identifica os 4 critérios (Necessidade,
// Decisor, Prazo, Capacidade Financeira), extrai dados do lead e gera resumo.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um copiloto de qualificação de leads B2B para a CBMaq (vendas de máquinas pesadas).
Analise o histórico da conversa entre operador e cliente WhatsApp e identifique:

1. NECESSIDADE — cliente possui máquinas/operação/obra e precisa comprar/trocar/ampliar?
2. DECISOR — o interlocutor é quem decide ou aprova a compra?
3. PRAZO — há janela de compra definida (mês, trimestre, safra, urgência)?
4. CAPACIDADE — há indicação financeira (financiamento, crédito aprovado, à vista, leasing, Moderfrota, Pronaf, banco, capital)?

Use interpretação semântica, não apenas palavras-chave. Ex: "tenho 3 escavadeiras em mineração" implica necessidade + capacidade.

Para cada critério retorne:
- status: "qualified" se confiança ≥ 0.8, senão "pending"
- confidence: 0 a 1
- evidence: trecho EXATO da conversa que comprova (máx 180 chars), ou null
- summary: 1 frase descritiva, ou null

Também extraia dados do lead (lead_data) quando mencionados:
nome, empresa, cnpj, cpf, cidade, uf, segmento.

E produza ai_summary: 4 a 6 bullets curtos com perfil do cliente.

Responda APENAS em JSON válido seguindo o schema.`;

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

    const body = await req.json();
    const conversationId = body.conversationId;
    const force = body.force === true;
    if (!conversationId) return json({ error: "conversationId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: conv } = await admin
      .from("qual_conversations")
      .select("id, contact_name, phone, archived")
      .eq("id", conversationId)
      .single();
    if (!conv) return json({ error: "Conversation not found" }, 404);
    if ((conv as any).archived) {
      return json({ ok: true, skipped: "archived" });
    }

    const { data: existingQual } = await admin
      .from("qual_lead_qualification")
      .select("disqualified, last_message_count, last_analyzed_at, criteria")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (existingQual?.disqualified) {
      return json({ ok: true, skipped: "disqualified" });
    }

    const { data: messages } = await admin
      .from("qual_messages")
      .select("direction, content, sent_at, sender_name, media_type, metadata")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true })
      .limit(200);

    if (!messages || messages.length === 0) {
      return json({ ok: true, skipped: "no_messages" });
    }

    // Cost guard: ONLY analyze when there are new messages since last analysis.
    // Conversas paradas nunca são reanalisadas.
    if (!force && existingQual?.last_analyzed_at) {
      const sameCount =
        typeof existingQual.last_message_count === "number" &&
        existingQual.last_message_count === messages.length;
      if (sameCount) {
        return json({ ok: true, skipped: "no_new_messages" });
      }
    }

    const transcript = messages
      .map((m: any) => {
        const who = m.direction === "inbound" ? `CLIENTE` : `OPERADOR`;
        const transcription = m.metadata?.transcription;
        if (m.media_type === "audio" && transcription) {
          return `[${who} 🎤 áudio transcrito] ${transcription}`;
        }
        if (m.media_type && !m.content) {
          return `[${who}] (${m.media_type})`;
        }
        return `[${who}] ${m.content || "(mídia)"}`;
      })
      .join("\n");

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const schema = {
      type: "object",
      properties: {
        criteria: {
          type: "object",
          properties: {
            necessidade: critSchema(),
            decisor: critSchema(),
            prazo: critSchema(),
            capacidade: critSchema(),
          },
          required: ["necessidade", "decisor", "prazo", "capacidade"],
          additionalProperties: false,
        },
        lead_data: {
          type: "object",
          properties: {
            nome: { type: ["string", "null"] },
            empresa: { type: ["string", "null"] },
            cnpj: { type: ["string", "null"] },
            cpf: { type: ["string", "null"] },
            cidade: { type: ["string", "null"] },
            uf: { type: ["string", "null"] },
            segmento: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
        ai_summary: { type: "string" },
      },
      required: ["criteria", "lead_data", "ai_summary"],
      additionalProperties: false,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Contato: ${conv.contact_name || conv.phone}\nTelefone: ${conv.phone}\n\nHISTÓRICO:\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_qualification",
              description: "Salva qualificação extraída do diálogo",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_qualification" } },
      }),
    });

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      if (aiResp.status === 429) return json({ error: "Rate limit. Tente novamente em alguns segundos." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos Lovable AI esgotados." }, 402);
      console.error("AI error", aiResp.status, errTxt);
      return json({ error: `AI error ${aiResp.status}` }, 500);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No tool call returned" }, 500);
    const parsed = JSON.parse(toolCall.function.arguments);

    const criteria = parsed.criteria;
    // Preserve manually-qualified criteria across AI re-analysis
    const existingCriteria = (existingQual?.criteria as any) || {};
    for (const k of ["necessidade", "decisor", "prazo", "capacidade"]) {
      if (existingCriteria[k]?.manual) {
        criteria[k] = existingCriteria[k];
      }
    }
    const score =
      (criteria.necessidade.status === "qualified" ? 1 : 0) +
      (criteria.decisor.status === "qualified" ? 1 : 0) +
      (criteria.prazo.status === "qualified" ? 1 : 0) +
      (criteria.capacidade.status === "qualified" ? 1 : 0);

    await admin
      .from("qual_lead_qualification")
      .upsert(
        {
          conversation_id: conversationId,
          score,
          criteria,
          ai_summary: parsed.ai_summary,
          lead_data: parsed.lead_data || {},
          last_analyzed_at: new Date().toISOString(),
          last_message_count: messages.length,
        },
        { onConflict: "conversation_id" },
      );

    // Update contact name on conversation if extracted
    if (parsed.lead_data?.nome) {
      await admin
        .from("qual_conversations")
        .update({ contact_name: parsed.lead_data.nome })
        .eq("id", conversationId);
    }

    return json({ ok: true, score, criteria, ai_summary: parsed.ai_summary, lead_data: parsed.lead_data });
  } catch (err: any) {
    console.error("qual-analyze-lead error:", err);
    return json({ error: err.message }, 500);
  }
});

function critSchema() {
  return {
    type: "object",
    properties: {
      status: { type: "string", enum: ["pending", "qualified"] },
      confidence: { type: "number" },
      evidence: { type: ["string", "null"] },
      summary: { type: ["string", "null"] },
    },
    required: ["status", "confidence", "evidence", "summary"],
    additionalProperties: false,
  };
}

function json(d: any, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

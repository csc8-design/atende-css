import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QualifyResult {
  interaction_status: "novo" | "sim" | "pendente" | "nao";
  next_step: string;
  observations: string;
  lead_temperature: "quente" | "morno" | "frio";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { leadId, leadIds, background } = await req.json();
    const ids: string[] = leadIds || (leadId ? [leadId] : []);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "leadId or leadIds required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const processAll = async () => {
    for (let idx = 0; idx < ids.length; idx++) {
      const id = ids[idx];
      if (idx > 0) await sleep(1500);
      try {
        const { data: lead } = await supabase
          .from("prospect_leads")
          .select("*")
          .eq("id", id)
          .single();
        if (!lead) { results.push({ id, error: "not found" }); continue; }

        // Find messages from contact via phone (match any conversation linked to a contact with same phone or contact_id)
        let contactId = lead.contact_id;
        if (!contactId) {
          const phoneDigits = (lead.phone || "").replace(/\D/g, "");
          const { data: c } = await supabase
            .from("contacts")
            .select("id")
            .or(`phone.eq.${lead.phone},phone.eq.${phoneDigits},phone.eq.+${phoneDigits}`)
            .limit(1)
            .maybeSingle();
          if (c) contactId = c.id;
        }

        if (!contactId) {
          results.push({ id, skipped: "no contact/conversation" });
          continue;
        }

        const { data: convs } = await supabase
          .from("conversations")
          .select("id")
          .eq("contact_id", contactId);
        const convIds = (convs || []).map(c => c.id);
        if (convIds.length === 0) {
          results.push({ id, skipped: "no conversation" });
          continue;
        }

        const { data: messages } = await supabase
          .from("messages")
          .select("content, sender_type, created_at")
          .in("conversation_id", convIds)
          .eq("sender_type", "contact")
          .not("content", "is", null)
          .order("created_at", { ascending: false })
          .limit(6);

        if (!messages || messages.length === 0) {
          results.push({ id, skipped: "no contact messages" });
          continue;
        }

        const transcript = messages
          .reverse()
          .map((m, i) => `${i + 1}. ${m.content}`)
          .join("\n");

        const systemPrompt = `Você é um SDR especialista em qualificação de leads B2B no setor de máquinas pesadas (CBMaq).
Analise as últimas mensagens enviadas pelo LEAD e classifique. Retorne APENAS JSON válido sem markdown:

{
  "interaction_status": "sim" | "pendente" | "nao",
  "lead_temperature": "quente" | "morno" | "frio",
  "next_step": "string curta (uma das: Enviar proposta comercial, Análise de crédito, Visita ao cliente, Aguardar retorno, Apresentar estoque, Negociação de valores, Fechar contrato, Sem interesse no momento)",
  "observations": "string com 1-2 frases resumindo interesse, intenção de compra e pontos-chave"
}

Critérios:
- "sim" = lead respondeu demonstrando interesse claro
- "pendente" = lead respondeu mas com dúvidas/sem decisão
- "nao" = sem interesse, recusou ou pediu para parar
- "quente" = pronto para comprar, urgência, pediu proposta
- "morno" = interesse genuíno mas sem urgência
- "frio" = pouco engajamento ou negativo`;

        let aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Lead: ${lead.company_name} (${lead.contact_name || "—"})\nSegmento: ${lead.segment || "—"}\n\nÚltimas mensagens do lead:\n${transcript}` },
            ],
            temperature: 0.2,
            max_tokens: 400,
          }),
        });

        // Retry on 429
        let retries = 0;
        while (aiRes.status === 429 && retries < 3) {
          await sleep(3000 * (retries + 1));
          retries++;
          aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Lead: ${lead.company_name} (${lead.contact_name || "—"})\nSegmento: ${lead.segment || "—"}\n\nÚltimas mensagens do lead:\n${transcript}` },
              ],
              temperature: 0.2,
              max_tokens: 400,
            }),
          });
        }


        if (!aiRes.ok) {
          results.push({ id, error: `AI ${aiRes.status}` });
          continue;
        }

        const aiData = await aiRes.json();
        let raw = aiData.choices?.[0]?.message?.content || "";
        raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let parsed: QualifyResult;
        try {
          parsed = JSON.parse(raw);
        } catch {
          results.push({ id, error: "parse failed", raw });
          continue;
        }

        const obsStamp = `[IA ${new Date().toLocaleDateString("pt-BR")}] ${parsed.lead_temperature?.toUpperCase()}: ${parsed.observations}`;
        const newObs = lead.observations
          ? `${obsStamp}\n---\n${lead.observations}`
          : obsStamp;

        await supabase
          .from("prospect_leads")
          .update({
            interaction_status: parsed.interaction_status,
            next_step: parsed.next_step,
            observations: newObs,
            last_interaction_at: new Date().toISOString(),
          })
          .eq("id", id);

        results.push({ id, ok: true, ...parsed });
      } catch (e: any) {
        results.push({ id, error: e.message });
      }
    }
    };

    if (background) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processAll());
      return new Response(JSON.stringify({ success: true, queued: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await processAll();
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("qualify-prospect-lead error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

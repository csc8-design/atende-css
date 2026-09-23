import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type LeadIn = { id: string; text: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, limit = 500, source = "inbox", leads: clientLeads, context_hint } = body || {};

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Consulta inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    let leads: { id: string; text: string }[] = [];

    if (source === "client_data" && Array.isArray(clientLeads)) {
      leads = (clientLeads as LeadIn[])
        .filter((l) => l && l.id && typeof l.text === "string")
        .slice(0, 1000);
    } else {
      // modo inbox (padrão): busca conversas + contatos
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: convs, error } = await supabase
        .from("conversations")
        .select(
          "id, contact_id, last_message_at, ai_summary, subject, channel, contacts!inner(id,name,phone,email,company_name)"
        )
        .not("last_message_at", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(Math.min(limit, 1000));
      if (error) throw error;

      const seen = new Set<string>();
      (convs || []).forEach((c: any) => {
        if (!c.contact_id || seen.has(c.contact_id)) return;
        seen.add(c.contact_id);
        const name = c.contacts?.name ?? "";
        const company = c.contacts?.company_name ?? "";
        const interest = c.ai_summary ?? c.subject ?? "";
        leads.push({
          id: String(c.contact_id),
          text: `${name} | ${company} | ${interest}`,
        });
      });
    }

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ ids: [], contact_ids: [], reasoning: "Nenhum lead disponível para buscar.", total_scanned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const corpus = leads.map((l, i) => `${i}|${l.text}`).join("\n");

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você filtra leads. Receberá uma lista 'index|texto' (texto contém nome, empresa, interesse, produto, etc) e uma pergunta em português. Retorne via tool_call apenas os índices que combinam. Seja generoso com sinônimos (ex: 'retroescavadeira' inclui 'retro', 'escavadeira', 'JCB'; 'peças' inclui 'reposição', 'filtro', 'óleo'). Se nada combinar, retorne lista vazia." +
                (context_hint ? ` Contexto: ${context_hint}` : ""),
            },
            { role: "user", content: `Pergunta: ${query}\n\nLeads:\n${corpus}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_matches",
                description: "Retorna os índices dos leads que combinam",
                parameters: {
                  type: "object",
                  properties: {
                    indices: { type: "array", items: { type: "integer" } },
                    reasoning: { type: "string" },
                  },
                  required: ["indices"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_matches" } },
        }),
      }
    );

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429)
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiRes.status === 402)
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { indices: [] };
    const indices: number[] = Array.isArray(args.indices) ? args.indices : [];
    const matchedIds = indices.map((i) => leads[i]?.id).filter((x): x is string => !!x);

    return new Response(
      JSON.stringify({
        ids: matchedIds,
        contact_ids: matchedIds, // compat
        reasoning: args.reasoning ?? null,
        total_scanned: leads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-search-leads error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

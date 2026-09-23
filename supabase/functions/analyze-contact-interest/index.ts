// Analisa as conversas de um contato e resume o INTERESSE dele em uma frase curta.
// Ex: "trator Mahindra 2025", "peças de pá carregadeira", "peça de Bobcat"
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você analisa conversas de WhatsApp da CBMaq (concessionária de máquinas agrícolas e de construção: tratores, pás carregadeiras, retroescavadeiras, minicarregadeiras Bobcat, Lovol, Mahindra, etc.) e resume EXATAMENTE o interesse do cliente.

REGRAS DO CAMPO "interest":
- Frase MUITO curta, minúscula quando genérico, no formato de exemplo:
  "trator Lovol", "trator Mahindra 2025", "peças de trator Mahindra 2025", "peças de pá carregadeira", "peça de Bobcat", "peça de Lovol", "retroescavadeira Randon", "manutenção de trator Lovol"
- Se houver vários modelos, liste separados por vírgula (máx 3).
- Diga o que ele quer (compra de máquina / peça / serviço) + marca e/ou modelo e/ou tipo de máquina, quando existirem.
- NUNCA invente marca ou modelo. Use somente o que aparece na conversa.
- Se não houver informação suficiente, retorne interest = null.
- Máximo 80 caracteres. Sem pontuação final, sem frases explicativas.

interest_type: "maquina" (compra de máquina), "pecas", "servico" ou "outro"/null.
brands: marcas citadas. models: modelos citados.

TAMBÉM extraia os dados cadastrais do cliente, SOMENTE se aparecerem explicitamente na conversa (nunca invente):
- name: nome completo da pessoa
- company_name: nome da empresa
- cnpj: CNPJ ou CPF (apenas dígitos)
- email: e-mail
- city: cidade | state: UF (2 letras maiúsculas) | zip_code: CEP (formato 00000-000)
- address: endereço (rua, número, bairro) se mencionado
- segment: segmento/ramo de atuação (ex: agricultura, construção civil, transporte, locação)
- is_reseller: true se ele diz ser revendedor/lojista, false se diz que é consumidor final, null se não souber
- desired_equipment: máquina/veículo/equipamento envolvido. Se o cliente quer COMPRAR uma máquina, descreva a máquina pretendida (ex: "trator 75cv para lavoura de café"). Se o cliente procura PEÇA, informe a máquina à qual a peça se aplica, com marca/modelo/ano quando citados (ex: "trator Mahindra 2025", "pá carregadeira Lovol 936", "minicarregadeira Bobcat S570"). Nunca invente marca/modelo.
- part_of_interest: peça específica de interesse (ex: "bomba hidráulica", "filtro de óleo")
Use null em qualquer campo sem informação clara.

Responda apenas via a função save_interest.`;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const contactIds: string[] = Array.isArray(body.contactIds)
      ? body.contactIds.slice(0, 40)
      : body.contactId
      ? [body.contactId]
      : [];
    const force = body.force === true;
    if (!contactIds.length) return json({ error: "contactIds required" }, 400);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await admin
      .from("contact_interests")
      .select("contact_id, last_message_at")
      .in("contact_id", contactIds);
    const existingMap = new Map((existing || []).map((e: any) => [e.contact_id, e]));

    const results: any[] = [];
    let analyzed = 0;

    for (const contactId of contactIds) {
      try {
        const { data: convs } = await admin
          .from("conversations")
          .select("id, last_message_at")
          .eq("contact_id", contactId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5);
        if (!convs?.length) { results.push({ contactId, skipped: "no_conversation" }); continue; }

        const lastMsgAt = convs[0].last_message_at;
        const prev = existingMap.get(contactId);
        if (!force && prev && prev.last_message_at && lastMsgAt && prev.last_message_at === lastMsgAt) {
          results.push({ contactId, skipped: "up_to_date" });
          continue;
        }

        const { data: msgs } = await admin
          .from("messages")
          .select("sender_type, content, message_type, metadata, created_at")
          .in("conversation_id", convs.map((c: any) => c.id))
          .order("created_at", { ascending: false })
          .limit(120);
        const ordered = (msgs || []).slice().reverse();
        const transcript = ordered
          .map((m: any) => {
            const who = m.sender_type === "contact" ? "CLIENTE" : m.sender_type === "agent" ? "AGENTE" : "SISTEMA";
            const t = (m.metadata as any)?.transcription;
            if (t) return `[${who} 🎤] ${t}`;
            if (!m.content) return `[${who}] (${m.message_type})`;
            return `[${who}] ${m.content}`;
          })
          .filter(Boolean)
          .join("\n")
          .slice(-12000);

        if (!transcript.trim()) { results.push({ contactId, skipped: "no_messages" }); continue; }

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `HISTÓRICO:\n${transcript}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "save_interest",
                description: "Salva o interesse do cliente",
                parameters: {
                  type: "object",
                  properties: {
                    interest: { type: ["string", "null"] },
                    interest_type: { type: ["string", "null"], enum: ["maquina", "pecas", "servico", "outro", null] },
                    brands: { type: "array", items: { type: "string" } },
                    models: { type: "array", items: { type: "string" } },
                    name: { type: ["string", "null"] },
                    company_name: { type: ["string", "null"] },
                    cnpj: { type: ["string", "null"] },
                    email: { type: ["string", "null"] },
                    city: { type: ["string", "null"] },
                    state: { type: ["string", "null"] },
                    zip_code: { type: ["string", "null"] },
                    address: { type: ["string", "null"] },
                    segment: { type: ["string", "null"] },
                    is_reseller: { type: ["boolean", "null"] },
                    desired_equipment: { type: ["string", "null"] },
                    part_of_interest: { type: ["string", "null"] },
                  },
                  required: ["interest", "interest_type", "brands", "models"],
                  additionalProperties: false,

                },
              },
            }],
            tool_choice: { type: "function", function: { name: "save_interest" } },
          }),
        });

        if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes.", partial: results }, 429);
        if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados.", partial: results }, 402);
        if (!aiResp.ok) {
          console.error("AI error", aiResp.status, await aiResp.text());
          results.push({ contactId, error: `ai_${aiResp.status}` });
          continue;
        }

        const aiJson = await aiResp.json();
        const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
        if (!tc) { results.push({ contactId, skipped: "no_tool_call" }); continue; }
        const parsed = JSON.parse(tc.function.arguments);

        await admin.from("contact_interests").upsert({
          contact_id: contactId,
          interest: parsed.interest || null,
          interest_type: parsed.interest_type || null,
          brands: parsed.brands || [],
          models: parsed.models || [],
          last_analyzed_at: new Date().toISOString(),
          last_message_at: lastMsgAt,
        }, { onConflict: "contact_id" });

        // Preenche campos cadastrais vazios do contato (nunca sobrescreve dados existentes)
        const { data: contact } = await admin
          .from("contacts")
          .select("name, company_name, cnpj, email, city, state, zip_code, address, segment, is_reseller, desired_equipment, part_of_interest, interest_type")
          .eq("id", contactId)
          .maybeSingle();

        if (contact) {
          const clean = (v: any) => {
            if (typeof v !== "string") return null;
            const s = v.trim();
            return s && s.toLowerCase() !== "null" ? s : null;
          };
          const isEmpty = (v: any) => v === null || v === undefined || (typeof v === "string" && !v.trim());
          const patch: Record<string, any> = {};
          const candidates: Record<string, any> = {
            name: clean(parsed.name),
            company_name: clean(parsed.company_name),
            cnpj: clean(parsed.cnpj)?.replace(/\D/g, "") || null,
            email: clean(parsed.email),
            city: clean(parsed.city),
            state: clean(parsed.state)?.toUpperCase().slice(0, 2) || null,
            zip_code: (() => { const d = clean(parsed.zip_code)?.replace(/\D/g, ""); return d && d.length === 8 ? `${d.slice(0,5)}-${d.slice(5)}` : null; })(),
            address: clean(parsed.address),
            segment: clean(parsed.segment),
            desired_equipment: clean(parsed.desired_equipment)
              || [clean(parsed.brands?.[0]), clean(parsed.models?.[0])].filter(Boolean).join(" ") || null,
            part_of_interest: clean(parsed.part_of_interest),
            interest_type: clean(parsed.interest_type),
          };
          for (const [k, v] of Object.entries(candidates)) {
            if (v && isEmpty((contact as any)[k])) patch[k] = v;
          }
          if (typeof parsed.is_reseller === "boolean" && (contact as any).is_reseller === null) {
            patch.is_reseller = parsed.is_reseller;
          }
          if (Object.keys(patch).length) {
            await admin.from("contacts").update(patch).eq("id", contactId);
          }
        }

        analyzed++;
        results.push({ contactId, interest: parsed.interest });
      } catch (e: any) {
        console.error("contact error", contactId, e?.message);
        results.push({ contactId, error: e?.message });
      }
    }


    return json({ ok: true, analyzed, results });
  } catch (err: any) {
    console.error("analyze-contact-interest error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(d: any, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

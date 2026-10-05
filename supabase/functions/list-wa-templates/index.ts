import { getMetaCreds } from "../_shared/meta-creds.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const creds = await getMetaCreds();
    const TOKEN = creds.token!;
    // Templates belong to the WABA of the connected number (Settings > Meta).
    const wabaId = creds.businessAccountId;
    if (!wabaId) {
      return new Response(JSON.stringify({ error: "Informe o ID da conta WhatsApp Business na aba Meta." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tplRes = await fetch(
      `https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=200`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const tplJson = await tplRes.json();

    // Compact summary
    const summary = (tplJson?.data || []).map((t: any) => {
      const body = (t.components || []).find((c: any) => c.type === "BODY");
      const text: string = body?.text || "";
      const vars = (text.match(/\{\{\d+\}\}/g) || []).length;
      return {
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        variables: vars,
        body_preview: text.slice(0, 160),
      };
    });

    return new Response(
      JSON.stringify({ wabaId, count: summary.length, templates: summary, raw: tplJson }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

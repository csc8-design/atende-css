const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
    const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

    // Get WABA ID from the phone number node directly
    const phoneRes = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_ID}?fields=whatsapp_business_account{id,name}&access_token=${TOKEN}`
    );
    const phoneJson = await phoneRes.json();
    let wabaId: string | undefined =
      phoneJson?.whatsapp_business_account?.id;

    // Fallback: webhook entry id we know is 1586879535793359
    if (!wabaId) wabaId = "1586879535793359";

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

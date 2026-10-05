import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const mask = (v?: string | null) => (v ? `${"•".repeat(8)}${v.slice(-6)}` : null);
const clean = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") || "";
  const { data: u } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "Não autenticado" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "status";
  const { data: row } = await admin.from("meta_credentials").select("*").eq("id", 1).maybeSingle();
  const token = row?.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = row?.phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (action === "status") {
    return json({
      callback_url: `${url}/functions/v1/whatsapp-webhook`,
      token_masked: mask(token),
      token_source: row?.access_token ? "settings" : token ? "secret" : null,
      phone_number_id: phoneId || "",
      business_account_id: row?.business_account_id || "",
      app_id: row?.app_id || "",
      verify_token: row?.verify_token || Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "",
      updated_at: row?.updated_at || null,
    });
  }

  if (action === "save") {
    const patch: Record<string, unknown> = { id: 1, updated_by: u.user.id, updated_at: new Date().toISOString() };
    const t = clean(body.access_token, 2000); if (t) patch.access_token = t;
    for (const k of ["phone_number_id", "business_account_id", "app_id", "verify_token"]) {
      if (typeof body[k] === "string") patch[k] = body[k].trim().slice(0, 200) || null;
    }
    const { error } = await admin.from("meta_credentials").upsert(patch);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "test") {
    if (!token || !phoneId) return json({ ok: false, error: "Token ou ID do número não configurado" });
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: d?.error?.message || `HTTP ${r.status}` });
    let expires: number | null = null;
    const appId = row?.app_id;
    try {
      const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
      const dj = await dbg.json();
      expires = dj?.data?.expires_at ?? null;
    } catch (_) { /* ignore */ }
    return json({ ok: true, phone: d.display_phone_number, name: d.verified_name, quality: d.quality_rating, expires_at: expires, app_id: appId });
  }

  return json({ error: "Ação inválida" }, 400);
});

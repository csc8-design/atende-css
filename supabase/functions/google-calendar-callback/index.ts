import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // user_id
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return new Response(redirectHTML("Erro na autorização do Google: " + error, false), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !state) {
      return new Response(redirectHTML("Parâmetros inválidos", false), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Build redirect URI (same as what was used to initiate)
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange error:", tokenData);
      return new Response(redirectHTML("Erro ao obter token do Google: " + (tokenData.error_description || tokenData.error), false), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Upsert tokens
    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .upsert({
        user_id: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || "",
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("DB error saving tokens:", dbError);
      return new Response(redirectHTML("Erro ao salvar credenciais", false), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(redirectHTML("Google Agenda conectado com sucesso! Você pode fechar esta janela.", true), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("google-calendar-callback error:", err);
    return new Response(redirectHTML("Erro interno: " + (err.message || ""), false), {
      headers: { "Content-Type": "text/html" },
    });
  }
});

function redirectHTML(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Google Calendar</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
  .card { text-align: center; padding: 40px; border-radius: 16px; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  .msg { font-size: 16px; color: #374151; margin-bottom: 20px; }
  .btn { padding: 10px 24px; border-radius: 8px; border: none; background: #2563eb; color: white; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <div class="msg">${message}</div>
    <button class="btn" onclick="window.close()">Fechar</button>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: "google-calendar-connected", success: ${success} }, "*");
    }
    setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>`;
}

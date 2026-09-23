import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(supabaseAdmin: any, userId: string, refreshToken: string): Promise<string | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("Token refresh failed:", data);
    return null;
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  await supabaseAdmin
    .from("google_calendar_tokens")
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token;
}

async function getValidToken(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) return null;

  // Check if expired (with 5 min buffer)
  const expiresAt = new Date(tokenRow.token_expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    return await refreshAccessToken(supabaseAdmin, userId, tokenRow.refresh_token);
  }

  return tokenRow.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { action, userId, scheduleId, schedule } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidToken(supabaseAdmin, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected", code: "NOT_CONNECTED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calendarId = "primary";
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "create": {
        if (!schedule) throw new Error("schedule is required for create");

        const startDate = new Date(schedule.scheduled_at);
        const endDate = new Date(startDate.getTime() + (schedule.duration_minutes || 30) * 60000);

        const event = {
          summary: schedule.title,
          description: schedule.description || "",
          start: { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
        };

        const res = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error("Google create event error:", errData);
          throw new Error("Failed to create Google event");
        }

        const created = await res.json();

        // Save google_event_id on schedule
        if (scheduleId) {
          await supabaseAdmin
            .from("schedules")
            .update({ google_event_id: created.id })
            .eq("id", scheduleId);
        }

        return new Response(JSON.stringify({ success: true, googleEventId: created.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        if (!schedule || !scheduleId) throw new Error("schedule and scheduleId required");

        // Get google_event_id
        const { data: sched } = await supabaseAdmin
          .from("schedules")
          .select("google_event_id")
          .eq("id", scheduleId)
          .single();

        if (!sched?.google_event_id) {
          return new Response(JSON.stringify({ error: "No linked Google event" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const startDate = new Date(schedule.scheduled_at);
        const endDate = new Date(startDate.getTime() + (schedule.duration_minutes || 30) * 60000);

        const event = {
          summary: schedule.title,
          description: schedule.description || "",
          start: { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
        };

        const res = await fetch(`${baseUrl}/${sched.google_event_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(event),
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error("Google update event error:", errData);
          throw new Error("Failed to update Google event");
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (!scheduleId) throw new Error("scheduleId required");

        const { data: sched } = await supabaseAdmin
          .from("schedules")
          .select("google_event_id")
          .eq("id", scheduleId)
          .single();

        if (!sched?.google_event_id) {
          return new Response(JSON.stringify({ success: true, message: "No linked event" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const res = await fetch(`${baseUrl}/${sched.google_event_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        // 404 is ok (already deleted)
        if (!res.ok && res.status !== 404) {
          console.error("Google delete event error:", res.status);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync-from-google": {
        // Fetch upcoming events from Google and return them
        const now = new Date().toISOString();
        const maxDate = new Date(Date.now() + 30 * 86400000).toISOString();

        const res = await fetch(
          `${baseUrl}?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxDate)}&singleEvents=true&orderBy=startTime&maxResults=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok) {
          const errData = await res.json();
          console.error("Google list events error:", errData);
          throw new Error("Failed to fetch Google events");
        }

        const data = await res.json();
        const events = (data.items || []).map((e: any) => ({
          googleEventId: e.id,
          title: e.summary || "Sem título",
          description: e.description || "",
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          htmlLink: e.htmlLink,
        }));

        return new Response(JSON.stringify({ success: true, events }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-connection": {
        return new Response(JSON.stringify({ connected: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("google-calendar-sync error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

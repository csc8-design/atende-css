import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    
    const { data } = await supabase
      .from("google_calendar_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setConnected(!!data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(() => {
    if (!user) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-callback`;
    const scope = "https://www.googleapis.com/auth/calendar.events";

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", user.id);

    const popup = window.open(authUrl.toString(), "google-calendar-auth", "width=500,height=600");

    // Listen for callback
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "google-calendar-connected") {
        if (event.data.success) {
          setConnected(true);
        }
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);

    // Fallback: check periodically
    const interval = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(interval);
        window.removeEventListener("message", handler);
        await checkConnection();
      }
    }, 1000);
  }, [user, checkConnection]);

  const disconnect = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", user.id);
    setConnected(false);
  }, [user]);

  const syncToGoogle = useCallback(async (scheduleId: string, schedule: any) => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "create", userId: user.id, scheduleId, schedule },
      });
      if (error) throw error;
      return data;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const updateGoogleEvent = useCallback(async (scheduleId: string, schedule: any) => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "update", userId: user.id, scheduleId, schedule },
      });
      if (error) throw error;
      return data;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const deleteGoogleEvent = useCallback(async (scheduleId: string) => {
    if (!user) return;
    try {
      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", userId: user.id, scheduleId },
      });
    } catch (err) {
      console.error("Delete Google event error:", err);
    }
  }, [user]);

  const fetchGoogleEvents = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync-from-google", userId: user.id },
      });
      if (error) throw error;
      return data?.events || [];
    } catch (err) {
      console.error("Fetch Google events error:", err);
      return [];
    }
  }, [user]);

  return {
    connected,
    loading,
    syncing,
    connect,
    disconnect,
    syncToGoogle,
    updateGoogleEvent,
    deleteGoogleEvent,
    fetchGoogleEvents,
  };
}

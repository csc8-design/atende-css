import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Schedule {
  id: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  agent_id: string;
  department_id: string | null;
  schedule_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  google_event_id?: string | null;
  contact?: { id: string; name: string; phone: string } | null;
  agent_profile?: { full_name: string } | null;
}

export function useSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("schedules")
      .select("*, contacts(id, name, phone)")
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("Fetch schedules error:", error);
    }

    // Fetch agent profiles
    const items = (data as any[]) || [];
    if (items.length > 0) {
      const agentIds = [...new Set(items.map((s) => s.agent_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", agentIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      items.forEach((item) => {
        item.contact = item.contacts;
        item.agent_profile = profileMap.get(item.agent_id) || null;
        delete item.contacts;
      });
    }

    setSchedules(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const createSchedule = async (data: {
    title: string;
    description?: string;
    contact_id?: string | null;
    agent_id: string;
    department_id?: string | null;
    schedule_type: string;
    scheduled_at: string;
    duration_minutes: number;
    notes?: string;
  }) => {
    if (!user) return null;
    const { data: result, error } = await supabase
      .from("schedules")
      .insert({ ...data, created_by: user.id })
      .select()
      .single();

    if (error) {
      console.error("Create schedule error:", error);
      return null;
    }

    // Try to sync with Google Calendar (fire and forget)
    if (result) {
      syncToGoogleCalendar(result.id, data).catch(() => {});
    }

    await fetchSchedules();
    return result;
  };

  const updateSchedule = async (id: string, updates: Partial<Schedule>) => {
    const { error } = await supabase
      .from("schedules")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Update schedule error:", error);
      return false;
    }
    await fetchSchedules();
    return true;
  };

  const deleteSchedule = async (id: string) => {
    // Try to delete from Google Calendar first
    deleteFromGoogleCalendar(id).catch(() => {});

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete schedule error:", error);
      return false;
    }
    await fetchSchedules();
    return true;
  };

  // Google Calendar sync helpers
  const syncToGoogleCalendar = async (scheduleId: string, schedule: any) => {
    if (!user) return;
    try {
      // Check if user has Google Calendar connected
      const { data: token } = await supabase
        .from("google_calendar_tokens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!token) return; // Not connected, skip silently

      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "create", userId: user.id, scheduleId, schedule },
      });
    } catch (err) {
      console.error("Google Calendar sync error:", err);
    }
  };

  const deleteFromGoogleCalendar = async (scheduleId: string) => {
    if (!user) return;
    try {
      const { data: token } = await supabase
        .from("google_calendar_tokens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!token) return;

      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", userId: user.id, scheduleId },
      });
    } catch (err) {
      console.error("Google Calendar delete error:", err);
    }
  };

  return { schedules, loading, createSchedule, updateSchedule, deleteSchedule, refetch: fetchSchedules };
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AgentStatus {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_online: boolean;
  active_conversations: number;
  avg_response_time_min: number | null;
  department_names: string[];
  resolved_today: number;
  total_messages_today: number;
  avg_service_duration_min: number | null;
  satisfaction_avg: number | null;
  satisfaction_count: number;
}

interface MonitoringKPIs {
  totalOpenConversations: number;
  totalPendingConversations: number;
  totalResolvedToday: number;
  totalClosedToday: number;
  avgResponseTimeMin: number;
  avgServiceDurationMin: number;
  satisfactionAvg: number | null;
  totalMessagesToday: number;
  conversationsByChannel: { channel: string; count: number }[];
  hourlyVolume: { hour: number; count: number }[];
}

export function useMonitoring() {
  const { user, isAdmin, isManager } = useAuth();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [kpis, setKpis] = useState<MonitoringKPIs>({
    totalOpenConversations: 0,
    totalPendingConversations: 0,
    totalResolvedToday: 0,
    totalClosedToday: 0,
    avgResponseTimeMin: 0,
    avgServiceDurationMin: 0,
    satisfactionAvg: null,
    totalMessagesToday: 0,
    conversationsByChannel: [],
    hourlyVolume: [],
  });
  const [loading, setLoading] = useState(true);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);

  const fetchUserDepartments = useCallback(async () => {
    if (!user) return [];
    if (isAdmin) return []; // admin sees all
    const { data } = await supabase
      .from("agent_departments")
      .select("department_id")
      .eq("agent_id", user.id);
    const depts = data?.map((d) => d.department_id) || [];
    setUserDepartments(depts);
    return depts;
  }, [user, isAdmin]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const depts = await fetchUserDepartments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Fetch conversations with department filter for managers
    let convoQuery = supabase
      .from("conversations")
      .select("id, status, channel, assigned_agent_id, department_id, created_at, closed_at, last_message_at");

    if (isManager && !isAdmin && depts.length > 0) {
      convoQuery = convoQuery.in("department_id", depts);
    }

    const { data: conversations } = await convoQuery;
    const convos = conversations || [];

    const openConvos = convos.filter((c) => c.status === "open");
    const pendingConvos = convos.filter((c) => c.status === "pending");
    const resolvedToday = convos.filter(
      (c) => c.status === "resolved" && c.closed_at && c.closed_at >= todayISO
    );
    const closedToday = convos.filter(
      (c) => c.status === "closed" && c.closed_at && c.closed_at >= todayISO
    );

    // Channel distribution
    const channelMap: Record<string, number> = {};
    convos.forEach((c) => {
      channelMap[c.channel] = (channelMap[c.channel] || 0) + 1;
    });
    const conversationsByChannel = Object.entries(channelMap).map(([channel, count]) => ({
      channel,
      count,
    }));

    // Messages today
    let msgQuery = supabase
      .from("messages")
      .select("id, created_at, conversation_id")
      .gte("created_at", todayISO);
    const { data: messagesToday } = await msgQuery;
    const msgs = messagesToday || [];

    // Hourly volume
    const hourlyMap: Record<number, number> = {};
    msgs.forEach((m) => {
      const hour = new Date(m.created_at).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    });
    const hourlyVolume = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyMap[i] || 0,
    }));

    // Avg service duration (for resolved/closed today)
    const durations = [...resolvedToday, ...closedToday]
      .filter((c) => c.created_at && c.closed_at)
      .map((c) => (new Date(c.closed_at!).getTime() - new Date(c.created_at).getTime()) / 60000);
    const avgServiceDurationMin =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    // Satisfaction today
    let satQuery = supabase
      .from("satisfaction_ratings")
      .select("rating")
      .not("rating", "is", null)
      .gte("created_at", todayISO);
    const { data: ratings } = await satQuery;
    const satisfactionAvg =
      ratings && ratings.length > 0
        ? Math.round((ratings.reduce((a, r) => a + (r.rating || 0), 0) / ratings.length) * 10) / 10
        : null;

    // Fetch agents with their active conversations
    let agentsQuery = supabase.from("profiles").select("user_id, full_name, avatar_url, is_active").eq("is_active", true);
    const { data: profiles } = await agentsQuery;

    // Get agent departments
    const { data: agentDepts } = await supabase.from("agent_departments").select("agent_id, department_id, departments(name)");

    // Get department names
    const agentDeptMap: Record<string, string[]> = {};
    (agentDepts || []).forEach((ad: any) => {
      if (!agentDeptMap[ad.agent_id]) agentDeptMap[ad.agent_id] = [];
      if (ad.departments?.name) agentDeptMap[ad.agent_id].push(ad.departments.name);
    });

    // Filter agents by department for managers
    let filteredProfiles = profiles || [];
    if (isManager && !isAdmin && depts.length > 0) {
      const agentIdsInDept = new Set(
        (agentDepts || [])
          .filter((ad: any) => depts.includes(ad.department_id))
          .map((ad: any) => ad.agent_id)
      );
      filteredProfiles = filteredProfiles.filter((p) => agentIdsInDept.has(p.user_id));
    }

    // Per-agent resolved today
    const agentResolvedMap: Record<string, number> = {};
    [...resolvedToday, ...closedToday].forEach((c) => {
      if (c.assigned_agent_id) {
        agentResolvedMap[c.assigned_agent_id] = (agentResolvedMap[c.assigned_agent_id] || 0) + 1;
      }
    });

    // Per-agent messages today
    const agentMsgMap: Record<string, number> = {};
    // We need sender_id from messages - fetch agent messages today
    const { data: agentMsgsToday } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("sender_type", "agent")
      .gte("created_at", todayISO)
      .not("sender_id", "is", null);
    (agentMsgsToday || []).forEach((m: any) => {
      if (m.sender_id) {
        agentMsgMap[m.sender_id] = (agentMsgMap[m.sender_id] || 0) + 1;
      }
    });

    // Per-agent avg service duration
    const agentDurationMap: Record<string, number[]> = {};
    [...resolvedToday, ...closedToday]
      .filter((c) => c.assigned_agent_id && c.created_at && c.closed_at)
      .forEach((c) => {
        const dur = (new Date(c.closed_at!).getTime() - new Date(c.created_at).getTime()) / 60000;
        if (!agentDurationMap[c.assigned_agent_id!]) agentDurationMap[c.assigned_agent_id!] = [];
        agentDurationMap[c.assigned_agent_id!].push(dur);
      });

    // Per-agent satisfaction
    const { data: allRatingsToday } = await supabase
      .from("satisfaction_ratings")
      .select("agent_id, rating")
      .not("rating", "is", null)
      .gte("created_at", todayISO);
    const agentSatMap: Record<string, number[]> = {};
    (allRatingsToday || []).forEach((r: any) => {
      if (r.agent_id) {
        if (!agentSatMap[r.agent_id]) agentSatMap[r.agent_id] = [];
        agentSatMap[r.agent_id].push(r.rating);
      }
    });

    const agentStatuses: AgentStatus[] = filteredProfiles.map((p) => {
      const activeConvos = openConvos.filter((c) => c.assigned_agent_id === p.user_id).length;
      const durs = agentDurationMap[p.user_id] || [];
      const sats = agentSatMap[p.user_id] || [];
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        is_online: activeConvos > 0,
        active_conversations: activeConvos,
        avg_response_time_min: null,
        department_names: agentDeptMap[p.user_id] || [],
        resolved_today: agentResolvedMap[p.user_id] || 0,
        total_messages_today: agentMsgMap[p.user_id] || 0,
        avg_service_duration_min: durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
        satisfaction_avg: sats.length > 0 ? Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 10) / 10 : null,
        satisfaction_count: sats.length,
      };
    });

    // Sort: online/active first
    agentStatuses.sort((a, b) => b.active_conversations - a.active_conversations);

    setAgents(agentStatuses);
    setKpis({
      totalOpenConversations: openConvos.length,
      totalPendingConversations: pendingConvos.length,
      totalResolvedToday: resolvedToday.length,
      totalClosedToday: closedToday.length,
      avgResponseTimeMin: 0,
      avgServiceDurationMin,
      satisfactionAvg,
      totalMessagesToday: msgs.length,
      conversationsByChannel,
      hourlyVolume,
    });
    setLoading(false);
  }, [user, isAdmin, isManager, fetchUserDepartments]);

  useEffect(() => {
    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    // Realtime subscription
    const channel = supabase
      .channel("monitoring-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchData())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return { agents, kpis, loading, refetch: fetchData };
}

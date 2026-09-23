import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReportStats {
  messagesToday: number;
  avgResponseTime: string;
  activeAgents: number;
  avgSatisfaction: number;
}

interface HourlyData {
  hour: string;
  messages: number;
}

interface ChannelData {
  name: string;
  value: number;
  color: string;
}

interface AgentPerformance {
  name: string;
  resolved: number;
  avgTime: string;
  satisfaction: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "hsl(var(--channel-whatsapp))",
  instagram: "hsl(var(--channel-instagram))",
  telegram: "hsl(var(--channel-telegram))",
  webchat: "hsl(var(--channel-webchat))",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  webchat: "Webchat",
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function useReports(dateRange: { start: Date; end: Date }) {
  const [stats, setStats] = useState<ReportStats>({
    messagesToday: 0,
    avgResponseTime: "--",
    activeAgents: 0,
    avgSatisfaction: 0,
  });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Messages in range
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, created_at, sender_type, sender_id, conversation_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      const messages = msgs || [];

      // 2. Conversations in range (resolved/closed)
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, channel, assigned_agent_id, status, created_at, closed_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      const conversations = convs || [];

      // 3. Satisfaction ratings in range
      const { data: ratings } = await supabase
        .from("satisfaction_ratings")
        .select("rating, agent_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .not("rating", "is", null);

      const sats = ratings || [];

      // 4. Profiles for agent names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        profileMap[p.user_id] = p.full_name;
      });

      // === Stats ===
      const messagesToday = messages.length;

      // Avg response time: time between contact msg and first agent reply in same conversation
      const contactMsgsByConv: Record<string, Date[]> = {};
      const agentMsgsByConv: Record<string, Date[]> = {};
      messages.forEach((m) => {
        const dt = new Date(m.created_at);
        if (m.sender_type === "contact") {
          if (!contactMsgsByConv[m.conversation_id]) contactMsgsByConv[m.conversation_id] = [];
          contactMsgsByConv[m.conversation_id].push(dt);
        } else if (m.sender_type === "agent") {
          if (!agentMsgsByConv[m.conversation_id]) agentMsgsByConv[m.conversation_id] = [];
          agentMsgsByConv[m.conversation_id].push(dt);
        }
      });

      let totalResponseMs = 0;
      let responseCount = 0;
      Object.keys(contactMsgsByConv).forEach((convId) => {
        const contactMsgs = contactMsgsByConv[convId]?.sort((a, b) => a.getTime() - b.getTime()) || [];
        const agentMsgs = agentMsgsByConv[convId]?.sort((a, b) => a.getTime() - b.getTime()) || [];
        contactMsgs.forEach((ct) => {
          const reply = agentMsgs.find((at) => at.getTime() > ct.getTime());
          if (reply) {
            totalResponseMs += reply.getTime() - ct.getTime();
            responseCount++;
          }
        });
      });

      const avgResponseTime = responseCount > 0 ? formatDuration(totalResponseMs / responseCount) : "--";

      // Active agents (unique agents who sent messages)
      const activeAgentIds = new Set(
        messages.filter((m) => m.sender_type === "agent" && m.sender_id).map((m) => m.sender_id)
      );

      // Avg satisfaction
      const avgSat = sats.length > 0
        ? Number((sats.reduce((sum, r) => sum + (r.rating || 0), 0) / sats.length).toFixed(1))
        : 0;

      setStats({
        messagesToday: messagesToday,
        avgResponseTime,
        activeAgents: activeAgentIds.size,
        avgSatisfaction: avgSat,
      });

      // === Hourly chart ===
      const hourBuckets: Record<string, number> = {};
      for (let h = 0; h < 24; h++) {
        hourBuckets[`${h.toString().padStart(2, "0")}h`] = 0;
      }
      messages.forEach((m) => {
        const hour = new Date(m.created_at).getHours();
        const key = `${hour.toString().padStart(2, "0")}h`;
        hourBuckets[key] = (hourBuckets[key] || 0) + 1;
      });
      setHourlyData(Object.entries(hourBuckets).map(([hour, count]) => ({ hour, messages: count })));

      // === Channel distribution ===
      const channelCounts: Record<string, number> = {};
      conversations.forEach((c) => {
        channelCounts[c.channel] = (channelCounts[c.channel] || 0) + 1;
      });
      const totalConvs = conversations.length || 1;
      setChannelData(
        Object.entries(channelCounts).map(([ch, count]) => ({
          name: CHANNEL_LABELS[ch] || ch,
          value: Math.round((count / totalConvs) * 100),
          color: CHANNEL_COLORS[ch] || "hsl(var(--muted-foreground))",
        }))
      );

      // === Agent performance ===
      const agentStats: Record<string, { resolved: number; responseTimes: number[]; ratings: number[] }> = {};

      conversations.forEach((c) => {
        if (!c.assigned_agent_id) return;
        if (!agentStats[c.assigned_agent_id]) {
          agentStats[c.assigned_agent_id] = { resolved: 0, responseTimes: [], ratings: [] };
        }
        if (c.status === "resolved" || c.status === "closed") {
          agentStats[c.assigned_agent_id].resolved++;
        }
      });

      // Agent response times
      Object.keys(contactMsgsByConv).forEach((convId) => {
        const conv = conversations.find((c) => c.id === convId);
        if (!conv?.assigned_agent_id) return;
        const contactMsgs = contactMsgsByConv[convId]?.sort((a, b) => a.getTime() - b.getTime()) || [];
        const agentMsgs = agentMsgsByConv[convId]?.sort((a, b) => a.getTime() - b.getTime()) || [];
        contactMsgs.forEach((ct) => {
          const reply = agentMsgs.find((at) => at.getTime() > ct.getTime());
          if (reply) {
            if (!agentStats[conv.assigned_agent_id!]) {
              agentStats[conv.assigned_agent_id!] = { resolved: 0, responseTimes: [], ratings: [] };
            }
            agentStats[conv.assigned_agent_id!].responseTimes.push(reply.getTime() - ct.getTime());
          }
        });
      });

      // Agent satisfaction
      sats.forEach((r) => {
        if (r.agent_id && agentStats[r.agent_id]) {
          agentStats[r.agent_id].ratings.push(r.rating || 0);
        }
      });

      const agentPerf = Object.entries(agentStats)
        .map(([agentId, s]) => ({
          name: profileMap[agentId] || "Desconhecido",
          resolved: s.resolved,
          avgTime: s.responseTimes.length > 0
            ? formatDuration(s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length)
            : "--",
          satisfaction: s.ratings.length > 0
            ? Math.round(s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length * 20)
            : 0,
        }))
        .sort((a, b) => b.resolved - a.resolved);

      setAgentPerformance(agentPerf);
    } catch (err) {
      console.error("Reports fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [startISO, endISO]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { stats, hourlyData, channelData, agentPerformance, loading };
}

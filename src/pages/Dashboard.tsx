import { useState, useEffect } from "react";
import {
  MessageSquare,
  Users,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  BarChart3,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ChannelBadge from "@/components/shared/ChannelBadge";
import StatusDot from "@/components/shared/StatusDot";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DashboardStats {
  openConversations: number;
  totalConversations: number;
  resolvedToday: number;
  activeAgents: number;
  messagesToday: number;
  newLeadsToday: number;
  sentimentBreakdown: { positivo: number; neutro: number; negativo: number; irritado: number; satisfeito: number };
  leadBreakdown: { quente: number; morno: number; frio: number };
}

interface RecentConversation {
  id: string;
  channel: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  contacts: {
    name: string;
  };
  lastMessageContent?: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    openConversations: 0,
    totalConversations: 0,
    resolvedToday: 0,
    activeAgents: 0,
    messagesToday: 0,
    newLeadsToday: 0,
    sentimentBreakdown: { positivo: 0, neutro: 0, negativo: 0, irritado: 0, satisfeito: 0 },
    leadBreakdown: { quente: 0, morno: 0, frio: 0 },
  });
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Parallel queries
      const [
        openRes,
        totalRes,
        resolvedRes,
        agentsRes,
        messagesTodayRes,
        newLeadsRes,
        recentRes,
        weeklyRes,
        sentimentRes,
      ] = await Promise.all([
        supabase.from("conversations").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("status", "closed").gte("closed_at", todayISO),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
        supabase.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
        supabase.from("conversations").select("id, channel, status, unread_count, last_message_at, contacts(name)").order("last_message_at", { ascending: false }).limit(5),
        supabase.from("messages").select("created_at, conversation_id").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("conversations").select("sentiment, lead_score").in("status", ["open", "pending"]).not("sentiment", "is", null),
      ]);

      // Build sentiment/lead breakdowns
      const sentimentBreakdown = { positivo: 0, neutro: 0, negativo: 0, irritado: 0, satisfeito: 0 };
      const leadBreakdown = { quente: 0, morno: 0, frio: 0 };
      if (sentimentRes.data) {
        sentimentRes.data.forEach((c: any) => {
          if (c.sentiment && c.sentiment in sentimentBreakdown) sentimentBreakdown[c.sentiment as keyof typeof sentimentBreakdown]++;
          if (c.lead_score && c.lead_score in leadBreakdown) leadBreakdown[c.lead_score as keyof typeof leadBreakdown]++;
        });
      }

      setStats({
        openConversations: openRes.count || 0,
        totalConversations: totalRes.count || 0,
        resolvedToday: resolvedRes.count || 0,
        activeAgents: agentsRes.count || 0,
        messagesToday: messagesTodayRes.count || 0,
        newLeadsToday: newLeadsRes.count || 0,
        sentimentBreakdown,
        leadBreakdown,
      });

      // Fetch last message content for recent conversations
      const recent = (recentRes.data as any[]) || [];
      const enriched: RecentConversation[] = [];
      for (const conv of recent) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        enriched.push({ ...conv, lastMessageContent: lastMsg?.content || "" });
      }
      setRecentConversations(enriched);

      // Build weekly chart data
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const weekMap: Record<string, { whatsapp: number; instagram: number; telegram: number; webchat: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = days[d.getDay()];
        weekMap[key] = { whatsapp: 0, instagram: 0, telegram: 0, webchat: 0 };
      }

      // Count messages per day per channel (approximate via conversations)
      if (weeklyRes.data) {
        // Get conversation channels
        const convIds = [...new Set(weeklyRes.data.map((m: any) => m.conversation_id))];
        if (convIds.length > 0) {
          const { data: convChannels } = await supabase
            .from("conversations")
            .select("id, channel")
            .in("id", convIds.slice(0, 100));
          const channelMap: Record<string, string> = {};
          (convChannels || []).forEach((c: any) => { channelMap[c.id] = c.channel; });

          weeklyRes.data.forEach((msg: any) => {
            const d = new Date(msg.created_at);
            const key = days[d.getDay()];
            const ch = channelMap[msg.conversation_id] || "webchat";
            if (weekMap[key] && ch in weekMap[key]) {
              (weekMap[key] as any)[ch]++;
            }
          });
        }
      }
      setWeeklyData(Object.entries(weekMap).map(([day, counts]) => ({ day, ...counts })));
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    { label: "Conversas Abertas", value: stats.openConversations, icon: MessageSquare },
    { label: "Mensagens Hoje", value: stats.messagesToday, icon: Zap },
    { label: "Resolvidas Hoje", value: stats.resolvedToday, icon: TrendingUp },
    { label: "Novos Leads Hoje", value: stats.newLeadsToday, icon: Users },
  ];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do seu atendimento</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Mensagens por Canal</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 dias</p>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="whatsapp" name="WhatsApp" fill="hsl(var(--channel-whatsapp))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="instagram" name="Instagram" fill="hsl(var(--channel-instagram))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="telegram" name="Telegram" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                {loading ? "Carregando..." : "Sem dados no período"}
              </div>
            )}
          </div>

          {/* Recent conversations */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">Conversas Recentes</h3>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : recentConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conversa ainda</p>
              ) : (
                recentConversations.map((conv) => (
                  <div key={conv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        {conv.contacts?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <ChannelBadge channel={conv.channel as any} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{conv.contacts?.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessageContent || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={conv.status} />
                      {conv.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sentiment & Lead breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sentiment */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🧠</span> Sentimento dos Clientes
            </h3>
            <div className="space-y-2">
              {[
                { key: "satisfeito", label: "Satisfeito", emoji: "😄", color: "bg-green-500" },
                { key: "positivo", label: "Positivo", emoji: "😊", color: "bg-emerald-400" },
                { key: "neutro", label: "Neutro", emoji: "😐", color: "bg-yellow-400" },
                { key: "negativo", label: "Negativo", emoji: "😟", color: "bg-orange-500" },
                { key: "irritado", label: "Irritado", emoji: "😡", color: "bg-red-500" },
              ].map(s => {
                const count = stats.sentimentBreakdown[s.key as keyof typeof stats.sentimentBreakdown];
                const total = Object.values(stats.sentimentBreakdown).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="text-sm w-5">{s.emoji}</span>
                    <span className="text-xs text-muted-foreground w-20">{s.label}</span>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leads */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🎯</span> Classificação de Leads
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "quente", label: "Quentes", emoji: "🔥", color: "bg-red-500/10 text-red-600" },
                { key: "morno", label: "Mornos", emoji: "🌤️", color: "bg-yellow-500/10 text-yellow-600" },
                { key: "frio", label: "Frios", emoji: "❄️", color: "bg-blue-500/10 text-blue-600" },
              ].map(l => (
                <div key={l.key} className={`rounded-xl p-4 text-center ${l.color}`}>
                  <span className="text-2xl">{l.emoji}</span>
                  <p className="text-2xl font-bold mt-1">{loading ? "—" : stats.leadBreakdown[l.key as keyof typeof stats.leadBreakdown]}</p>
                  <p className="text-xs font-medium mt-0.5">{l.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Conversas", value: loading ? "—" : stats.totalConversations.toLocaleString() },
            { label: "Agentes Ativos", value: loading ? "—" : stats.activeAgents },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
              <p className="text-xl font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

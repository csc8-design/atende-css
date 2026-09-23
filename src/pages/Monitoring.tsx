import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Clock,
  MessageSquare,
  Users,
  Star,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Trophy,
  Timer,
  Send,
  Eye,
  Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/layout/AppLayout";
import { useMonitoring } from "@/hooks/useMonitoring";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StatusDot from "@/components/shared/StatusDot";
import ChannelBadge from "@/components/shared/ChannelBadge";
import ConversationDetailModal from "@/components/monitoring/ConversationDetailModal";
import AgentPerformanceDetail from "@/components/monitoring/AgentPerformanceDetail";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "hsl(var(--chart-1))",
  instagram: "hsl(var(--chart-2))",
  telegram: "hsl(var(--chart-3))",
  webchat: "hsl(var(--chart-4))",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  webchat: "Webchat",
};

const KPICard = ({
  icon: Icon,
  label,
  value,
  subtext,
  color = "primary",
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-5 h-5 text-${color}`} />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  </div>
);

const Monitoring = () => {
  const { agents, kpis, loading, refetch } = useMonitoring();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentConversations, setAgentConversations] = useState<any[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [convoSearch, setConvoSearch] = useState("");
  const [convoFilter, setConvoFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all");
  const [selectedConvo, setSelectedConvo] = useState<any | null>(null);
  const [perfAgentId, setPerfAgentId] = useState<string | null>(null);
  const fetchAgentConversations = useCallback(async (agentId: string) => {
    setLoadingConvos(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("*, contacts(name, phone, avatar_url)")
      .eq("assigned_agent_id", agentId)
      .order("last_message_at", { ascending: false });
    if (!error) setAgentConversations(data || []);
    setLoadingConvos(false);
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentConversations(selectedAgentId);
    } else {
      setAgentConversations([]);
    }
  }, [selectedAgentId, fetchAgentConversations]);
  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const channelData = kpis.conversationsByChannel.map((c) => ({
    name: CHANNEL_LABELS[c.channel] || c.channel,
    value: c.count,
    color: CHANNEL_COLORS[c.channel] || "hsl(var(--chart-5))",
  }));

  const hourlyData = kpis.hourlyVolume.filter((h) => h.count > 0 || (h.hour >= 7 && h.hour <= 22)).map((h) => ({
    hour: `${h.hour.toString().padStart(2, "0")}h`,
    mensagens: h.count,
  }));

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-screen pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Monitoramento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhamento em tempo real dos atendimentos e agentes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={MessageSquare}
            label="Conversas Abertas"
            value={kpis.totalOpenConversations}
            color="primary"
          />
          <KPICard
            icon={AlertCircle}
            label="Pendentes"
            value={kpis.totalPendingConversations}
            color="primary"
          />
          <KPICard
            icon={CheckCircle2}
            label="Resolvidas Hoje"
            value={kpis.totalResolvedToday + kpis.totalClosedToday}
            color="primary"
          />
          <KPICard
            icon={TrendingUp}
            label="Mensagens Hoje"
            value={kpis.totalMessagesToday}
            color="primary"
          />
          <KPICard
            icon={Clock}
            label="Tempo Médio de Atendimento"
            value={kpis.avgServiceDurationMin > 0 ? `${kpis.avgServiceDurationMin} min` : "—"}
            color="primary"
          />
          <KPICard
            icon={Star}
            label="Satisfação Média"
            value={kpis.satisfactionAvg !== null ? `${kpis.satisfactionAvg}/5` : "—"}
            color="primary"
          />
          <KPICard
            icon={Users}
            label="Agentes Ativos"
            value={agents.filter((a) => a.active_conversations > 0).length}
            subtext={`de ${agents.length} agentes`}
            color="primary"
          />
          <KPICard
            icon={BarChart3}
            label="Total de Conversas"
            value={
              kpis.totalOpenConversations +
              kpis.totalPendingConversations +
              kpis.totalResolvedToday +
              kpis.totalClosedToday
            }
            color="primary"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly volume */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Mensagens por Hora (Hoje)</h3>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="mensagens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma mensagem hoje</p>
            )}
          </div>

          {/* Channel distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Canal</h3>
            {channelData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {channelData.map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-sm text-foreground">{c.name}</span>
                      <span className="text-sm font-semibold text-foreground ml-auto">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma conversa</p>
            )}
          </div>
        </div>

        {/* Tabs: Agentes overview + Performance detalhada */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Users className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Trophy className="w-4 h-4" />
              Performance dos Agentes
            </TabsTrigger>
            <TabsTrigger value="agent-conversations" className="gap-2">
              <Eye className="w-4 h-4" />
              Conversas por Agente
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Agentes ({agents.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Agente</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Departamento</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Atendimentos Ativos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => {
                      const isActive = agent.active_conversations > 0;
                      return (
                        <tr key={agent.user_id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {agent.avatar_url ? (
                                <img src={agent.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {agent.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </div>
                              )}
                              <span className="font-medium text-foreground">{agent.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {agent.department_names.length > 0 ? (
                                agent.department_names.map((d) => (
                                  <span key={d} className="px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">{d}</span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                              {isActive ? "Atendendo" : "Disponível"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-lg font-bold text-foreground">{agent.active_conversations}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {agents.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum agente encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Performance tab */}
          <TabsContent value="performance">
            {perfAgentId ? (
              <AgentPerformanceDetail
                agent={agents.find((a) => a.user_id === perfAgentId)!}
                allAgents={agents}
                onBack={() => setPerfAgentId(null)}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{agents.reduce((s, a) => s + a.resolved_today, 0)}</p>
                      <p className="text-sm text-muted-foreground">Conversas Resolvidas Hoje</p>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Send className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{agents.reduce((s, a) => s + a.total_messages_today, 0)}</p>
                      <p className="text-sm text-muted-foreground">Mensagens Enviadas Hoje</p>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Star className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {(() => {
                          const w = agents.filter((a) => a.satisfaction_avg !== null);
                          if (!w.length) return "—";
                          return `${Math.round((w.reduce((s, a) => s + (a.satisfaction_avg || 0), 0) / w.length) * 10) / 10}/5`;
                        })()}
                      </p>
                      <p className="text-sm text-muted-foreground">Satisfação Média da Equipe</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    Ranking de Performance — Hoje
                    <span className="text-xs text-muted-foreground font-normal ml-2">Clique em um agente para ver detalhes</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">#</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Agente</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Abertas</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Resolvidas</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Msgs Enviadas</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                            <div className="flex items-center justify-center gap-1"><Timer className="w-3 h-3" />Tempo Médio</div>
                          </th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
                            <div className="flex items-center justify-center gap-1"><Star className="w-3 h-3" />CSAT</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...agents]
                          .sort((a, b) => b.resolved_today - a.resolved_today || b.total_messages_today - a.total_messages_today)
                          .map((agent, idx) => (
                            <tr
                              key={agent.user_id}
                              onClick={() => setPerfAgentId(agent.user_id)}
                              className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                                  idx === 1 ? "bg-gray-300/30 text-gray-500" :
                                  idx === 2 ? "bg-orange-400/20 text-orange-500" :
                                  "bg-muted text-muted-foreground"
                                }`}>{idx + 1}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {agent.avatar_url ? (
                                    <img src={agent.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                      {agent.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium text-foreground block">{agent.full_name}</span>
                                    <span className="text-xs text-muted-foreground">{agent.department_names.join(", ") || "—"}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-foreground">{agent.active_conversations}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-bold ${agent.resolved_today > 0 ? "text-green-600" : "text-muted-foreground"}`}>{agent.resolved_today}</span>
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-foreground">{agent.total_messages_today}</td>
                              <td className="py-3 px-4 text-center text-foreground">
                                {agent.avg_service_duration_min !== null ? `${agent.avg_service_duration_min} min` : "—"}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {agent.satisfaction_avg !== null ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                    <span className="font-semibold text-foreground">{agent.satisfaction_avg}</span>
                                    <span className="text-xs text-muted-foreground">({agent.satisfaction_count})</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {agents.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum agente encontrado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Agent Conversations tab */}
          <TabsContent value="agent-conversations">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Conversas Tratadas por Agente
              </h3>

              {/* Agent selector */}
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <button
                    key={agent.user_id}
                    onClick={() => setSelectedAgentId(selectedAgentId === agent.user_id ? null : agent.user_id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
                      selectedAgentId === agent.user_id
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {agent.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    )}
                    {agent.full_name}
                  </button>
                ))}
              </div>

              {selectedAgentId && (
                <>
                  {/* Filters */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar por contato..."
                        value={convoSearch}
                        onChange={(e) => setConvoSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="flex gap-1">
                      {(["all", "open", "pending", "resolved", "closed"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setConvoFilter(f)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            convoFilter === f
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {f === "all" ? "Todas" : f === "open" ? "Abertas" : f === "pending" ? "Pendentes" : f === "resolved" ? "Resolvidas" : "Fechadas"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conversation list */}
                  {loadingConvos ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Contato</th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Canal</th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Prioridade</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Última Msg</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Criada em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentConversations
                            .filter((c) => {
                              const matchSearch = !convoSearch || c.contacts?.name?.toLowerCase().includes(convoSearch.toLowerCase()) || c.contacts?.phone?.toLowerCase().includes(convoSearch.toLowerCase());
                              const matchFilter = convoFilter === "all" || c.status === convoFilter;
                              return matchSearch && matchFilter;
                            })
                            .map((conv) => {
                              const contactName = conv.contacts?.name || "Desconhecido";
                              const initials = contactName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
                              let hash = 0;
                              for (let i = 0; i < contactName.length; i++) {
                                hash = contactName.charCodeAt(i) + ((hash << 5) - hash);
                              }
                              const avatarBg = `hsl(${Math.abs(hash % 360)}, 55%, 45%)`;

                              const statusLabels: Record<string, string> = { open: "Aberta", pending: "Pendente", resolved: "Resolvida", closed: "Fechada" };
                              const statusColors: Record<string, string> = {
                                open: "bg-green-500/10 text-green-600",
                                pending: "bg-yellow-500/10 text-yellow-600",
                                resolved: "bg-blue-500/10 text-blue-600",
                                closed: "bg-muted text-muted-foreground",
                              };

                              return (
                                <tr key={conv.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedConvo(conv)}>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="w-8 h-8">
                                        <AvatarImage src={conv.contacts?.avatar_url || undefined} />
                                        <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: avatarBg }}>{initials}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <span className="font-medium text-foreground block">{contactName}</span>
                                        <span className="text-xs text-muted-foreground">{conv.contacts?.phone || "—"}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <ChannelBadge channel={conv.channel} />
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[conv.status] || "bg-muted text-muted-foreground"}`}>
                                      {statusLabels[conv.status] || conv.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`text-xs font-medium ${conv.priority >= 2 ? "text-destructive" : conv.priority === 1 ? "text-orange-500" : "text-muted-foreground"}`}>
                                      {conv.priority >= 2 ? "Alta" : conv.priority === 1 ? "Média" : "Normal"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-muted-foreground">
                                    {conv.last_message_at ? format(new Date(conv.last_message_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-muted-foreground">
                                    {format(new Date(conv.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                  </td>
                                </tr>
                              );
                            })}
                          {agentConversations.filter((c) => {
                            const matchSearch = !convoSearch || c.contacts?.name?.toLowerCase().includes(convoSearch.toLowerCase());
                            const matchFilter = convoFilter === "all" || c.status === convoFilter;
                            return matchSearch && matchFilter;
                          }).length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                Nenhuma conversa encontrada
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Summary */}
                  {!loadingConvos && agentConversations.length > 0 && (
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                      <span>Total: <strong className="text-foreground">{agentConversations.length}</strong></span>
                      <span>Abertas: <strong className="text-foreground">{agentConversations.filter(c => c.status === "open").length}</strong></span>
                      <span>Pendentes: <strong className="text-foreground">{agentConversations.filter(c => c.status === "pending").length}</strong></span>
                      <span>Resolvidas: <strong className="text-foreground">{agentConversations.filter(c => c.status === "resolved").length}</strong></span>
                      <span>Fechadas: <strong className="text-foreground">{agentConversations.filter(c => c.status === "closed").length}</strong></span>
                    </div>
                  )}
                </>
              )}

              {!selectedAgentId && (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Selecione um agente acima para visualizar suas conversas</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConversationDetailModal
        open={!!selectedConvo}
        onClose={() => setSelectedConvo(null)}
        conversation={selectedConvo}
      />
    </AppLayout>
  );
};

export default Monitoring;

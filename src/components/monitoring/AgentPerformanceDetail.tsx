import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Trophy,
  Star,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  CheckCircle2,
  Timer,
  ThumbsUp,
  ThumbsDown,
  Users,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface AgentData {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  active_conversations: number;
  resolved_today: number;
  total_messages_today: number;
  avg_service_duration_min: number | null;
  satisfaction_avg: number | null;
  satisfaction_count: number;
  department_names: string[];
}

interface AgentPerformanceDetailProps {
  agent: AgentData;
  allAgents: AgentData[];
  onBack: () => void;
}

const AgentPerformanceDetail = ({ agent, allAgents, onBack }: AgentPerformanceDetailProps) => {
  const [compareAgentId, setCompareAgentId] = useState<string | null>(null);

  const compareAgent = useMemo(
    () => allAgents.find((a) => a.user_id === compareAgentId) || null,
    [allAgents, compareAgentId]
  );

  const initials = agent.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  // Compute team averages for context
  const teamAvg = useMemo(() => {
    const count = allAgents.length || 1;
    const resolved = allAgents.reduce((s, a) => s + a.resolved_today, 0) / count;
    const msgs = allAgents.reduce((s, a) => s + a.total_messages_today, 0) / count;
    const durations = allAgents.filter((a) => a.avg_service_duration_min !== null);
    const avgDur =
      durations.length > 0
        ? durations.reduce((s, a) => s + (a.avg_service_duration_min || 0), 0) / durations.length
        : null;
    const sats = allAgents.filter((a) => a.satisfaction_avg !== null);
    const avgSat =
      sats.length > 0
        ? sats.reduce((s, a) => s + (a.satisfaction_avg || 0), 0) / sats.length
        : null;
    return { resolved, msgs, avgDur, avgSat };
  }, [allAgents]);

  // Performance vs team chart data
  const barCompareData = useMemo(() => {
    const data = [
      {
        metric: "Resolvidas",
        [agent.full_name.split(" ")[0]]: agent.resolved_today,
        "Média Equipe": Math.round(teamAvg.resolved * 10) / 10,
        ...(compareAgent
          ? { [compareAgent.full_name.split(" ")[0]]: compareAgent.resolved_today }
          : {}),
      },
      {
        metric: "Mensagens",
        [agent.full_name.split(" ")[0]]: agent.total_messages_today,
        "Média Equipe": Math.round(teamAvg.msgs * 10) / 10,
        ...(compareAgent
          ? { [compareAgent.full_name.split(" ")[0]]: compareAgent.total_messages_today }
          : {}),
      },
      {
        metric: "CSAT (x10)",
        [agent.full_name.split(" ")[0]]: (agent.satisfaction_avg || 0) * 10,
        "Média Equipe": Math.round((teamAvg.avgSat || 0) * 10),
        ...(compareAgent
          ? { [compareAgent.full_name.split(" ")[0]]: (compareAgent.satisfaction_avg || 0) * 10 }
          : {}),
      },
      {
        metric: "Tempo Médio",
        [agent.full_name.split(" ")[0]]: agent.avg_service_duration_min || 0,
        "Média Equipe": Math.round((teamAvg.avgDur || 0) * 10) / 10,
        ...(compareAgent
          ? { [compareAgent.full_name.split(" ")[0]]: compareAgent.avg_service_duration_min || 0 }
          : {}),
      },
    ];
    return data;
  }, [agent, compareAgent, teamAvg]);

  // Radar data — normalized 0-100
  const radarData = useMemo(() => {
    const maxResolved = Math.max(...allAgents.map((a) => a.resolved_today), 1);
    const maxMsgs = Math.max(...allAgents.map((a) => a.total_messages_today), 1);
    const maxDur = Math.max(
      ...allAgents.map((a) => a.avg_service_duration_min || 0),
      1
    );

    const normalize = (a: AgentData) => ({
      volume: Math.round((a.total_messages_today / maxMsgs) * 100),
      resoluções: Math.round((a.resolved_today / maxResolved) * 100),
      satisfação: Math.round(((a.satisfaction_avg || 0) / 5) * 100),
      velocidade: Math.round(
        (1 - (a.avg_service_duration_min || 0) / (maxDur || 1)) * 100
      ),
      produtividade: Math.round(
        ((a.resolved_today + a.total_messages_today) /
          (maxResolved + maxMsgs)) *
          100
      ),
    });

    const agentNorm = normalize(agent);
    const compareNorm = compareAgent ? normalize(compareAgent) : null;

    return [
      {
        metric: "Volume",
        [agent.full_name.split(" ")[0]]: agentNorm.volume,
        ...(compareNorm
          ? { [compareAgent!.full_name.split(" ")[0]]: compareNorm.volume }
          : {}),
      },
      {
        metric: "Resoluções",
        [agent.full_name.split(" ")[0]]: agentNorm.resoluções,
        ...(compareNorm
          ? { [compareAgent!.full_name.split(" ")[0]]: compareNorm.resoluções }
          : {}),
      },
      {
        metric: "Satisfação",
        [agent.full_name.split(" ")[0]]: agentNorm.satisfação,
        ...(compareNorm
          ? { [compareAgent!.full_name.split(" ")[0]]: compareNorm.satisfação }
          : {}),
      },
      {
        metric: "Velocidade",
        [agent.full_name.split(" ")[0]]: agentNorm.velocidade,
        ...(compareNorm
          ? { [compareAgent!.full_name.split(" ")[0]]: compareNorm.velocidade }
          : {}),
      },
      {
        metric: "Produtividade",
        [agent.full_name.split(" ")[0]]: agentNorm.produtividade,
        ...(compareNorm
          ? { [compareAgent!.full_name.split(" ")[0]]: compareNorm.produtividade }
          : {}),
      },
    ];
  }, [agent, compareAgent, allAgents]);

  // Strengths & improvements
  const { strengths, improvements } = useMemo(() => {
    const s: string[] = [];
    const imp: string[] = [];

    // Resolved vs team
    if (agent.resolved_today > teamAvg.resolved * 1.2) {
      s.push("Acima da média em resoluções de conversas");
    } else if (agent.resolved_today < teamAvg.resolved * 0.8 && teamAvg.resolved > 0) {
      imp.push("Resoluções abaixo da média da equipe");
    }

    // Messages
    if (agent.total_messages_today > teamAvg.msgs * 1.2) {
      s.push("Alto volume de mensagens — engajamento ativo");
    } else if (agent.total_messages_today < teamAvg.msgs * 0.5 && teamAvg.msgs > 0) {
      imp.push("Volume de mensagens baixo comparado à equipe");
    }

    // Satisfaction
    if (agent.satisfaction_avg !== null && teamAvg.avgSat !== null) {
      if (agent.satisfaction_avg >= (teamAvg.avgSat || 0) * 1.1) {
        s.push("Satisfação do cliente acima da média");
      } else if (agent.satisfaction_avg < (teamAvg.avgSat || 0) * 0.9) {
        imp.push("Satisfação do cliente abaixo da média");
      }
    }
    if (agent.satisfaction_avg !== null && agent.satisfaction_avg >= 4.5) {
      s.push("Excelente índice de satisfação (CSAT ≥ 4.5)");
    }

    // Speed
    if (agent.avg_service_duration_min !== null && teamAvg.avgDur !== null) {
      if (agent.avg_service_duration_min < (teamAvg.avgDur || 0) * 0.8) {
        s.push("Tempo de atendimento rápido");
      } else if (agent.avg_service_duration_min > (teamAvg.avgDur || 0) * 1.3) {
        imp.push("Tempo médio de atendimento elevado");
      }
    }

    if (agent.active_conversations >= 5) {
      s.push("Gerencia alta carga de atendimentos simultâneos");
    }

    if (s.length === 0) s.push("Desempenho dentro da média da equipe");
    if (imp.length === 0) imp.push("Nenhum ponto crítico identificado hoje");

    return { strengths: s, improvements: imp };
  }, [agent, teamAvg]);

  // Rank
  const rank = useMemo(() => {
    const sorted = [...allAgents].sort(
      (a, b) => b.resolved_today - a.resolved_today || b.total_messages_today - a.total_messages_today
    );
    return sorted.findIndex((a) => a.user_id === agent.user_id) + 1;
  }, [agent, allAgents]);

  const agentFirstName = agent.full_name.split(" ")[0];
  const compareFirstName = compareAgent?.full_name.split(" ")[0];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarImage src={agent.avatar_url || undefined} />
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-foreground">{agent.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              {agent.department_names.join(", ") || "Sem departamento"}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              #{rank} no ranking
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{agent.resolved_today}</p>
          <p className="text-xs text-muted-foreground">Resolvidas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <MessageSquare className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{agent.total_messages_today}</p>
          <p className="text-xs text-muted-foreground">Mensagens</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Timer className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">
            {agent.avg_service_duration_min !== null ? `${agent.avg_service_duration_min} min` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Tempo Médio</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">
            {agent.satisfaction_avg !== null ? `${agent.satisfaction_avg}/5` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">CSAT ({agent.satisfaction_count})</p>
        </div>
      </div>

      {/* Comparison selector */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Comparar com outro agente</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCompareAgentId(null)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              !compareAgentId
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            Apenas vs Equipe
          </button>
          {allAgents
            .filter((a) => a.user_id !== agent.user_id)
            .map((a) => (
              <button
                key={a.user_id}
                onClick={() => setCompareAgentId(a.user_id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  compareAgentId === a.user_id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {a.full_name}
              </button>
            ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart — Metrics comparison */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Métricas Comparativas
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barCompareData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="metric" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey={agentFirstName}
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Média Equipe"
                fill="hsl(var(--muted-foreground))"
                radius={[4, 4, 0, 0]}
                opacity={0.5}
              />
              {compareAgent && (
                <Bar
                  dataKey={compareFirstName!}
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Perfil de Desempenho
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--border))" />
              <Radar
                name={agentFirstName}
                dataKey={agentFirstName}
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
              />
              {compareAgent && (
                <Radar
                  name={compareFirstName!}
                  dataKey={compareFirstName!}
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.15}
                />
              )}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-green-500" />
            Pontos Fortes
          </h3>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ThumbsDown className="w-4 h-4 text-orange-500" />
            Pontos a Melhorar
          </h3>
          <ul className="space-y-2">
            {improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <TrendingDown className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                {imp}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Comparison table */}
      {compareAgent && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Comparativo: {agent.full_name} vs {compareAgent.full_name}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Métrica</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{agent.full_name.split(" ")[0]}</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{compareAgent.full_name.split(" ")[0]}</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Conversas Resolvidas", a: agent.resolved_today, b: compareAgent.resolved_today },
                  { label: "Mensagens Enviadas", a: agent.total_messages_today, b: compareAgent.total_messages_today },
                  { label: "Tempo Médio (min)", a: agent.avg_service_duration_min ?? 0, b: compareAgent.avg_service_duration_min ?? 0, invert: true },
                  { label: "CSAT", a: agent.satisfaction_avg ?? 0, b: compareAgent.satisfaction_avg ?? 0 },
                  { label: "Atendimentos Ativos", a: agent.active_conversations, b: compareAgent.active_conversations },
                ].map((row) => {
                  const diff = row.a - row.b;
                  const isGood = row.invert ? diff < 0 : diff > 0;
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-3 px-4 font-medium text-foreground">{row.label}</td>
                      <td className="py-3 px-4 text-center font-semibold text-foreground">{row.a}</td>
                      <td className="py-3 px-4 text-center font-semibold text-foreground">{row.b}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold ${
                            diff === 0
                              ? "text-muted-foreground"
                              : isGood
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {Math.round(diff * 10) / 10}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPerformanceDetail;

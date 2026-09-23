import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Download, Filter, TrendingUp, Clock, Users, MessageSquare, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useReports } from "@/hooks/useReports";

const Reports = () => {
  const [dateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  });

  const { stats, hourlyData, channelData, agentPerformance, loading } = useReports(dateRange);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground mt-1">Últimos 7 dias • Dados em tempo real</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary transition-colors">
              <Filter className="w-4 h-4" /> Filtrar
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary transition-colors">
              <Download className="w-4 h-4" /> Exportar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: MessageSquare, label: "Mensagens (7 dias)", value: String(stats.messagesToday), trend: "" },
                { icon: Clock, label: "Tempo Médio Resposta", value: stats.avgResponseTime, trend: "" },
                { icon: Users, label: "Atendentes Ativos", value: String(stats.activeAgents), trend: "" },
                { icon: TrendingUp, label: "Satisfação Média", value: stats.avgSatisfaction > 0 ? `${stats.avgSatisfaction}/5` : "--", trend: "" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                  <stat.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hourly chart */}
              <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-foreground mb-4">Mensagens por Hora</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Line type="monotone" dataKey="messages" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Channel distribution */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <h3 className="font-semibold text-foreground mb-4">Distribuição por Canal</h3>
                {channelData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                          {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                      {channelData.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name} ({c.value}%)
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
                )}
              </div>
            </div>

            {/* Agent performance */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4">Desempenho dos Atendentes</h3>
              {agentPerformance.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Atendente</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Resolvidos</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Tempo Médio</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Satisfação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((agent) => (
                      <tr key={agent.name} className="border-b border-border/50">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{agent.name}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{agent.resolved}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{agent.avgTime}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{agent.satisfaction > 0 ? `${agent.satisfaction}%` : "--"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum atendente com atividade no período</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;

import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, Users, Activity, TrendingUp, Loader2, Flame, Cloud, Snowflake } from "lucide-react";
import { useCarteira, TARGET_DEPARTMENTS, TargetDept, AgentInfo } from "@/hooks/useCarteira";

interface AgentStat extends AgentInfo {
  total: number;
  active: number;
  rate: number;
  quente: number;
  morno: number;
  frio: number;
}

export default function AnaliseInteracoes() {
  const {
    contacts,
    convs,
    agents,
    agentDeptMap,
    loading,
    isOnlyAgent,
    isAdmin,
    isSupervisor,
    hasInteracted60d,
  } = useCarteira();

  // Only admin/supervisor allowed
  if (!loading && isOnlyAgent) {
    return <Navigate to="/minha-carteira" replace />;
  }

  const perDeptStats = useMemo(() => {
    const byAgent: Record<string, AgentStat> = {};
    agents.forEach((a) => {
      byAgent[a.user_id] = { ...a, total: 0, active: 0, rate: 0, quente: 0, morno: 0, frio: 0 };
    });
    contacts.forEach((c) => {
      if (!c.assigned_agent_id || !byAgent[c.assigned_agent_id]) return;
      const s = byAgent[c.assigned_agent_id];
      s.total += 1;
      if (hasInteracted60d(c.id)) s.active += 1;
      const t = convs[c.id]?.lead_score;
      if (t === "quente") s.quente += 1;
      else if (t === "morno") s.morno += 1;
      else if (t === "frio") s.frio += 1;
    });
    Object.values(byAgent).forEach((s) => {
      s.rate = s.total > 0 ? Math.round((s.active / s.total) * 100) : 0;
    });

    return TARGET_DEPARTMENTS.map((dept) => {
      const deptAgents = agents
        .filter((a) => (agentDeptMap[a.user_id] || []).includes(dept))
        .map((a) => byAgent[a.user_id])
        .filter((a) => a && a.total > 0)
        .sort((a, b) => b.rate - a.rate);
      const total = deptAgents.reduce((n, a) => n + a.total, 0);
      const active = deptAgents.reduce((n, a) => n + a.active, 0);
      const rate = total > 0 ? Math.round((active / total) * 100) : 0;
      return { dept, agents: deptAgents, total, active, rate };
    });
  }, [contacts, agents, agentDeptMap, convs, hasInteracted60d]);

  const globalTotal = contacts.length;
  const globalActive = contacts.filter((c) => hasInteracted60d(c.id)).length;
  const globalRate = globalTotal ? Math.round((globalActive / globalTotal) * 100) : 0;
  const totalAgents = perDeptStats.reduce((n, d) => n + d.agents.length, 0);
  const topAgent = perDeptStats
    .flatMap((d) => d.agents)
    .sort((a, b) => b.rate - a.rate)[0];

  const scopeLabel = isAdmin
    ? "Visão completa — todos departamentos"
    : "Análise dos seus departamentos";

  const rateColor = (r: number) =>
    r >= 70 ? "text-emerald-600" : r >= 40 ? "text-yellow-700" : "text-red-600";
  const rateBg = (r: number) =>
    r >= 70 ? "bg-emerald-500" : r >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Análise de Interações</h1>
            <p className="text-sm text-muted-foreground">{scopeLabel} · janela 60 dias</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <>
            {/* KPI overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Users className="w-3 h-3" /> Total clientes
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{globalTotal}</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Interação 60d
                </p>
                <p className={`text-2xl font-bold mt-1 ${rateColor(globalRate)}`}>{globalRate}%</p>
                <p className="text-[11px] text-muted-foreground">{globalActive}/{globalTotal} ativos</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Agentes ativos</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totalAgents}</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Destaque
                </p>
                {topAgent ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={topAgent.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(topAgent.full_name || "?").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{topAgent.full_name}</p>
                      <p className={`text-xs font-bold ${rateColor(topAgent.rate)}`}>{topAgent.rate}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">—</p>
                )}
              </div>
            </div>

            {/* Department comparison bar */}
            <div className="p-4 rounded-xl border border-border bg-card mb-6">
              <p className="text-sm font-semibold text-foreground mb-3">Interação por departamento</p>
              <div className="space-y-3">
                {perDeptStats.map((d) => (
                  <div key={d.dept}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{d.dept}</span>
                      <span className={`font-bold ${rateColor(d.rate)}`}>
                        {d.rate}% · {d.active}/{d.total}
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${rateBg(d.rate)} transition-all`} style={{ width: `${d.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-department detailed cards */}
            <div className="space-y-4">
              {perDeptStats.map((d) => (
                <div key={d.dept} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{d.dept}</h2>
                    <span className="text-xs text-muted-foreground">
                      · {d.agents.length} agente(s) · {d.active}/{d.total} ativos
                    </span>
                    <span className={`ml-auto text-lg font-bold ${rateColor(d.rate)}`}>{d.rate}%</span>
                  </div>

                  {d.agents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum agente com clientes em carteira neste departamento.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="text-left px-2 py-2 font-semibold">Agente</th>
                            <th className="text-right px-2 py-2 font-semibold">Clientes</th>
                            <th className="text-right px-2 py-2 font-semibold">Ativos 60d</th>
                            <th className="text-right px-2 py-2 font-semibold">Inativos</th>
                            <th className="text-center px-2 py-2 font-semibold">🔥 / 🌤️ / ❄️</th>
                            <th className="text-left px-2 py-2 font-semibold w-[220px]">Taxa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.agents.map((a) => (
                            <tr key={a.user_id} className="border-t border-border/60">
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-7 h-7">
                                    <AvatarImage src={a.avatar_url || undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {(a.full_name || "?").slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-foreground">{a.full_name}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right font-semibold text-foreground">{a.total}</td>
                              <td className="px-2 py-2 text-right text-emerald-600 font-semibold">{a.active}</td>
                              <td className="px-2 py-2 text-right text-muted-foreground">{a.total - a.active}</td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Flame className="w-3 h-3 text-red-600" />{a.quente}
                                  <Cloud className="w-3 h-3 text-yellow-700 ml-1" />{a.morno}
                                  <Snowflake className="w-3 h-3 text-blue-600 ml-1" />{a.frio}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${rateBg(a.rate)}`} style={{ width: `${a.rate}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold w-9 text-right ${rateColor(a.rate)}`}>
                                    {a.rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

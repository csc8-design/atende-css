import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Timer, TrendingDown, Users as UsersIcon, Building2, Loader2, Zap, Award, Filter } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis, Cell,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface ConvRow {
  id: string;
  department_id: string | null;
  assigned_agent_id: string | null;
  created_at: string;
}
interface MsgRow {
  conversation_id: string;
  sender_type: "contact" | "agent" | "bot";
  sender_id: string | null;
  created_at: string;
}

const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${Math.round(sec % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// Horário comercial: Seg-Sex, 08:00-18:00 (horário local).
// Calcula segundos decorridos entre start e end considerando apenas horário comercial.
const BIZ_START_H = 8;
const BIZ_END_H = 18;
const businessSecondsBetween = (startMs: number, endMs: number): number => {
  if (endMs <= startMs) return 0;
  let total = 0;
  const cursor = new Date(startMs);
  const end = new Date(endMs);
  // Avança em janelas de até 1 dia
  while (cursor < end) {
    const day = cursor.getDay(); // 0=Dom ... 6=Sab
    const dayStart = new Date(cursor);
    dayStart.setHours(BIZ_START_H, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(BIZ_END_H, 0, 0, 0);

    if (day >= 1 && day <= 5) {
      const segStart = cursor > dayStart ? cursor : dayStart;
      const segEnd = end < dayEnd ? end : dayEnd;
      if (segEnd > segStart) {
        total += (segEnd.getTime() - segStart.getTime()) / 1000;
      }
    }
    // Pula para o início do próximo dia
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    cursor.setTime(next.getTime());
  }
  return total;
};

const RANGES = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

// SLA scoring (horário comercial): ≤10min=Excelente, ≤30min=Bom, ≤1h=Regular, >1h=Crítico
const slaScore = (sec: number) => {
  if (sec <= 600) return { label: "Excelente", color: "hsl(142 76% 45%)", pct: 100 };
  if (sec <= 1800) return { label: "Bom", color: "hsl(160 70% 45%)", pct: 75 };
  if (sec <= 3600) return { label: "Regular", color: "hsl(38 92% 55%)", pct: 50 };
  return { label: "Crítico", color: "hsl(0 78% 58%)", pct: 20 };
};

const CHART_COLORS = ["hsl(217 91% 60%)", "hsl(142 71% 45%)", "hsl(38 92% 55%)", "hsl(280 70% 60%)", "hsl(0 78% 58%)"];

const SLA = () => {
  const { isAdmin, isManager, loading: authLoading } = useAuth();
  if (!authLoading && !isAdmin && !isManager) return <Navigate to="/inbox" replace />;
  const [days, setDays] = useState(30);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const [{ data: cs }, { data: ms }, { data: ds }, { data: ps }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, department_id, assigned_agent_id, created_at")
          .gte("created_at", since)
          .limit(2000),
        supabase
          .from("messages")
          .select("conversation_id, sender_type, sender_id, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(10000),
        supabase.from("departments").select("id, name").eq("is_active", true),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      setConvs((cs as any) || []);
      setMessages((ms as any) || []);
      const dmap: Record<string, string> = {};
      (ds || []).forEach((d: any) => { dmap[d.id] = d.name; });
      setDepartments(dmap);
      const amap: Record<string, string> = {};
      (ps || []).forEach((p: any) => { amap[p.user_id] = p.full_name; });
      setAgents(amap);
      setLoading(false);
    })();
  }, [days]);

  const filteredConvs = useMemo(
    () => deptFilter === "all" ? convs : convs.filter((c) => c.department_id === deptFilter),
    [convs, deptFilter]
  );

  const stats = useMemo(() => {
    const msgsByConv: Record<string, MsgRow[]> = {};
    messages.forEach((m) => {
      (msgsByConv[m.conversation_id] = msgsByConv[m.conversation_id] || []).push(m);
    });

    type AgentAgg = { agent_id: string; pickups: number[]; responses: number[]; convs: Set<string> };
    type DeptAgg = { dept_id: string; pickups: number[]; responses: number[]; convs: Set<string> };

    const byAgent: Record<string, AgentAgg> = {};
    const byDept: Record<string, DeptAgg> = {};

    let totalPickup: number[] = [];
    let totalResponse: number[] = [];

    filteredConvs.forEach((c) => {
      const ms = msgsByConv[c.id] || [];
      const firstAgentMsg = ms.find((m) => m.sender_type === "agent");
      const agentId = firstAgentMsg?.sender_id || c.assigned_agent_id;
      const deptId = c.department_id;

      if (firstAgentMsg) {
        const pickup = businessSecondsBetween(
          new Date(c.created_at).getTime(),
          new Date(firstAgentMsg.created_at).getTime(),
        );
        if (pickup >= 0) {
          totalPickup.push(pickup);
          if (deptId) {
            byDept[deptId] = byDept[deptId] || { dept_id: deptId, pickups: [], responses: [], convs: new Set() };
            byDept[deptId].pickups.push(pickup);
            byDept[deptId].convs.add(c.id);
          }
          if (agentId) {
            byAgent[agentId] = byAgent[agentId] || { agent_id: agentId, pickups: [], responses: [], convs: new Set() };
            byAgent[agentId].pickups.push(pickup);
            byAgent[agentId].convs.add(c.id);
          }
        }
      }

      let lastContactAt: number | null = null;
      ms.forEach((m) => {
        if (m.sender_type === "contact") {
          if (lastContactAt === null) lastContactAt = new Date(m.created_at).getTime();
        } else if (m.sender_type === "agent" && lastContactAt !== null) {
          const diff = businessSecondsBetween(lastContactAt, new Date(m.created_at).getTime());
          if (diff >= 0) {
            totalResponse.push(diff);
            if (deptId) {
              byDept[deptId] = byDept[deptId] || { dept_id: deptId, pickups: [], responses: [], convs: new Set() };
              byDept[deptId].responses.push(diff);
            }
            const aId = m.sender_id || agentId;
            if (aId) {
              byAgent[aId] = byAgent[aId] || { agent_id: aId, pickups: [], responses: [], convs: new Set() };
              byAgent[aId].responses.push(diff);
            }
          }
          lastContactAt = null;
        }
      });
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const deptRows = Object.values(byDept).map((d) => ({
      id: d.dept_id,
      name: departments[d.dept_id] || "—",
      pickup: avg(d.pickups),
      response: avg(d.responses),
      convs: d.convs.size,
    })).sort((a, b) => b.convs - a.convs);

    const agentRows = Object.values(byAgent).map((a) => ({
      id: a.agent_id,
      name: agents[a.agent_id] || "—",
      pickup: avg(a.pickups),
      response: avg(a.responses),
      convs: a.convs.size,
    })).sort((a, b) => a.pickup - b.pickup);

    return {
      avgPickup: avg(totalPickup),
      avgResponse: avg(totalResponse),
      totalConvs: filteredConvs.length,
      handledConvs: totalPickup.length,
      deptRows,
      agentRows,
    };
  }, [filteredConvs, messages, departments, agents]);

  // SLA por departamento — SEMPRE todos os departamentos, ignora deptFilter
  const allDeptStats = useMemo(() => {
    const msgsByConv: Record<string, MsgRow[]> = {};
    messages.forEach((m) => {
      (msgsByConv[m.conversation_id] = msgsByConv[m.conversation_id] || []).push(m);
    });
    const byDept: Record<string, { pickups: number[]; responses: number[] }> = {};
    // Inicializa todos os departamentos conhecidos
    Object.keys(departments).forEach((id) => {
      byDept[id] = { pickups: [], responses: [] };
    });
    convs.forEach((c) => {
      if (!c.department_id) return;
      const ms = msgsByConv[c.id] || [];
      const firstAgentMsg = ms.find((m) => m.sender_type === "agent");
      byDept[c.department_id] = byDept[c.department_id] || { pickups: [], responses: [] };
      if (firstAgentMsg) {
        const pickup = businessSecondsBetween(
          new Date(c.created_at).getTime(),
          new Date(firstAgentMsg.created_at).getTime(),
        );
        if (pickup >= 0) byDept[c.department_id].pickups.push(pickup);
      }
      let lastContactAt: number | null = null;
      ms.forEach((m) => {
        if (m.sender_type === "contact") {
          if (lastContactAt === null) lastContactAt = new Date(m.created_at).getTime();
        } else if (m.sender_type === "agent" && lastContactAt !== null) {
          const diff = businessSecondsBetween(lastContactAt, new Date(m.created_at).getTime());
          if (diff >= 0) byDept[c.department_id!].responses.push(diff);
          lastContactAt = null;
        }
      });
    });
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return Object.entries(byDept)
      .filter(([id]) => departments[id] && departments[id].trim() !== "")
      .map(([id, v]) => ({
        id,
        name: departments[id],
        pickup: avg(v.pickups),
        response: avg(v.responses),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [convs, messages, departments]);

  const pickupScore = slaScore(stats.avgPickup);
  const responseScore = slaScore(stats.avgResponse);

  return (
    <AppLayout>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary" /> SLA — Atendimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tempo de espera, tempo para pegar atendimento e tempo de resposta — por departamento e atendente.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ⏱️ Horário comercial: Seg–Sex, 08h–18h. Meta SLA: ≤10min Excelente · ≤30min Bom · ≤1h Regular · &gt;1h Crítico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="all">Todos os departamentos</option>
              {Object.entries(departments).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  days === r.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calculando métricas...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Clock className="w-5 h-5" />}
              label="Tempo p/ pegar atendimento"
              value={fmt(stats.avgPickup)}
              hint={pickupScore.label}
              accent={pickupScore.color}
            />
            <KpiCard
              icon={<Zap className="w-5 h-5" />}
              label="Tempo médio de resposta"
              value={fmt(stats.avgResponse)}
              hint={responseScore.label}
              accent={responseScore.color}
            />
            <KpiCard
              icon={<UsersIcon className="w-5 h-5" />}
              label="Atendimentos no período"
              value={String(stats.totalConvs)}
              hint={`${stats.handledConvs} respondidos`}
            />
            <KpiCard
              icon={<Building2 className="w-5 h-5" />}
              label="Departamentos ativos"
              value={String(stats.deptRows.length)}
              hint="com SLA medido"
            />
          </div>

          {/* SLA Health Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartPanel title="Saúde — Pegar Atendimento" subtitle="Pontuação geral baseada na meta">
              <GaugeChart score={pickupScore} value={fmt(stats.avgPickup)} />
            </ChartPanel>
            <ChartPanel title="Saúde — Tempo de Resposta" subtitle="Pontuação geral baseada na meta">
              <GaugeChart score={responseScore} value={fmt(stats.avgResponse)} />
            </ChartPanel>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartPanel title="SLA por Departamento" subtitle="Tempo médio (menor = melhor)">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={stats.deptRows.map((d) => ({
                    name: d.name, "Pegar atend.": Math.round(d.pickup), "Resposta": Math.round(d.response),
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                >
                  <defs>
                    <linearGradient id="grad-pickup" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="grad-response" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Pegar atend." fill="url(#grad-pickup)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Resposta" fill="url(#grad-response)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Top 10 Atendentes — Mais Rápidos" subtitle="Ordenado pelo tempo para pegar atendimento">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  layout="vertical"
                  data={stats.agentRows.slice(0, 10).map((a) => ({
                    name: (a.name || "—").split(" ").slice(0, 2).join(" "),
                    pickup: Math.round(a.pickup),
                    response: Math.round(a.response),
                  }))}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={110} />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  />
                  <Bar dataKey="pickup" name="Pegar atend." radius={[0, 6, 6, 0]}>
                    {stats.agentRows.slice(0, 10).map((a, i) => (
                      <Cell key={i} fill={slaScore(a.pickup).color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          {/* Ranking Podium */}
          {stats.agentRows.length > 0 && (
            <ChartPanel title="🏆 Ranking dos Atendentes" subtitle="Top performance no período">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.agentRows.slice(0, 3).map((a, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const bgs = ["from-yellow-500/20 to-yellow-500/5", "from-slate-400/20 to-slate-400/5", "from-orange-600/20 to-orange-600/5"];
                  const score = slaScore(a.pickup);
                  return (
                    <div key={a.id} className={`bg-gradient-to-br ${bgs[i]} border border-border rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl">{medals[i]}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${score.color}25`, color: score.color }}>
                          {score.label}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Pegar: <span className="text-foreground font-medium">{fmt(a.pickup)}</span></div>
                      <div className="text-xs text-muted-foreground">Resposta: <span className="text-foreground font-medium">{fmt(a.response)}</span></div>
                      <div className="text-xs text-muted-foreground">{a.convs} atendimentos</div>
                    </div>
                  );
                })}
              </div>
            </ChartPanel>
          )}

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TablePanel title="Detalhamento por Departamento" rows={stats.deptRows} firstColLabel="Departamento" />
            <TablePanel title="Detalhamento por Atendente" rows={stats.agentRows} firstColLabel="Atendente" />
          </div>

          {/* SLA por Departamento — Todos (ignora filtro) */}
          <ChartPanel
            title="SLA por Departamento — Todos os setores"
            subtitle="Tempo p/ pegar atendimento e tempo médio de resposta · cores indicam meta SLA · não afetado pelo filtro acima"
          >
            <ResponsiveContainer width="100%" height={Math.max(280, allDeptStats.length * 60)}>
              <BarChart
                data={allDeptStats.map((d) => ({
                  name: d.name,
                  pickup: Math.round(d.pickup),
                  response: Math.round(d.response),
                }))}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} width={140} />
                <Tooltip
                  formatter={(v: any, n: any) => [fmt(Number(v)), n === "pickup" ? "Pegar atend." : "Resposta"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => value === "pickup" ? "Pegar atendimento" : "Resposta"}
                />
                <Bar dataKey="pickup" name="pickup" radius={[0, 4, 4, 0]}>
                  {allDeptStats.map((d, i) => (
                    <Cell key={`p-${i}`} fill={slaScore(d.pickup).color} />
                  ))}
                </Bar>
                <Bar dataKey="response" name="response" radius={[0, 4, 4, 0]}>
                  {allDeptStats.map((d, i) => (
                    <Cell key={`r-${i}`} fill={slaScore(d.response).color} fillOpacity={0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              <LegendDot color="hsl(142 76% 45%)" label="Excelente (≤10min)" />
              <LegendDot color="hsl(160 70% 45%)" label="Bom (≤30min)" />
              <LegendDot color="hsl(38 92% 55%)" label="Regular (≤1h)" />
              <LegendDot color="hsl(0 78% 58%)" label="Crítico (>1h)" />
            </div>
          </ChartPanel>
        </>
      )}
    </div>
    </AppLayout>
  );
};

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
    {label}
  </div>
);

const KpiCard = ({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string }) => (
  <div className="relative bg-card border border-border rounded-xl p-4 overflow-hidden group hover:shadow-md transition-shadow">
    {accent && <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
      <span style={accent ? { color: accent } : undefined}>{icon}</span> {label}
    </div>
    <div className="text-2xl font-bold text-foreground mt-2 tabular-nums">{value}</div>
    {hint && (
      <p className="text-[11px] mt-1 font-medium" style={accent ? { color: accent } : { color: "hsl(var(--muted-foreground))" }}>
        {hint}
      </p>
    )}
  </div>
);

const ChartPanel = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const GaugeChart = ({ score, value }: { score: ReturnType<typeof slaScore>; value: string }) => (
  <div className="relative h-[220px]">
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        innerRadius="70%"
        outerRadius="100%"
        data={[{ name: "score", value: score.pct, fill: score.color }]}
        startAngle={210}
        endAngle={-30}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "hsl(var(--muted) / 0.4)" }} dataKey="value" cornerRadius={12} />
      </RadialBarChart>
    </ResponsiveContainer>
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-sm font-medium mt-1" style={{ color: score.color }}>{score.label}</div>
    </div>
  </div>
);

const TablePanel = ({ title, rows, firstColLabel }: {
  title: string;
  firstColLabel: string;
  rows: { id: string; name: string; pickup: number; response: number; convs: number }[];
}) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">{firstColLabel}</th>
            <th className="text-right px-4 py-2 font-medium">Pegar atend.</th>
            <th className="text-right px-4 py-2 font-medium">Resposta</th>
            <th className="text-right px-4 py-2 font-medium">Atend.</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Sem dados no período.</td></tr>
          ) : rows.map((r) => {
            const s = slaScore(r.pickup);
            return (
              <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-4 py-2 text-foreground truncate max-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    {r.name}
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: s.color }}>{fmt(r.pickup)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.response)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.convs}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default SLA;

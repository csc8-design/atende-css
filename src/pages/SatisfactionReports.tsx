import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, TrendingUp, Users, MessageSquare, ThumbsUp, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface RatingData {
  id: string;
  rating: number | null;
  comment: string | null;
  requested_at: string;
  responded_at: string | null;
  agent_id: string | null;
  contact_id: string;
}

interface AgentProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const RATING_COLORS = ["hsl(0, 70%, 55%)", "hsl(25, 80%, 55%)", "hsl(45, 80%, 50%)", "hsl(100, 60%, 45%)", "hsl(140, 60%, 40%)"];
const RATING_LABELS = ["Muito Ruim", "Ruim", "Regular", "Bom", "Excelente"];

const SatisfactionReports = () => {
  const { isAdmin, isManager, user } = useAuth();
  const [ratings, setRatings] = useState<RatingData[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [userDepartments, setUserDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
    const since = new Date();
    since.setDate(since.getDate() - daysMap[period]);

    // Fetch user departments for managers
    let depts: string[] = [];
    if (isManager && !isAdmin && user) {
      const { data: deptData } = await supabase
        .from("agent_departments")
        .select("department_id")
        .eq("agent_id", user.id);
      depts = deptData?.map((d) => d.department_id) || [];
      setUserDepartments(depts);
    }

    let query = supabase
      .from("satisfaction_ratings")
      .select("*")
      .gte("requested_at", since.toISOString())
      .order("requested_at", { ascending: false });

    // Filter by department for managers
    if (isManager && !isAdmin && depts.length > 0) {
      query = query.in("department_id", depts);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRatings(data as unknown as RatingData[]);
    }

    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("is_active", true);
    if (profilesData) setProfiles(profilesData);

    setLoading(false);
  };

  const answered = ratings.filter((r) => r.rating !== null);
  const pending = ratings.filter((r) => r.rating === null);
  const avgRating = answered.length > 0
    ? (answered.reduce((sum, r) => sum + (r.rating || 0), 0) / answered.length).toFixed(1)
    : "—";
  const responseRate = ratings.length > 0
    ? ((answered.length / ratings.length) * 100).toFixed(0)
    : "0";
  const csatPositive = answered.filter((r) => (r.rating || 0) >= 4).length;
  const csatScore = answered.length > 0 ? ((csatPositive / answered.length) * 100).toFixed(0) : "—";

  const distribution = [1, 2, 3, 4, 5].map((n) => ({
    rating: n,
    label: RATING_LABELS[n - 1],
    count: answered.filter((r) => r.rating === n).length,
    color: RATING_COLORS[n - 1],
  }));

  const pieData = [
    { name: "Respondidas", value: answered.length, color: "hsl(var(--primary))" },
    { name: "Pendentes", value: pending.length, color: "hsl(var(--muted-foreground))" },
  ];

  // Agent ranking
  const agentMap: Record<string, { total: number; sum: number; count4or5: number; ratings: RatingData[] }> = {};
  answered.forEach((r) => {
    if (!r.agent_id) return;
    if (!agentMap[r.agent_id]) agentMap[r.agent_id] = { total: 0, sum: 0, count4or5: 0, ratings: [] };
    agentMap[r.agent_id].total++;
    agentMap[r.agent_id].sum += r.rating || 0;
    if ((r.rating || 0) >= 4) agentMap[r.agent_id].count4or5++;
    agentMap[r.agent_id].ratings.push(r);
  });

  const agentRanking = Object.entries(agentMap)
    .map(([agentId, data]) => {
      const profile = profiles.find((p) => p.user_id === agentId);
      return {
        agentId,
        name: profile?.full_name || "Desconhecido",
        avatar_url: profile?.avatar_url,
        avg: data.sum / data.total,
        total: data.total,
        csat: (data.count4or5 / data.total) * 100,
      };
    })
    .sort((a, b) => b.avg - a.avg);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-screen pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Avaliação de Atendimento</h1>
            <p className="text-sm text-muted-foreground mt-1">Métricas de satisfação dos clientes (CSAT)</p>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-xs font-medium text-muted-foreground">Nota Média</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{avgRating}</p>
            <p className="text-xs text-muted-foreground mt-1">de 5.0</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">CSAT Score</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{csatScore}%</p>
            <p className="text-xs text-muted-foreground mt-1">notas 4 e 5</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total Enviadas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{ratings.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{answered.length} respondidas</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Taxa de Resposta</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{responseRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{pending.length} pendentes</p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Distribution */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">Distribuição das Notas</h3>
            {answered.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma avaliação respondida no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={distribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value} avaliações`, "Quantidade"]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">Taxa de Resposta</h3>
            {ratings.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Star Rating Visual */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">Resumo Visual</h3>
          <div className="space-y-3">
            {distribution.slice().reverse().map((d) => {
              const pct = answered.length > 0 ? (d.count / answered.length) * 100 : 0;
              return (
                <div key={d.rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20 justify-end">
                    {Array.from({ length: d.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{d.count}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent Ranking */}
        {agentRanking.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Ranking por Atendente
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">#</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Atendente</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Nota Média</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">CSAT %</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Avaliações</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Estrelas</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRanking.map((agent, idx) => (
                    <tr key={agent.agentId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`text-sm font-bold ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-muted-foreground" : idx === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                          {idx + 1}º
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {agent.avatar_url ? (
                            <img src={agent.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {agent.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                          <span className="font-medium text-foreground">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-lg font-bold text-foreground">{agent.avg.toFixed(1)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          agent.csat >= 80 ? "bg-green-500/10 text-green-600" : agent.csat >= 60 ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-600"
                        }`}>
                          {agent.csat.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm text-muted-foreground">{agent.total}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < Math.round(agent.avg) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Ratings with agent name */}
        {answered.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">Avaliações Recentes</h3>
            <div className="space-y-3">
              {answered.slice(0, 10).map((r) => {
                const agentProfile = r.agent_id ? profiles.find((p) => p.user_id === r.agent_id) : null;
                return (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < (r.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      {agentProfile && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {agentProfile.full_name}
                        </span>
                      )}
                      {r.comment && (
                        <span className="text-sm text-muted-foreground italic">"{r.comment}"</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.responded_at ? new Date(r.responded_at).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">Carregando avaliações...</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SatisfactionReports;

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BriefcaseBusiness,
  MessageSquare,
  Search,
  Trash2,
  Loader2,
  Activity,
  Download,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "@/lib/maskPhone";
import { useCarteira, TARGET_DEPARTMENTS, TargetDept } from "@/hooks/useCarteira";
import { useAuth } from "@/contexts/AuthContext";

const leadConfig: Record<string, { label: string; color: string; icon: string }> = {
  quente: { label: "Quente", color: "text-red-600 bg-red-500/10 border-red-500/30", icon: "🔥" },
  morno: { label: "Morno", color: "text-yellow-700 bg-yellow-500/10 border-yellow-500/30", icon: "🌤️" },
  frio: { label: "Frio", color: "text-blue-600 bg-blue-500/10 border-blue-500/30", icon: "❄️" },
};

const interestTypeConfig: Record<string, { label: string; color: string }> = {
  maquina: { label: "Máquina", color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
  pecas: { label: "Peças", color: "text-indigo-700 bg-indigo-500/10 border-indigo-500/30" },
  servico: { label: "Serviço", color: "text-amber-700 bg-amber-500/10 border-amber-500/30" },
  outro: { label: "Outro", color: "text-muted-foreground bg-muted border-border" },
};

export default function MinhaCarteira() {
  const { user } = useAuth();
  const {
    contacts,
    convs,
    interests,
    setInterests,
    agents,
    agentDeptMap,
    loading,
    isAdmin,
    isSupervisor,
    isOnlyAgent,
    hasInteracted60d,
    setContacts,
  } = useCarteira();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);


  const handleOpenChat = (contactId: string) => {
    const conv = convs[contactId];
    if (conv?.id) navigate(`/inbox?conversation=${conv.id}`);
    else navigate(`/inbox`);
  };

  const handleRemove = async (contactId: string) => {
    if (!confirm("Remover este cliente da carteira?")) return;
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: null })
      .eq("id", contactId);
    if (error) toast.error(`Erro: ${error.message}`);
    else {
      toast.success("Removido da carteira");
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    }
  };

  const agentNameOf = (id: string | null) => {
    if (!id) return "—";
    return agents.find((x) => x.user_id === id)?.full_name || "Agente";
  };

  const agentDeptLabel = (id: string | null) => {
    if (!id) return "—";
    return (agentDeptMap[id] || []).join(", ") || "—";
  };

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (agentFilter !== "all" && c.assigned_agent_id !== agentFilter) return false;
      if (deptFilter !== "all") {
        const ds = c.assigned_agent_id ? agentDeptMap[c.assigned_agent_id] || [] : [];
        if (!ds.includes(deptFilter as TargetDept)) return false;
      }
      if (tempFilter !== "all") {
        if (convs[c.id]?.lead_score !== tempFilter) return false;
      }
      if (statusFilter !== "all") {
        const active = hasInteracted60d(c.id);
        if (statusFilter === "active" && !active) return false;
        if (statusFilter === "inactive" && active) return false;
      }
      if (interestFilter !== "all") {
        const it = interests[c.id];
        if (interestFilter === "none" && it?.interest) return false;
        if (interestFilter !== "none" && it?.interest_type !== interestFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const ok =
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company_name?.toLowerCase().includes(q) ||
          interests[c.id]?.interest?.toLowerCase().includes(q);
        if (!ok) return false;
      }
      return true;
    });
  }, [contacts, agentFilter, deptFilter, tempFilter, statusFilter, interestFilter, search, convs, interests, agentDeptMap, hasInteracted60d]);

  const interactionRate = useMemo(() => {
    if (!filtered.length) return 0;
    const active = filtered.filter((c) => hasInteracted60d(c.id)).length;
    return Math.round((active / filtered.length) * 100);
  }, [filtered, hasInteracted60d]);

  const analyzeInterests = async () => {
    const targets = filtered.filter((c) => convs[c.id]).map((c) => c.id);
    if (!targets.length) {
      toast.error("Nenhum cliente com conversa para analisar");
      return;
    }
    setAnalyzing(true);
    setProgress({ done: 0, total: targets.length });
    const CHUNK = 15;
    let ok = 0;
    try {
      for (let i = 0; i < targets.length; i += CHUNK) {
        const slice = targets.slice(i, i + CHUNK);
        const { data, error } = await supabase.functions.invoke("analyze-contact-interest", {
          body: { contactIds: slice },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok += (data as any)?.analyzed || 0;
        setProgress({ done: Math.min(i + CHUNK, targets.length), total: targets.length });
      }
      const { data: itd } = await supabase
        .from("contact_interests")
        .select("contact_id, interest, interest_type, brands, models, last_analyzed_at")
        .in("contact_id", targets);
      setInterests((prev) => {
        const next = { ...prev };
        (itd || []).forEach((r: any) => {
          next[r.contact_id] = {
            interest: r.interest,
            interest_type: r.interest_type,
            brands: r.brands,
            models: r.models,
            last_analyzed_at: r.last_analyzed_at,
          };
        });
        return next;
      });
      toast.success(`Análise concluída — ${ok} cliente(s) atualizados`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao analisar interesses");
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const exportCsv = () => {
    const headers = ["Nome", "Empresa", "Telefone", "Email", "Interesse", "Tipo interesse", "Agente", "Departamento", "Categoria", "Temperatura", "Ativo 60d", "Última interação"];
    const rows = filtered.map((c) => {
      const conv = convs[c.id];
      const it = interests[c.id];
      return [
        c.name || "",
        c.company_name || "",
        c.phone || "",
        c.email || "",
        it?.interest || "",
        it?.interest_type ? interestTypeConfig[it.interest_type]?.label || it.interest_type : "",
        agentNameOf(c.assigned_agent_id),
        agentDeptLabel(c.assigned_agent_id),
        c.category || "",
        conv?.lead_score || "",
        hasInteracted60d(c.id) ? "Sim" : "Não",
        conv?.last_message_at ? new Date(conv.last_message_at).toLocaleDateString("pt-BR") : "",
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minha-carteira-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scopeLabel = isAdmin
    ? "Todas as carteiras"
    : isSupervisor
    ? "Carteiras dos seus departamentos"
    : "Sua carteira pessoal";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BriefcaseBusiness className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Minha Carteira</h1>
            <p className="text-sm text-muted-foreground">{scopeLabel}</p>
          </div>
          <Button variant="outline" size="sm" onClick={analyzeInterests} disabled={analyzing || !filtered.length}>
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Analisando {progress ? `${progress.done}/${progress.total}` : ""}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1.5" /> Analisar interesses</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>

        </div>

        {/* KPI top */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Clientes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3" /> Interação 60d
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{interactionRate}%</p>
            <p className="text-[11px] text-muted-foreground">
              {filtered.filter((c) => hasInteracted60d(c.id)).length} ativos
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Quente / Morno / Frio</p>
            <div className="flex gap-2 mt-1.5 text-sm font-semibold">
              <span className="text-red-600">🔥 {filtered.filter((c) => convs[c.id]?.lead_score === "quente").length}</span>
              <span className="text-yellow-700">🌤️ {filtered.filter((c) => convs[c.id]?.lead_score === "morno").length}</span>
              <span className="text-blue-600">❄️ {filtered.filter((c) => convs[c.id]?.lead_score === "frio").length}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Sem interação 60d</p>
            <p className="text-2xl font-bold text-muted-foreground mt-1">
              {filtered.filter((c) => !hasInteracted60d(c.id)).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {!isOnlyAgent && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos departamentos</SelectItem>
                {TARGET_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isOnlyAgent && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue placeholder="Agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={tempFilter} onValueChange={setTempFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Temperatura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temp.</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
              <SelectItem value="morno">🌤️ Morno</SelectItem>
              <SelectItem value="frio">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos 60d</SelectItem>
              <SelectItem value="inactive">Sem interação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={interestFilter} onValueChange={setInterestFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Interesse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos interesses</SelectItem>
              <SelectItem value="maquina">Máquina</SelectItem>
              <SelectItem value="pecas">Peças</SelectItem>
              <SelectItem value="servico">Serviço</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
              <SelectItem value="none">Sem interesse identificado</SelectItem>
            </SelectContent>
          </Select>

        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center bg-card">
            <BriefcaseBusiness className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold">Cliente</th>
                    <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Empresa</th>
                    <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Telefone</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Interesse</th>
                    {!isOnlyAgent && <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Agente</th>}
                    {!isOnlyAgent && <th className="text-left px-3 py-2.5 font-semibold hidden lg:table-cell">Dept.</th>}

                    <th className="text-left px-3 py-2.5 font-semibold">Temp.</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Interação</th>
                    <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Últ. msg</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const initials = (c.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);
                    const conv = convs[c.id];
                    const lead = conv?.lead_score ? leadConfig[conv.lead_score] : null;
                    const active = hasInteracted60d(c.id);
                    const isMine = c.assigned_agent_id === user?.id;
                    const interest = interests[c.id];
                    const itType = interest?.interest_type ? interestTypeConfig[interest.interest_type] : null;

                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarImage src={c.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{c.name}</p>
                              {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell text-muted-foreground truncate max-w-[160px]">
                          {c.company_name || "—"}
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                          {c.phone ? maskPhone(c.phone, false) : "—"}
                        </td>
                        <td className="px-3 py-2 max-w-[240px]">
                          {interest?.interest ? (
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[13px] text-foreground leading-snug line-clamp-2" title={interest.interest}>
                                {interest.interest}
                              </span>
                              {itType && (
                                <span className={`self-start text-[10px] font-semibold px-1.5 py-0.5 rounded border ${itType.color}`}>
                                  {itType.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Não identificado</span>
                          )}
                        </td>

                        {!isOnlyAgent && (
                          <td className="px-3 py-2 hidden md:table-cell text-muted-foreground truncate max-w-[140px]">
                            {agentNameOf(c.assigned_agent_id)}
                          </td>
                        )}
                        {!isOnlyAgent && (
                          <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground truncate max-w-[140px]">
                            {agentDeptLabel(c.assigned_agent_id)}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {lead ? (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${lead.color}`}>
                              {lead.icon} {lead.label}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                              active
                                ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/30"
                                : "text-muted-foreground bg-muted border-border"
                            }`}
                          >
                            {active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell text-muted-foreground text-xs whitespace-nowrap">
                          {conv?.last_message_at
                            ? new Date(conv.last_message_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenChat(c.id)} title="Abrir chat">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          {(isMine || isAdmin || isSupervisor) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemove(c.id)}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
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
    </AppLayout>
  );
}

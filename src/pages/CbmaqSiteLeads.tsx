import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { cbmaqSiteSupabase, type CbmaqSiteLead } from "@/integrations/cbmaq-site/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AiSearchBar from "@/components/leads/AiSearchBar";
import {
  Globe, RefreshCw, Search, Mail, Phone, Building2, FileText, Calendar,
  MessageCircle, CheckCircle2, User2, Users, Inbox, Clock, RotateCcw, Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const waNumber = (phone: string | null | undefined) => {
  const d = onlyDigits(phone);
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
};

const statusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
  switch ((status || "").toUpperCase()) {
    case "PENDENTE": return "secondary";
    case "RETORNADO":
    case "CONCLUIDO":
    case "CONCLUÍDO": return "outline";
    case "EM_ANDAMENTO":
    case "EM ANDAMENTO": return "default";
    case "CANCELADO": return "destructive";
    default: return "secondary";
  }
};

const typeColor = (type: string) =>
  type === "QUOTE"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

const CbmaqSiteLeads = ({ embed = false, topSlot, onFilteredChange }: { embed?: boolean; topSlot?: React.ReactNode; onFilteredChange?: (rows: CbmaqSiteLead[]) => void } = {}) => {
  const RETURNED_KEY = "cbmaq_site_leads_returned_ids";
  const [leads, setLeads] = useState<CbmaqSiteLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [returnFilter, setReturnFilter] = useState<"sem" | "com" | "all">("sem");
  const [selected, setSelected] = useState<CbmaqSiteLead | null>(null);
  const [returnedIds, setReturnedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(RETURNED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilterIds, setAiFilterIds] = useState<Set<string> | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const persistReturned = (s: Set<string>) => {
    try { localStorage.setItem(RETURNED_KEY, JSON.stringify(Array.from(s))); } catch {}
  };
  const isReturnedLead = (l: CbmaqSiteLead) => returnedIds.has(l.id);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await cbmaqSiteSupabase
      .from("Lead").select("*").order("createdAt", { ascending: false });
    if (error) setError(error.message);
    setLeads((data as CbmaqSiteLead[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (aiFilterIds && !aiFilterIds.has(l.id)) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      const isReturned = returnedIds.has(l.id);
      if (returnFilter === "sem" && isReturned) return false;
      if (returnFilter === "com" && !isReturned) return false;
      if (!aiFilterIds && search.trim()) {
        const q = search.toLowerCase();
        const hay = `${l.name || ""} ${l.email || ""} ${l.phone || ""} ${l.company || ""} ${l.message || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, typeFilter, returnFilter, returnedIds, aiFilterIds]);

  useEffect(() => { onFilteredChange?.(filtered); }, [filtered, onFilteredChange]);


  const runAi = async (query: string) => {
    setAiLoading(true);
    setAiReasoning(null);
    try {
      const payload = leads.slice(0, 800).map((l) => ({
        id: l.id,
        text: `${l.name || ""} | ${l.company || ""} | ${l.data?.assunto || l.data?.productName || ""} | ${l.message || ""}`.slice(0, 400),
      }));
      const { data, error } = await supabase.functions.invoke("ai-search-leads", {
        body: { query, source: "client_data", leads: payload, context_hint: "Leads do site CBMaq — contatos e cotações de máquinas" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ids: string[] = (data as any)?.ids ?? [];
      setAiFilterIds(new Set(ids));
      setAiReasoning((data as any)?.reasoning ?? null);
      toast({ title: `IA encontrou ${ids.length} lead(s)` });
    } catch (e: any) {
      toast({ title: "Erro na busca por IA", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const clearAi = () => { setAiFilterIds(null); setAiReasoning(null); };

  const exportLeads = (scope: "filtered" | "all", format: "xlsx" | "csv") => {
    const source = scope === "filtered" ? filtered : leads;
    if (source.length === 0) {
      toast({ title: "Nenhum lead para exportar", variant: "destructive" });
      return;
    }
    const rows = source.map((l) => ({
      ID: l.id,
      Tipo: l.type === "QUOTE" ? "Cotação" : "Contato",
      Status: l.status || "",
      Nome: l.name || "",
      Email: l.email || "",
      Telefone: l.phone || "",
      Empresa: l.company || "",
      Assunto: l.data?.assunto || l.data?.productName || "",
      Mensagem: l.message || "",
      Retornado: returnedIds.has(l.id) ? "Sim" : "Não",
      "Criado em": l.createdAt ? formatDate(l.createdAt) : "",
      "Dados extras": l.data ? JSON.stringify(l.data) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `leads-site-cbmaq-${scope === "filtered" ? "filtrados" : "todos"}-${stamp}`;
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${baseName}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    }
    toast({ title: `Exportado ${source.length} lead(s)` });
  };

  // Base para stats: respeita IA + busca textual + tipo, ignora a aba retornados/não
  const statsBase = useMemo(() => {
    return leads.filter((l) => {
      if (aiFilterIds && !aiFilterIds.has(l.id)) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (!aiFilterIds && search.trim()) {
        const q = search.toLowerCase();
        const hay = `${l.name || ""} ${l.email || ""} ${l.phone || ""} ${l.company || ""} ${l.message || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, typeFilter, aiFilterIds]);

  const stats = useMemo(() => {
    const total = statsBase.length;
    const contato = statsBase.filter((l) => l.type === "CONTATO").length;
    const quote = statsBase.filter((l) => l.type === "QUOTE").length;
    const pendentes = statsBase.filter((l) => (l.status || "").toUpperCase() === "PENDENTE").length;
    const retornados = statsBase.filter((l) => returnedIds.has(l.id)).length;
    return { total, contato, quote, pendentes, retornados };
  }, [statsBase, returnedIds]);


  const buildWhatsAppMessage = (l: CbmaqSiteLead) => {
    const subject = l.data?.assunto || l.data?.productName || "seu contato pelo site";
    return `Olá ${l.name || ""}, aqui é da CBMaq. Recebemos ${l.type === "QUOTE" ? "sua cotação" : "seu contato"} sobre ${subject} e gostaríamos de te ajudar.`;
  };

  const openWhatsApp = (l: CbmaqSiteLead) => {
    const n = waNumber(l.phone);
    if (!n) { toast({ title: "Telefone inválido", variant: "destructive" }); return; }
    const text = encodeURIComponent(buildWhatsAppMessage(l));
    window.open(`https://web.whatsapp.com/send?phone=${n}&text=${text}`, "_blank");
  };

  const openEmail = (l: CbmaqSiteLead) => {
    if (!l.email) { toast({ title: "E-mail não informado", variant: "destructive" }); return; }
    const subject = encodeURIComponent(`CBMaq - Retorno sobre ${l.data?.assunto || l.data?.productName || "seu contato"}`);
    const body = encodeURIComponent(`Olá ${l.name || ""},\n\nRecebemos seu contato pelo site da CBMaq e estamos retornando.\n\n`);
    window.open(`mailto:${l.email}?subject=${subject}&body=${body}`, "_blank");
  };

  const markReturned = (l: CbmaqSiteLead) => {
    setReturnedIds((prev) => {
      const next = new Set(prev);
      const willReturn = !next.has(l.id);
      if (willReturn) next.add(l.id); else next.delete(l.id);
      persistReturned(next);
      toast({ title: willReturn ? "Lead marcado como retornado" : "Lead reaberto" });
      return next;
    });
  };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    embed ? <>{children}</> : <AppLayout>{children}</AppLayout>;

  return (
    <Wrapper>
      <div className={embed ? "space-y-6" : "p-6 lg:p-8 max-w-7xl mx-auto space-y-6"}>
        {/* Header (oculto quando embutido em outra página) */}
        {!embed && (
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Lead - site CBMaq</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Leads capturados diretamente do site cbmaq.com.br
                </p>
              </div>
            </div>
            <Button onClick={fetchLeads} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Globe, tone: "from-primary/15 to-primary/5 text-primary" },
            { label: "Contatos", value: stats.contato, icon: Users, tone: "from-blue-500/15 to-blue-500/5 text-blue-600" },
            { label: "Cotações", value: stats.quote, icon: FileText, tone: "from-amber-500/15 to-amber-500/5 text-amber-600" },
            { label: "Pendentes", value: stats.pendentes, icon: Clock, tone: "from-orange-500/15 to-orange-500/5 text-orange-600" },
            { label: "Retornados", value: stats.retornados, icon: CheckCircle2, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="relative overflow-hidden p-5 border-border/60 hover:shadow-md transition-shadow min-h-[110px]">
                <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${s.tone} opacity-50 blur-2xl pointer-events-none`} />
                <div className="relative flex flex-col h-full gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground line-clamp-2 leading-tight">
                      {s.label}
                    </p>
                    <div className={`shrink-0 p-2 rounded-lg bg-gradient-to-br ${s.tone} ring-1 ring-border/40`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums leading-none text-foreground break-words">
                    {loading ? "—" : s.value.toLocaleString("pt-BR")}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {topSlot}



        {/* Busca por IA */}
        <AiSearchBar
          loading={aiLoading}
          reasoning={aiReasoning}
          active={aiFilterIds !== null}
          resultCount={aiFilterIds ? filtered.length : null}
          onSearch={runAi}
          onClear={clearAi}
          placeholder="Pergunte... ex: cotações de retroescavadeira, contatos de São Paulo"
        />

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="CONTATO">Contato</SelectItem>
              <SelectItem value="QUOTE">Cotação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-xl p-4 text-sm">
            Erro ao carregar leads: {error}
          </div>
        )}

        {/* Tabs Retornados / Não retornados */}
        <Tabs value={returnFilter} onValueChange={(v) => setReturnFilter(v as any)} className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-3 h-auto">
            <TabsTrigger value="sem" className="gap-2 py-2">
              Não retornados
              <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full px-2 py-0.5">
                {stats.total - stats.retornados}
              </span>
            </TabsTrigger>
            <TabsTrigger value="com" className="gap-2 py-2">
              Retornados
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full px-2 py-0.5">
                {stats.retornados}
              </span>
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2 py-2">
              Todos
              <span className="text-[10px] font-semibold bg-muted text-foreground rounded-full px-2 py-0.5">
                {stats.total}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Cards Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando leads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            Nenhum lead encontrado
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((l) => {
              const subject = l.data?.assunto || l.data?.productName || null;
              const isReturned = isReturnedLead(l);
              return (
                <div
                  key={l.id}
                  className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                    isReturned ? "border-emerald-500/40" : "border-border"
                  }`}
                >
                  {/* Top: type + status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor(l.type)}`}>
                      {l.type === "QUOTE" ? "Cotação" : "Contato"}
                    </span>
                    <Badge variant={statusVariant(l.status)} className="text-[10px]">
                      {l.status || "—"}
                    </Badge>
                  </div>

                  {/* Identity */}
                  <button
                    type="button"
                    onClick={() => setSelected(l)}
                    className="text-left -mx-1 px-1 rounded-md hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{l.name || "Sem nome"}</p>
                        {l.company && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {l.company}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Contact */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {l.phone && (
                      <p className="flex items-center gap-1.5 truncate"><Phone className="w-3 h-3" /> {l.phone}</p>
                    )}
                    {l.email && (
                      <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3" /> {l.email}</p>
                    )}
                    {subject && (
                      <p className="flex items-center gap-1.5 truncate"><FileText className="w-3 h-3" /> {subject}</p>
                    )}
                    <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {formatDate(l.createdAt)}</p>
                  </div>

                  {l.message && (
                    <button
                      type="button"
                      onClick={() => setSelected(l)}
                      className="text-left text-xs text-foreground/80 bg-muted/40 hover:bg-muted/70 rounded-md p-2 line-clamp-3 transition-colors cursor-pointer"
                      title="Clique para ver a mensagem completa"
                    >
                      {l.message}
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[110px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                      onClick={() => openWhatsApp(l)}
                      disabled={!l.phone}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[90px]"
                      onClick={() => openEmail(l)}
                      disabled={!l.email}
                    >
                      <Mail className="w-3.5 h-3.5 mr-1" /> E-mail
                    </Button>
                    <Button
                      size="sm"
                      variant={isReturned ? "secondary" : "default"}
                      className="flex-1 min-w-[120px]"
                      onClick={() => markReturned(l)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {isReturned ? "Retornado ✓" : "Marcar retornado"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor(selected?.type || "")}`}>
                  {selected?.type === "QUOTE" ? "Cotação" : "Contato"}
                </span>
                {selected?.name || "Lead"}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow icon={Mail} label="Email" value={selected.email} />
                  <InfoRow icon={Phone} label="Telefone" value={selected.phone} />
                  <InfoRow icon={Building2} label="Empresa" value={selected.company} />
                  <InfoRow icon={Calendar} label="Criado em" value={formatDate(selected.createdAt)} />
                </div>

                {selected.message && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Mensagem
                    </p>
                    <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {selected.message}
                    </div>
                  </div>
                )}

                {selected.data && Object.keys(selected.data).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Dados adicionais</p>
                    <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                      {Object.entries(selected.data).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-sm">
                          <span className="font-medium text-foreground capitalize min-w-[120px]">{k}:</span>
                          <span className="text-muted-foreground break-all">
                            {typeof v === "string" && v.startsWith("http") ? (
                              <a href={v} target="_blank" rel="noreferrer" className="text-primary hover:underline">{v}</a>
                            ) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => openWhatsApp(selected)}
                    disabled={!selected.phone}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp Web
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEmail(selected)} disabled={!selected.email}>
                    <Mail className="w-4 h-4 mr-1.5" /> Enviar e-mail
                  </Button>
                  <Button
                    size="sm"
                    variant={isReturnedLead(selected) ? "secondary" : "default"}
                    onClick={() => markReturned(selected)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {isReturnedLead(selected) ? "Retornado ✓" : "Marcar retornado"}
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge variant={statusVariant(selected.status)}>{selected.status || "—"}</Badge>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Wrapper>
  );
};

export const CbmaqSiteLeadsInner = ({ topSlot, onFilteredChange }: { topSlot?: React.ReactNode; onFilteredChange?: (rows: CbmaqSiteLead[]) => void } = {}) => (
  <CbmaqSiteLeads embed topSlot={topSlot} onFilteredChange={onFilteredChange} />
);

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => (
  <div className="flex items-start gap-2">
    <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-all">{value || "—"}</p>
    </div>
  </div>
);

export default CbmaqSiteLeads;

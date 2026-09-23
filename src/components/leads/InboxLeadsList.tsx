import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, RefreshCw, Search, Inbox as InboxIcon, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { maskPhone, maskEmail } from "@/lib/maskPhone";
import AiSearchBar from "@/components/leads/AiSearchBar";

const PAGE_SIZE = 50;

type Row = {
  conversation_id: string;
  contact_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  last_message_at: string | null;
  ai_summary: string | null;
  subject: string | null;
  channel: string | null;
  department_name: string | null;
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
};

type Props = {
  onFilteredChange?: (rows: Row[]) => void;
};

const InboxLeadsList = ({ onFilteredChange }: Props = {}) => {
  const { isAdmin, isManager } = useAuth();
  const canSeeFull = isAdmin || isManager;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Filtros por coluna (client-side, sobre a página carregada)
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = (k: string, v: string) =>
    setColFilters((s) => ({ ...s, [k]: v }));

  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilterIds, setAiFilterIds] = useState<string[] | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const fetchPage = async () => {
    setLoading(true);
    setError(null);

    let q = supabase
      .from("conversations")
      .select(
        "id, contact_id, last_message_at, ai_summary, subject, channel, department_id, contacts!inner(id,name,phone,email,company_name), departments(name)",
        { count: "exact" }
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false });

    if (aiFilterIds && aiFilterIds.length > 0) {
      q = q.in("contact_id", aiFilterIds);
    } else if (aiFilterIds && aiFilterIds.length === 0) {
      setRows([]); setTotal(0); setLoading(false); return;
    } else if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(
        `name.ilike.${s},phone.ilike.${s},email.ilike.${s},company_name.ilike.${s}`,
        { foreignTable: "contacts" }
      );
    }

    q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, error, count } = await q;
    if (error) { setError(error.message); setLoading(false); return; }

    const seen = new Set<string>();
    const mapped: Row[] = [];
    (data as any[]).forEach((c) => {
      if (!c.contact_id || seen.has(c.contact_id)) return;
      seen.add(c.contact_id);
      mapped.push({
        conversation_id: c.id,
        contact_id: c.contact_id,
        name: c.contacts?.name ?? null,
        phone: c.contacts?.phone ?? null,
        email: c.contacts?.email ?? null,
        company_name: c.contacts?.company_name ?? null,
        last_message_at: c.last_message_at,
        ai_summary: c.ai_summary,
        subject: c.subject,
        channel: c.channel,
        department_name: c.departments?.name ?? null,
      });
    });

    // Buscar o último setor escolhido pelo cliente via chatbot (não o setor atual da conversa)
    const contactIds = mapped.map((m) => m.contact_id);
    if (contactIds.length > 0) {
      const { data: logs } = await supabase
        .from("chatbot_logs")
        .select("contact_id, created_at, chatbot_configs!inner(department_id, departments(name))")
        .in("contact_id", contactIds)
        .not("chatbot_config_id", "is", null)
        .order("created_at", { ascending: false });

      if (logs && logs.length > 0) {
        const lastByContact = new Map<string, string>();
        (logs as any[]).forEach((l) => {
          if (!l.contact_id || lastByContact.has(l.contact_id)) return;
          const name = l.chatbot_configs?.departments?.name;
          if (name) lastByContact.set(l.contact_id, name);
        });
        mapped.forEach((r) => {
          const chosen = lastByContact.get(r.contact_id);
          if (chosen) r.department_name = chosen;
        });
      }
    }

    setRows(mapped);
    setTotal(count || mapped.length);
    setLoading(false);
  };


  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, aiFilterIds]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      fetchPage();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const runAi = async (query: string) => {
    setAiLoading(true);
    setAiReasoning(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search-leads", {
        body: { query, limit: 500, source: "inbox" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ids: string[] = (data as any)?.ids ?? (data as any)?.contact_ids ?? [];
      setAiFilterIds(ids);
      setAiReasoning((data as any)?.reasoning ?? null);
      setPage(0);
      toast({ title: `IA encontrou ${ids.length} lead(s)` });
    } catch (e: any) {
      toast({ title: "Erro na busca por IA", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const clearAi = () => { setAiFilterIds(null); setAiReasoning(null); setPage(0); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Aplica filtros por coluna sobre as linhas da página atual
  const filteredRows = (() => {
    const active = Object.entries(colFilters).filter(([, v]) => v && v.trim());
    if (active.length === 0) return rows;
    return rows.filter((r) => {
      return active.every(([col, raw]) => {
        const q = raw.trim().toLowerCase();
        const text = (() => {
          switch (col) {
            case "name": return r.name ?? "";
            case "phone": return r.phone ?? "";
            case "email": return r.email ?? "";
            case "company": return r.company_name ?? "";
            case "dept": return r.department_name ?? "";
            case "subject": return `${r.ai_summary ?? ""} ${r.subject ?? ""}`;
            case "channel": return r.channel ?? "";
            case "date": return formatDate(r.last_message_at);
            default: return "";
          }
        })();
        return String(text).toLowerCase().includes(q);
      });
    });
  })();

  useEffect(() => {
    onFilteredChange?.(filteredRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, colFilters]);

  useEffect(() => { setPage(0); }, [colFilters]);

  // Análise automática: dispara ai-analyze (em background) para conversas sem resumo
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedKeys, setAnalyzedKeys] = useState<Set<string>>(new Set());

  const triggerAnalyze = async (ids: string[], manual = false) => {
    if (!ids.length) {
      if (manual) toast({ title: "Nenhuma conversa precisa de análise" });
      return;
    }
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke("ai-analyze", {
        body: { conversationIds: ids, background: true },
      });
      if (error) throw error;
      setAnalyzedKeys((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.add(id));
        return n;
      });
      if (manual) toast({ title: `Analisando ${ids.length} conversa(s) em segundo plano` });
      // Recarrega após alguns segundos para refletir resumos novos
      setTimeout(() => { fetchPage(); }, Math.min(8000, 2000 + ids.length * 400));
    } catch (e: any) {
      if (manual) toast({ title: "Erro ao iniciar análise", description: e?.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-dispara para linhas visíveis sem ai_summary (uma vez por id)
  useEffect(() => {
    const missing = rows
      .filter((r) => !r.ai_summary && r.conversation_id && !analyzedKeys.has(r.conversation_id))
      .slice(0, 20)
      .map((r) => r.conversation_id);
    if (missing.length > 0) {
      triggerAnalyze(missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);




  return (
    <div className="space-y-4">
      <AiSearchBar
        loading={aiLoading}
        reasoning={aiReasoning}
        active={aiFilterIds !== null}
        resultCount={aiFilterIds?.length ?? null}
        onSearch={runAi}
        onClear={clearAi}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Leads que conversaram no Inbox · {total.toLocaleString("pt-BR")}{aiFilterIds ? " (filtrado por IA)" : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone, email, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!!aiFilterIds}
              className="pl-9 w-80"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => triggerAnalyze(rows.filter((r) => !r.ai_summary).map((r) => r.conversation_id), true)}
            disabled={analyzing || loading || rows.length === 0}
            title="Gerar resumo IA das conversas sem análise"
          >
            <Sparkles className={`w-4 h-4 mr-2 ${analyzing ? "animate-pulse" : ""}`} />
            Analisar IA
          </Button>
          <Button variant="outline" onClick={fetchPage} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Interesse</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Última mensagem</TableHead>
                  </TableRow>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    {[
                      { k: "name", ph: "nome" },
                      { k: "phone", ph: "tel" },
                      { k: "email", ph: "email" },
                      { k: "company", ph: "empresa" },
                      { k: "dept", ph: "setor" },
                      { k: "subject", ph: "interesse" },
                      { k: "channel", ph: "canal" },
                      { k: "date", ph: "data" },
                    ].map(({ k, ph }) => (
                      <TableHead key={k} className="py-2">
                        <Input
                          value={colFilters[k] ?? ""}
                          onChange={(e) => setColFilter(k, e.target.value)}
                          placeholder={ph}
                          className="h-7 text-xs px-2"
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        Nenhum resultado para os filtros de coluna.
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.map((r) => (
                    <TableRow key={r.contact_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{r.name || "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {r.phone ? maskPhone(r.phone, !canSeeFull) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.email ? maskEmail(r.email, !canSeeFull) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.company_name ? <Badge variant="outline">{r.company_name}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.department_name ? <Badge variant="outline" className="bg-primary/5">{r.department_name}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px]">
                        {(() => {
                          const full = r.ai_summary || r.subject || "";
                          if (!full) return <span className="text-muted-foreground">—</span>;
                          const isAi = !!r.ai_summary;
                          const short = full.length > 60 ? full.slice(0, 60).trimEnd() + "…" : full;
                          return (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-1 truncate max-w-full">
                                    {isAi && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
                                    <span className="truncate">{short}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-md whitespace-pre-wrap text-xs leading-relaxed">
                                  {isAi && <div className="font-semibold text-primary mb-1">Resumo IA</div>}
                                  {full}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.channel ? <Badge variant="secondary" className="capitalize">{r.channel}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(r.last_message_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <div className="text-xs text-muted-foreground">
                Pág <span className="font-medium">{page + 1}</span> / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default InboxLeadsList;

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sprout,
  DownloadCloud,
  Users,
  DollarSign,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clientesComprasSupabase } from "@/integrations/clientes-compras/client";
import { toast } from "sonner";

interface PopAgroLead {
  id: string;
  popagro_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  produto_nome: string | null;
  produto_modelo: string | null;
  produto_valor: number | null;
  produto_foto: string | null;
  status: string | null;
  data_lead: string | null;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

const formatMoney = (n: number | null | undefined) => {
  if (n == null || isNaN(n as number)) return "-";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatMoneyCompact = (n: number) =>
  n.toLocaleString("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 2,
    style: "currency",
    currency: "BRL",
  });

const formatPhone = (p: string | null) => {
  if (!p) return "-";
  const digits = String(p).replace(/\D/g, "");
  if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return p;
};

const PopAgroLeadsList = () => {
  const [rows, setRows] = useState<PopAgroLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);

  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = (k: string, v: string) =>
    setColFilters((s) => ({ ...s, [k]: v }));

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const CHUNK = 1000;
      let all: PopAgroLead[] = [];
      for (let from = 0; from < 20000; from += CHUNK) {
        const { data, error } = await clientesComprasSupabase
          .from("leads_popagro")
          .select(
            "id,popagro_id,nome,email,telefone,cidade,uf,produto_nome,produto_modelo,produto_valor,produto_foto,status,data_lead"
          )
          .order("data_lead", { ascending: false, nullsFirst: false })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as PopAgroLead[]);
        if (data.length < CHUNK) break;
      }
      setRows(all);
    } catch (e: any) {
      setError(e.message || "Erro ao consultar leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [colFilters, pageSize]);

  // Stats sobre o dataset completo
  const stats = useMemo(() => {
    const total = rows.length;
    const valorTotal = rows.reduce((acc, r) => acc + (Number(r.produto_valor) || 0), 0);
    const statusCounts = new Map<string, number>();
    rows.forEach((r) => {
      const s = r.status || "SEM STATUS";
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    });
    const statusSorted = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
    return { total, valorTotal, statusSorted };
  }, [rows]);

  // Filtros por coluna
  const filteredRows = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, v]) => v && v.trim());
    if (active.length === 0) return rows;
    return rows.filter((r) =>
      active.every(([k, raw]) => {
        const q = raw.trim().toLowerCase();
        const text = (() => {
          switch (k) {
            case "nome": return `${r.nome ?? ""}`;
            case "telefone": return `${r.telefone ?? ""}`;
            case "email": return `${r.email ?? ""}`;
            case "cidade": return `${r.cidade ?? ""} ${r.uf ?? ""}`;
            case "produto": return `${r.produto_nome ?? ""}`;
            case "modelo": return `${r.produto_modelo ?? ""}`;
            case "valor": return r.produto_valor != null ? String(r.produto_valor) : "";
            case "status": return `${r.status ?? ""}`;
            default: return "";
          }
        })();
        return text.toLowerCase().includes(q);
      })
    );
  }, [rows, colFilters]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-popagro-leads");
      if (error) throw error;
      toast.success(data?.mensagem || "Sincronização concluída");
      await fetchLeads();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao sincronizar com PopAgro");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden p-5 border-border/60 min-h-[110px]">
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Total de clientes · PopAgro
              </p>
              <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-border/40">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {stats.total.toLocaleString("pt-BR")}
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-5 border-border/60 min-h-[110px]">
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Total em reais
              </p>
              <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-1 ring-border/40">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p
              className="text-2xl font-bold tabular-nums leading-none break-words"
              title={formatMoney(stats.valorTotal)}
            >
              {formatMoneyCompact(stats.valorTotal)}
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-5 border-border/60 min-h-[110px] col-span-2 lg:col-span-1">
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Status dos leads
              </p>
              <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 ring-1 ring-border/40">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            {stats.statusSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stats.statusSorted.map(([s, n]) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="text-[11px] font-medium tabular-nums"
                  >
                    {s}: {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={fetchLeads} disabled={loading || syncing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <DownloadCloud className="w-4 h-4 mr-1.5" />
          )}
          Sincronizar Agora
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-primary" />
            <span>{totalFiltered.toLocaleString("pt-BR")} leads encontrados</span>
          </div>
          <div>Página {page + 1} de {totalPages}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[90px]">Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="py-2" />
                  {[
                    { k: "nome", ph: "nome", cls: "min-w-[160px]" },
                    { k: "telefone", ph: "telefone", cls: "min-w-[140px]" },
                    { k: "email", ph: "e-mail", cls: "min-w-[160px]" },
                    { k: "cidade", ph: "cidade / uf", cls: "min-w-[140px]" },
                    { k: "produto", ph: "produto", cls: "min-w-[160px]" },
                    { k: "modelo", ph: "modelo", cls: "min-w-[120px]" },
                    { k: "valor", ph: "valor", cls: "text-right w-[120px]" },
                    { k: "status", ph: "status", cls: "min-w-[120px]" },
                  ].map(({ k, ph, cls }) => (
                    <TableHead key={k} className={`py-2 ${cls}`}>
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
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="py-3">
                        {r.produto_foto ? (
                          <img
                            src={r.produto_foto}
                            alt={r.produto_nome || "Produto"}
                            loading="lazy"
                            className="w-16 h-16 object-cover rounded-md border bg-muted"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3"><div className="font-medium">{r.nome || "-"}</div></TableCell>
                      <TableCell className="py-3 whitespace-nowrap">{formatPhone(r.telefone)}</TableCell>
                      <TableCell className="py-3 text-xs">{r.email || "-"}</TableCell>
                      <TableCell className="py-3">{r.cidade || "-"}{r.uf ? `/${r.uf}` : ""}</TableCell>
                      <TableCell className="py-3">{r.produto_nome || "-"}</TableCell>
                      <TableCell className="py-3">{r.produto_modelo || "-"}</TableCell>
                      <TableCell className="py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(r.produto_valor)}
                      </TableCell>
                      <TableCell className="py-3"><Badge variant="secondary">{r.status || "-"}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 gap-4 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Mostrando{" "}
            <span className="font-medium">
              {pageRows.length === 0 ? 0 : page * pageSize + 1}–{page * pageSize + pageRows.length}
            </span>{" "}
            de <span className="font-medium">{totalFiltered.toLocaleString("pt-BR")}</span> leads
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Por página:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs">Pág {page + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PopAgroLeadsList;

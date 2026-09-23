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
  PartyPopper,
  Users,
  Activity,
  MapPin,
} from "lucide-react";
import { arraiaSupabase } from "@/integrations/arraia/client";

export interface ArraiaLead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  produto: string | null;
  empresa: string | null;
  segmento: string | null;
  campanha: string | null;
  observacoes: string | null;
  status: string | null;
  origem: string | null;
  created_at: string | null;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

const formatPhone = (p: string | null) => {
  if (!p) return "-";
  const digits = String(p).replace(/\D/g, "");
  if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return p;
};

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
};

const ArraiaLeadsList = () => {
  const [rows, setRows] = useState<ArraiaLead[]>([]);
  const [loading, setLoading] = useState(true);
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
      let all: ArraiaLead[] = [];
      for (let from = 0; from < 20000; from += CHUNK) {
        const { data, error } = await arraiaSupabase
          .from("campaign_leads" as any)
          .select("id,nome,email,telefone,cidade,produto,empresa,segmento,campanha,status,origem,created_at")
          .order("created_at", { ascending: false, nullsFirst: false })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as unknown as ArraiaLead[]);
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

  useEffect(() => { fetchLeads(); }, []);
  useEffect(() => { setPage(0); }, [colFilters, pageSize]);

  const stats = useMemo(() => {
    const total = rows.length;
    const cidades = new Set<string>();
    const statusCounts = new Map<string, number>();
    rows.forEach((r) => {
      if (r.cidade) cidades.add(r.cidade.trim().toLowerCase());
      const s = r.status || "SEM STATUS";
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    });
    const statusSorted = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
    return { total, cidades: cidades.size, statusSorted };
  }, [rows]);

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
            case "cidade": return `${r.cidade ?? ""}`;
            case "empresa": return `${r.empresa ?? ""}`;
            case "produto": return `${r.produto ?? ""}`;
            case "segmento": return `${r.segmento ?? ""}`;
            case "campanha": return `${r.campanha ?? ""}`;
            case "status": return `${r.status ?? ""}`;
            case "origem": return `${r.origem ?? ""}`;
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

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden p-5 border-border/60 min-h-[110px]">
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Total de leads · Arraiá
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
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Cidades alcançadas
              </p>
              <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 ring-1 ring-border/40">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {stats.cidades.toLocaleString("pt-BR")}
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
                  <Badge key={s} variant="secondary" className="text-[11px] font-medium tabular-nums">
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
        <Button variant="outline" onClick={fetchLeads} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-4 h-4 text-primary" />
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Produto / Interesse</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="whitespace-nowrap">Criado em</TableHead>
                </TableRow>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  {[
                    { k: "nome", ph: "nome", cls: "min-w-[160px]" },
                    { k: "telefone", ph: "telefone", cls: "min-w-[140px]" },
                    { k: "email", ph: "e-mail", cls: "min-w-[160px]" },
                    { k: "cidade", ph: "cidade", cls: "min-w-[120px]" },
                    { k: "empresa", ph: "empresa", cls: "min-w-[140px]" },
                    { k: "produto", ph: "produto", cls: "min-w-[160px]" },
                    { k: "segmento", ph: "segmento", cls: "min-w-[120px]" },
                    { k: "campanha", ph: "campanha", cls: "min-w-[140px]" },
                    { k: "origem", ph: "origem", cls: "min-w-[100px]" },
                    { k: "status", ph: "status", cls: "min-w-[110px]" },
                    { k: "_", ph: "", cls: "w-[120px]" },
                  ].map(({ k, ph, cls }) => (
                    <TableHead key={k} className={`py-2 ${cls}`}>
                      {k === "_" ? null : (
                        <Input
                          value={colFilters[k] ?? ""}
                          onChange={(e) => setColFilter(k, e.target.value)}
                          placeholder={ph}
                          className="h-7 text-xs px-2"
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="py-3"><div className="font-medium">{r.nome || "-"}</div></TableCell>
                      <TableCell className="py-3 whitespace-nowrap">{formatPhone(r.telefone)}</TableCell>
                      <TableCell className="py-3 text-xs">{r.email || "-"}</TableCell>
                      <TableCell className="py-3">{r.cidade || "-"}</TableCell>
                      <TableCell className="py-3">{r.empresa || "-"}</TableCell>
                      <TableCell className="py-3">{r.produto || "-"}</TableCell>
                      <TableCell className="py-3">{r.segmento || "-"}</TableCell>
                      <TableCell className="py-3">{r.campanha || "-"}</TableCell>
                      <TableCell className="py-3 text-xs">{r.origem || "-"}</TableCell>
                      <TableCell className="py-3"><Badge variant="secondary">{r.status || "-"}</Badge></TableCell>
                      <TableCell className="py-3 text-xs whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
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

export default ArraiaLeadsList;

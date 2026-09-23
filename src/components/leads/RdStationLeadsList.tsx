import { useEffect, useMemo, useRef, useState } from "react";
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
  Upload,
  Users,
  DollarSign,
  Activity,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RdLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string;
  email: string | null;
  segment: string | null;
  estimated_value: number | null;
  state: string | null;
  city: string | null;
  funnel_stage: string | null;
  interaction_status: "novo" | "sim" | "pendente" | "nao";
  created_at: string;
  source: string;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

const formatMoney = (n: number | null | undefined) =>
  n == null || isNaN(n as number)
    ? "-"
    : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatMoneyCompact = (n: number) =>
  n.toLocaleString("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 2,
    style: "currency",
    currency: "BRL",
  });

const formatPhone = (p: string | null) => {
  if (!p) return "-";
  const d = String(p).replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return p;
};

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  sim: "Interagiu",
  pendente: "Pendente",
  nao: "Sem retorno",
};

const RdStationLeadsList = () => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<RdLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
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
      let all: RdLead[] = [];
      for (let from = 0; from < 20000; from += CHUNK) {
        const { data, error } = await supabase
          .from("prospect_leads" as any)
          .select(
            "id,company_name,contact_name,phone,email,segment,estimated_value,state,city,funnel_stage,interaction_status,created_at,source"
          )
          .eq("source", "csv")
          .order("created_at", { ascending: false })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        const list = (data as any[]) || [];
        if (list.length === 0) break;
        all = all.concat(list as RdLead[]);
        if (list.length < CHUNK) break;
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

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const valorTotal = rows.reduce((a, r) => a + (Number(r.estimated_value) || 0), 0);
    const statusCounts = new Map<string, number>();
    rows.forEach((r) => {
      const s = STATUS_LABEL[r.interaction_status] || "—";
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    });
    const statusSorted = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
    return { total, valorTotal, statusSorted };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, v]) => v && v.trim());
    if (active.length === 0) return rows;
    return rows.filter((r) =>
      active.every(([k, raw]) => {
        const q = raw.trim().toLowerCase();
        const text = (() => {
          switch (k) {
            case "empresa": return `${r.company_name ?? ""}`;
            case "contato": return `${r.contact_name ?? ""}`;
            case "telefone": return `${r.phone ?? ""}`;
            case "email": return `${r.email ?? ""}`;
            case "segmento": return `${r.segment ?? ""}`;
            case "cidade": return `${r.city ?? ""} ${r.state ?? ""}`;
            case "etapa": return `${r.funnel_stage ?? ""}`;
            case "valor": return r.estimated_value != null ? String(r.estimated_value) : "";
            case "status": return STATUS_LABEL[r.interaction_status] || "";
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

  // ── Import RD Station CSV (mesma lógica da aba Prospecção) ──
  const onCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const raw = (await file.text()).replace(/^\uFEFF/, "");
      const firstLine = raw.split(/\r?\n/)[0] || "";
      const delim =
        (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";

      const csvRows: string[][] = [];
      let cur: string[] = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (inQuotes) {
          if (c === '"') {
            if (raw[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else field += c;
        } else {
          if (c === '"') inQuotes = true;
          else if (c === delim) { cur.push(field); field = ""; }
          else if (c === "\n") { cur.push(field); csvRows.push(cur); cur = []; field = ""; }
          else if (c === "\r") { /* skip */ }
          else field += c;
        }
      }
      if (field.length || cur.length) { cur.push(field); csvRows.push(cur); }
      const dataRows = csvRows.filter((r) => r.some((c) => c.trim()));
      if (dataRows.length < 2) { toast.error("CSV vazio ou inválido"); return; }

      const header = dataRows[0].map((h) => h.toLowerCase().trim());
      const findIdx = (...keys: string[]) =>
        header.findIndex((h) => keys.some((k) => h === k || h.includes(k)));

      const iEmpresa = findIdx("empresa");
      const iNome = findIdx("nome");
      const iContato = findIdx("contatos", "contato");
      const iTelefone = findIdx("telefone", "phone", "celular");
      const iEmail = findIdx("email", "e-mail");
      const iSeg = findIdx("segmento");
      const iValor = findIdx("valor único", "valor unico", "valor");
      const iEstado = findIdx("estado");
      const iCidade = findIdx("cidade");
      const iMotivo = findIdx("motivo de perda", "motivo perda", "motivo");
      const iEtapa = findIdx("etapa");
      const iResp = findIdx("responsável", "responsavel");
      const iEquip = findIdx("tipo de equipamento", "equipamento");
      const iCargo = findIdx("cargo");
      const iFonte = findIdx("fonte do lead", "fonte");

      if (iTelefone === -1 || (iEmpresa === -1 && iNome === -1)) {
        toast.error("CSV precisa ter colunas 'empresa' (ou 'nome') e 'telefone'");
        return;
      }

      const parseValor = (v: string): number | null => {
        if (!v) return null;
        const cleaned = v.replace(/[^\d,.-]/g, "");
        if (!cleaned) return null;
        let normalized = cleaned;
        if (normalized.includes(",") && normalized.includes(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else if (normalized.includes(",")) {
          normalized = normalized.replace(",", ".");
        }
        const n = parseFloat(normalized);
        return isFinite(n) ? n : null;
      };

      const get = (cols: string[], i: number) => (i >= 0 ? (cols[i] || "").trim() : "");

      const parsed = dataRows.slice(1).map((cols) => {
        const empresa = get(cols, iEmpresa) || get(cols, iNome) || "Sem nome";
        const contato = get(cols, iContato) || get(cols, iNome) || null;
        return {
          company_name: empresa,
          contact_name: contato,
          phone: onlyDigits(get(cols, iTelefone)),
          email: get(cols, iEmail) || null,
          segment: get(cols, iSeg) || null,
          estimated_value: parseValor(get(cols, iValor)),
          state: get(cols, iEstado) || null,
          city: get(cols, iCidade) || null,
          loss_reason: get(cols, iMotivo) || null,
          funnel_stage: get(cols, iEtapa) || null,
          responsible: get(cols, iResp) || null,
          equipment_type: get(cols, iEquip) || null,
          role: get(cols, iCargo) || null,
          source_origin: get(cols, iFonte) || null,
          assigned_agent_id: user.id,
          created_by: user.id,
          source: "csv",
        };
      }).filter((r) => r.phone);

      if (parsed.length === 0) { toast.error("Nenhuma linha válida no CSV"); return; }

      // Dedupe arquivo
      const seenInFile = new Set<string>();
      let dupInFile = 0;
      const uniqueInFile: typeof parsed = [];
      for (const r of parsed) {
        const k = (r.phone || "").replace(/\D/g, "");
        if (!k) continue;
        if (seenInFile.has(k)) { dupInFile++; continue; }
        seenInFile.add(k);
        uniqueInFile.push(r);
      }

      // Dedupe banco
      const phones = Array.from(seenInFile);
      const existing = new Set<string>();
      const lookupSize = 500;
      for (let i = 0; i < phones.length; i += lookupSize) {
        const slice = phones.slice(i, i + lookupSize);
        const { data, error } = await supabase
          .from("prospect_leads" as any)
          .select("phone")
          .in("phone", slice);
        if (error) {
          toast.error(`Erro ao verificar duplicados: ${error.message}`);
          return;
        }
        ((data as any[]) || []).forEach((row) => existing.add((row.phone || "").replace(/\D/g, "")));
      }

      const toInsert = uniqueInFile.filter((r) => !existing.has((r.phone || "").replace(/\D/g, "")));
      const dupInDb = uniqueInFile.length - toInsert.length;
      const totalDup = dupInFile + dupInDb;

      if (toInsert.length === 0) {
        toast.info(`Nenhum lead novo. ${totalDup} duplicado(s) ignorado(s).`);
        return;
      }

      let inserted = 0;
      const chunkSize = 200;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from("prospect_leads" as any).insert(chunk);
        if (error) {
          toast.error(`Erro no chunk ${i / chunkSize + 1}: ${error.message}`);
          break;
        }
        inserted += chunk.length;
      }
      toast.success(`${inserted} importado(s) · ${totalDup} duplicado(s) ignorado(s)`);
      await fetchLeads();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar planilha");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats cards (mesmo padrão das outras abas) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden p-5 border-border/60 min-h-[110px]">
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary opacity-50 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Total de leads · RD Station
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
                Valor estimado total
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
        <Button variant="outline" onClick={fetchLeads} disabled={loading || importing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-1.5" />
          )}
          Subir planilha RD
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          hidden
          onChange={onCSVUpload}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
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
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Cidade / UF</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  {[
                    { k: "empresa", ph: "empresa", cls: "min-w-[160px]" },
                    { k: "contato", ph: "contato", cls: "min-w-[140px]" },
                    { k: "telefone", ph: "telefone", cls: "min-w-[140px]" },
                    { k: "email", ph: "e-mail", cls: "min-w-[160px]" },
                    { k: "segmento", ph: "segmento", cls: "min-w-[140px]" },
                    { k: "cidade", ph: "cidade / uf", cls: "min-w-[140px]" },
                    { k: "etapa", ph: "etapa", cls: "min-w-[140px]" },
                    { k: "valor", ph: "valor", cls: "text-right w-[140px]" },
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
                      Nenhum lead encontrado. Importe uma planilha do RD Station para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="py-3"><div className="font-medium">{r.company_name || "-"}</div></TableCell>
                      <TableCell className="py-3">{r.contact_name || "-"}</TableCell>
                      <TableCell className="py-3 whitespace-nowrap">{formatPhone(r.phone)}</TableCell>
                      <TableCell className="py-3 text-xs">{r.email || "-"}</TableCell>
                      <TableCell className="py-3">{r.segment || "-"}</TableCell>
                      <TableCell className="py-3">{r.city || "-"}{r.state ? `/${r.state}` : ""}</TableCell>
                      <TableCell className="py-3">{r.funnel_stage || "-"}</TableCell>
                      <TableCell className="py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(r.estimated_value)}
                      </TableCell>
                      <TableCell className="py-3"><Badge variant="secondary">{STATUS_LABEL[r.interaction_status] || "-"}</Badge></TableCell>
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

export default RdStationLeadsList;

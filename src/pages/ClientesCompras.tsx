import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  clientesComprasSupabase,
  type LeadOrigem,
  type LeadUnificado,
} from "@/integrations/clientes-compras/client";
import { CbmaqSiteLeadsInner } from "./CbmaqSiteLeads";
import InboxLeadsList from "@/components/leads/InboxLeadsList";
import PopAgroLeadsList from "@/components/leads/PopAgroLeadsList";
import RdStationLeadsList from "@/components/leads/RdStationLeadsList";
import ArraiaLeadsList from "@/components/leads/ArraiaLeadsList";
import AiSearchBar from "@/components/leads/AiSearchBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  RefreshCw,
  ShoppingBag,
  Search,
  Users,
  Truck,
  Package,
  Globe,
  Inbox as InboxIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarRange,
  Download,
  PartyPopper,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cbmaqSiteSupabase } from "@/integrations/cbmaq-site/client";
import * as XLSX from "xlsx";

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

type Filter = "ALL" | LeadOrigem | "SITE_CBMAQ" | "INBOX" | "POPAGRO" | "RDSTATION" | "ARRAIA";

const parseMoney = (v: string | null) => {
  if (!v) return 0;
  const n = parseFloat(
    String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  );
  return isNaN(n) ? 0 : n;
};

const formatMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LeadsDealerNet = () => {
  // rows/total agora derivados de aggRows (paginação client-side)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);

  // Filtros por coluna (Dealer.net tabs)
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = (k: string, v: string) =>
    setColFilters((s) => ({ ...s, [k]: v }));

  // IA search (apenas para abas Dealer.net)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilterCodes, setAiFilterCodes] = useState<number[] | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Dataset completo para stats e tabela (paginação client-side por linhas agrupadas)
  const [aggRows, setAggRows] = useState<Array<{ origem: LeadOrigem; codigo_cliente: number | null; valor: string | null; quantidade: number | null; nome: string | null; empresa: string | null; interesse: string | null; email: string | null; telefone: string | null; data_registro: string | null; atualizado_em: string | null }>>([]);

  // Linhas filtradas em tela das abas embutidas
  const [siteFiltered, setSiteFiltered] = useState<any[]>([]);
  const [inboxFiltered, setInboxFiltered] = useState<any[]>([]);

  const fetchTotals = async () => {
    setLoading(true);
    setError(null);
    const CHUNK = 1000;
    const MAX = 20000;
    let all: any[] = [];
    try {
      for (let from = 0; from < MAX; from += CHUNK) {
        const { data, error } = await clientesComprasSupabase
          .from("leads_unificados")
          .select("origem,valor,codigo_cliente,quantidade,nome,empresa,interesse,email,telefone,data_registro,atualizado_em")
          .order("atualizado_em", { ascending: false })
          .range(from, from + CHUNK - 1);
        if (error) { setError(error.message); break; }
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < CHUNK) break;
      }
      setAggRows(all as any);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchTotals();
  }, []);

  // Reset paginação quando filtro/busca/IA/tamanho mudam
  useEffect(() => {
    setPage(0);
  }, [filter, aiFilterCodes, search, pageSize, colFilters]);

  // Grupos derivados de TODO o dataset filtrado (não da página crua) — paginação por linhas agrupadas
  const allGrouped = useMemo(() => {
    let scope = aggRows as Array<any>;
    if (filter === "COMPRA_PECA" || filter === "VENDA_VEICULO") {
      scope = scope.filter((r) => r.origem === filter);
    }
    if (aiFilterCodes) {
      const set = new Set(aiFilterCodes);
      scope = scope.filter((r) => r.codigo_cliente != null && set.has(Number(r.codigo_cliente)));
    } else if (search.trim()) {
      const s = search.trim().toLowerCase();
      scope = scope.filter((r) => {
        const hay = `${r.nome ?? ""} ${r.empresa ?? ""} ${r.interesse ?? ""} ${r.email ?? ""} ${r.telefone ?? ""}`.toLowerCase();
        return hay.includes(s);
      });
    }
    const norm = (s: string | null) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const groups = new Map<string, { rows: any[]; qtd: number; total: number }>();
    scope.forEach((r) => {
      const key = `${r.origem}|${r.codigo_cliente ?? "_"}|${norm(r.interesse)}`;
      const g = groups.get(key) ?? { rows: [], qtd: 0, total: 0 };
      g.rows.push(r);
      g.qtd += Number(r.quantidade ?? 0) || 1;
      g.total += parseMoney(r.valor);
      groups.set(key, g);
    });
    const arr = Array.from(groups.entries()).map(([key, g]) => {
      const maxAt = g.rows.reduce((acc, r) => {
        const t = r.atualizado_em ? Date.parse(r.atualizado_em) : 0;
        return t > acc ? t : acc;
      }, 0);
      return { key, g, sortKey: maxAt };
    });

    // Aplica filtros por coluna (sobre as linhas agrupadas)
    const activeCols = Object.entries(colFilters).filter(([, v]) => v && v.trim());
    const filteredArr = activeCols.length === 0
      ? arr
      : arr.filter(({ g }) => {
          const r = g.rows[0];
          const latest = g.rows.reduce((acc: any, x: any) => {
            const t = x.atualizado_em ? Date.parse(x.atualizado_em) : 0;
            const ta = acc?.atualizado_em ? Date.parse(acc.atualizado_em) : 0;
            return t > ta ? x : acc;
          }, r);
          return activeCols.every(([col, raw]) => {
            const q = raw.trim().toLowerCase();
            const text = (() => {
              switch (col) {
                case "origem": return r.origem === "COMPRA_PECA" ? "peça peca" : "veículo veiculo";
                case "cliente": return `${r.nome ?? ""} ${r.codigo_cliente ?? ""}`;
                case "contato": return `${r.telefone ?? ""} ${r.email ?? ""}`;
                case "interesse": return `${r.interesse ?? ""}`;
                case "qtd": return String(g.qtd);
                case "unit": return String(g.qtd > 0 ? (g.total / g.qtd).toFixed(2) : "");
                case "total": return g.total.toFixed(2);
                case "empresa": return `${r.empresa ?? ""}`;
                case "data": return `${latest.data_registro ?? r.data_registro ?? ""}`;
                default: return "";
              }
            })();
            return text.toLowerCase().includes(q);
          });
        });

    filteredArr.sort((a, b) => b.sortKey - a.sortKey);
    return filteredArr;
  }, [aggRows, filter, aiFilterCodes, search, colFilters]);

  const totalGroups = allGrouped.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const groupedRows = useMemo(
    () => allGrouped.slice(page * pageSize, page * pageSize + pageSize),
    [allGrouped, page, pageSize]
  );

  // Stats seguem os filtros ativos (aba + IA + busca + colunas)
  const stats = useMemo(() => {
    const scope: any[] = (allGrouped as any[]).flatMap(({ g }) => g.rows);
    const clientes = new Set<number>();
    const comprasPorCliente = new Map<number, number>();
    let valorTotal = 0;
    let itensVendidos = 0;
    scope.forEach((r) => {
      valorTotal += parseMoney(r.valor);
      itensVendidos += Number(r.quantidade ?? 0) || (r.origem === "VENDA_VEICULO" ? 1 : 0);
      if (r.codigo_cliente != null) {
        clientes.add(r.codigo_cliente);
        comprasPorCliente.set(r.codigo_cliente, (comprasPorCliente.get(r.codigo_cliente) ?? 0) + 1);
      }
    });
    let umaVez = 0;
    comprasPorCliente.forEach((v) => { if (v === 1) umaVez++; });

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    const prevDate = new Date(curY, curM - 1, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth();
    let novosEsseMes = 0;
    let novosMesAnterior = 0;
    scope.forEach((r) => {
      const d = r.data_registro;
      if (!d) return;
      let y: number, m: number;
      const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      if (br) { y = Number(br[3]); m = Number(br[2]) - 1; }
      else if (iso) { y = Number(iso[1]); m = Number(iso[2]) - 1; }
      else return;
      if (y === curY && m === curM) novosEsseMes++;
      else if (y === prevY && m === prevM) novosMesAnterior++;
    });
    const deltaPct = novosMesAnterior === 0
      ? (novosEsseMes > 0 ? 100 : 0)
      : ((novosEsseMes - novosMesAnterior) / novosMesAnterior) * 100;

    return {
      totalClientes: clientes.size,
      itensVendidos,
      valorTotal,
      clientesUmaVez: umaVez,
      novosEsseMes,
      novosMesAnterior,
      deltaPct,
    };
  }, [allGrouped]);


  const refresh = () => {
    fetchTotals();
  };

  const runAi = async (query: string) => {
    setAiLoading(true);
    setAiReasoning(null);
    try {
      // Busca um lote amplo respeitando o filtro de origem atual
      let q = clientesComprasSupabase
        .from("leads_unificados")
        .select("codigo_cliente,nome,empresa,interesse,origem")
        .order("atualizado_em", { ascending: false })
        .limit(800);
      if (filter === "COMPRA_PECA" || filter === "VENDA_VEICULO") {
        q = q.eq("origem", filter);
      }
      const { data: pool, error: poolErr } = await q;
      if (poolErr) throw poolErr;

      // Compacta por codigo_cliente (concatena interesses)
      const map = new Map<number, { nome: string; empresa: string; interesses: string[] }>();
      (pool || []).forEach((r: any) => {
        if (r.codigo_cliente == null) return;
        const k = Number(r.codigo_cliente);
        const cur = map.get(k) ?? { nome: r.nome || "", empresa: r.empresa || "", interesses: [] };
        if (r.interesse) cur.interesses.push(String(r.interesse));
        if (!cur.nome && r.nome) cur.nome = r.nome;
        if (!cur.empresa && r.empresa) cur.empresa = r.empresa;
        map.set(k, cur);
      });
      const leadsPayload = Array.from(map.entries()).map(([code, v]) => ({
        id: String(code),
        text: `${v.nome} | ${v.empresa} | ${v.interesses.slice(0, 5).join(" / ")}`,
      }));

      const { data, error } = await supabase.functions.invoke("ai-search-leads", {
        body: { query, source: "client_data", leads: leadsPayload, context_hint: "Dealer.net — compras de peças e vendas de veículos CBMaq" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const codes: number[] = ((data as any)?.ids ?? []).map((s: string) => Number(s)).filter((n: number) => Number.isFinite(n));
      setAiFilterCodes(codes);
      setAiReasoning((data as any)?.reasoning ?? null);
      setPage(0);
      toast({ title: `IA encontrou ${codes.length} cliente(s)` });
    } catch (e: any) {
      toast({ title: "Erro na busca por IA", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const clearAi = () => { setAiFilterCodes(null); setAiReasoning(null); setPage(0); };

  const originBadge = (o: LeadOrigem) =>
    o === "COMPRA_PECA" ? (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
        <Package className="w-3 h-3 mr-1" /> Peça
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
        <Truck className="w-3 h-3 mr-1" /> Veículo
      </Badge>
    );

  const [exporting, setExporting] = useState(false);

  const downloadSheet = (rows: any[], baseName: string, format: "xlsx" | "csv") => {
    if (!rows.length) {
      toast({ title: "Nenhum registro para exportar", variant: "destructive" });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const fname = `${baseName}-${stamp}`;
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fname}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `${fname}.xlsx`);
    }
    toast({ title: `Exportado ${rows.length} registro(s)` });
  };

  const exportCurrentTab = async (scope: "filtered" | "all", format: "xlsx" | "csv") => {
    setExporting(true);
    try {
      // Dealer.net tabs (ALL / COMPRA_PECA / VENDA_VEICULO)
      if (filter === "ALL" || filter === "COMPRA_PECA" || filter === "VENDA_VEICULO") {
        let source: any[];
        if (scope === "filtered") {
          source = allGrouped.flatMap(({ g }) => g.rows);
        } else {
          source = filter === "ALL" ? aggRows : aggRows.filter((r) => r.origem === filter);
        }
        const rows = source.map((r) => ({
          Origem: r.origem === "COMPRA_PECA" ? "Peça" : "Veículo",
          "Código cliente": r.codigo_cliente ?? "",
          Nome: r.nome ?? "",
          Empresa: r.empresa ?? "",
          Telefone: r.telefone ?? "",
          Email: r.email ?? "",
          "Interesse / Produto": r.interesse ?? "",
          Quantidade: r.quantidade ?? "",
          Valor: r.valor ?? "",
          "Data registro": r.data_registro ?? "",
          "Atualizado em": r.atualizado_em ?? "",
        }));
        const base = `leads-${filter.toLowerCase()}-${scope}`;
        downloadSheet(rows, base, format);
        return;
      }

      // Site CBMaq
      if (filter === "SITE_CBMAQ") {
        let source: any[];
        if (scope === "filtered") {
          source = siteFiltered;
        } else {
          const { data, error } = await cbmaqSiteSupabase
            .from("Lead").select("*").order("createdAt", { ascending: false });
          if (error) throw error;
          source = (data as any[]) || [];
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
          "Criado em": l.createdAt || "",
          "Dados extras": l.data ? JSON.stringify(l.data) : "",
        }));
        downloadSheet(rows, `leads-site-cbmaq-${scope}`, format);
        return;
      }

      // Inbox (Whatsapp)
      if (filter === "INBOX") {
        let mapped: any[];
        if (scope === "filtered") {
          mapped = inboxFiltered.map((r: any) => ({
            Nome: r.name || "",
            Telefone: r.phone || "",
            Email: r.email || "",
            Empresa: r.company_name || "",
            Setor: r.department_name || "",
            Interesse: r.ai_summary || r.subject || "",
            Canal: r.channel || "",
            "Última mensagem": r.last_message_at || "",
          }));
        } else {
          const CHUNK = 1000;
          let all: any[] = [];
          for (let from = 0; from < 20000; from += CHUNK) {
            const { data, error } = await supabase
              .from("conversations")
              .select("contact_id, last_message_at, ai_summary, subject, channel, contacts!inner(id,name,phone,email,company_name), departments(name)")
              .not("last_message_at", "is", null)
              .order("last_message_at", { ascending: false })
              .range(from, from + CHUNK - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < CHUNK) break;
          }
          const seen = new Set<string>();
          mapped = (all as any[])
            .filter((c) => c.contact_id && !seen.has(c.contact_id) && (seen.add(c.contact_id), true))
            .map((c) => ({
              Nome: c.contacts?.name || "",
              Telefone: c.contacts?.phone || "",
              Email: c.contacts?.email || "",
              Empresa: c.contacts?.company_name || "",
              Setor: c.departments?.name || "",
              Interesse: c.ai_summary || c.subject || "",
              Canal: c.channel || "",
              "Última mensagem": c.last_message_at || "",
            }));
        }
        downloadSheet(mapped, `leads-whatsapp-${scope}`, format);
        return;
      }

      // PopAgro
      if (filter === "POPAGRO") {
        const CHUNK = 1000;
        let all: any[] = [];
        for (let from = 0; from < 20000; from += CHUNK) {
          const { data, error } = await clientesComprasSupabase
            .from("leads_popagro")
            .select("popagro_id,nome,email,telefone,cidade,uf,produto_nome,produto_modelo,produto_valor,produto_foto,status,data_lead")
            .order("data_lead", { ascending: false, nullsFirst: false })
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < CHUNK) break;
        }
        const rows = all.map((r: any) => ({
          "ID PopAgro": r.popagro_id ?? "",
          Nome: r.nome ?? "",
          Telefone: r.telefone ?? "",
          Email: r.email ?? "",
          Cidade: r.cidade ?? "",
          UF: r.uf ?? "",
          Produto: r.produto_nome ?? "",
          Modelo: r.produto_modelo ?? "",
          "Valor (R$)": r.produto_valor ?? "",
          Foto: r.produto_foto ?? "",
          Status: r.status ?? "",
          "Data lead": r.data_lead ?? "",
        }));
        downloadSheet(rows, `leads-popagro-${scope}`, format);
        return;
      }

      // RDstation (prospect_leads importados via CSV)
      if (filter === "RDSTATION") {
        const { data, error } = await supabase
          .from("prospect_leads" as any)
          .select("*")
          .eq("source", "csv")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = ((data as any[]) || []).map((r: any) => ({
          Empresa: r.company_name ?? "",
          Contato: r.contact_name ?? "",
          Telefone: r.phone ?? "",
          Email: r.email ?? "",
          Segmento: r.segment ?? "",
          "Valor estimado": r.estimated_value ?? "",
          Cidade: r.city ?? "",
          UF: r.state ?? "",
          Status: r.interaction_status ?? "",
          "Próximo passo": r.next_step ?? "",
          Observações: r.observations ?? "",
          "Criado em": r.created_at ?? "",
        }));
        downloadSheet(rows, `leads-rdstation-${scope}`, format);
        return;
      }

      // Arraiá CBmaq 2026 (campaign_leads na base DealerNet)
      if (filter === "ARRAIA") {
        const CHUNK = 1000;
        let all: any[] = [];
        for (let from = 0; from < 20000; from += CHUNK) {
          const { data, error } = await clientesComprasSupabase
            .from("campaign_leads" as any)
            .select("id,nome,email,telefone,cidade,produto,empresa,segmento,campanha,observacoes,status,origem,created_at")
            .order("created_at", { ascending: false, nullsFirst: false })
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < CHUNK) break;
        }
        const rows = all.map((r: any) => ({
          Nome: r.nome ?? "",
          Telefone: r.telefone ?? "",
          Email: r.email ?? "",
          Cidade: r.cidade ?? "",
          Empresa: r.empresa ?? "",
          Produto: r.produto ?? "",
          Segmento: r.segmento ?? "",
          Campanha: r.campanha ?? "",
          Origem: r.origem ?? "",
          Status: r.status ?? "",
          Observações: r.observacoes ?? "",
          "Criado em": r.created_at ?? "",
        }));
        downloadSheet(rows, `leads-arraia-cbmaq-2026-${scope}`, format);
        return;
      }
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const ExportButton = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className={`w-4 h-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Com filtros aplicados</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportCurrentTab("filtered", "xlsx")}>
          <Download className="w-4 h-4 mr-2" /> Exportar filtrados (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportCurrentTab("filtered", "csv")}>
          <Download className="w-4 h-4 mr-2" /> Exportar filtrados (CSV)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sem filtros (tudo)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportCurrentTab("all", "xlsx")}>
          <Download className="w-4 h-4 mr-2" /> Exportar tudo (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportCurrentTab("all", "csv")}>
          <Download className="w-4 h-4 mr-2" /> Exportar tudo (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                LEAD
              </h1>
              <p className="text-sm text-muted-foreground">
                Centro unificado de leads · Dealer.net (Peças/Veículos) + Site CBMaq
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {filter !== "SITE_CBMAQ" && filter !== "INBOX" && filter !== "POPAGRO" && filter !== "RDSTATION" && filter !== "ARRAIA" && (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome, email, telefone, produto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-80"
                  />
                </div>
                <Button variant="outline" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </>
            )}
            <ExportButton />
          </div>
        </div>

        {/* Stats — apenas para abas Dealer.net */}
        {filter !== "SITE_CBMAQ" && filter !== "INBOX" && filter !== "POPAGRO" && filter !== "RDSTATION" && filter !== "ARRAIA" && (() => {
          const valorCompact = stats.valorTotal.toLocaleString("pt-BR", {
            notation: "compact",
            maximumFractionDigits: 2,
            style: "currency",
            currency: "BRL",
          });
          const valorFull = formatMoney(stats.valorTotal);
          const cards = [
            {
              label: `Total de clientes${filter === "COMPRA_PECA" ? " · Peças" : filter === "VENDA_VEICULO" ? " · Veículos" : ""}`,
              value: stats.totalClientes.toLocaleString("pt-BR"),
              icon: Users,
              tone: "from-primary/15 to-primary/5 text-primary",
            },
            {
              label: filter === "VENDA_VEICULO" ? "Veículos vendidos" : "Itens vendidos",
              value: stats.itensVendidos.toLocaleString("pt-BR"),
              icon: Package,
              tone: "from-amber-500/15 to-amber-500/5 text-amber-600",
            },
            {
              label: "Valor total de venda",
              value: valorCompact,
              title: valorFull,
              icon: Truck,
              tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
            },
            {
              label: "Compraram só uma vez",
              value: stats.clientesUmaVez.toLocaleString("pt-BR"),
              icon: ShoppingBag,
              tone: "from-blue-500/15 to-blue-500/5 text-blue-600",
            },
          ];
          const deltaPct = stats.deltaPct;
          const deltaPositive = deltaPct > 0;
          const deltaNeutral = deltaPct === 0;
          const DeltaIcon = deltaNeutral ? Minus : deltaPositive ? TrendingUp : TrendingDown;
          const deltaColor = deltaNeutral
            ? "text-muted-foreground bg-muted"
            : deltaPositive
            ? "text-emerald-600 bg-emerald-500/10"
            : "text-rose-600 bg-rose-500/10";
          const deltaLabel = `${deltaPositive ? "+" : ""}${deltaPct.toFixed(1).replace(".", ",")}%`;

          return (
            <div className={`grid grid-cols-2 gap-4 ${filter === "COMPRA_PECA" || filter === "VENDA_VEICULO" ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"}`}>
              {cards.map((c, i) => {
                const Icon = c.icon;
                return (
                  <Card
                    key={i}
                    className="relative overflow-hidden p-5 border-border/60 hover:shadow-md transition-shadow min-h-[110px]"
                  >
                    <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${c.tone} opacity-50 blur-2xl pointer-events-none`} />
                    <div className="relative flex flex-col h-full gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground line-clamp-2 leading-tight">
                          {c.label}
                        </p>
                        <div className={`shrink-0 p-2 rounded-lg bg-gradient-to-br ${c.tone} ring-1 ring-border/40`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <p
                        className="text-2xl font-bold tabular-nums leading-none text-foreground break-words"
                        title={c.title ?? c.value}
                      >
                        {c.value}
                      </p>
                    </div>
                  </Card>
                );
              })}

              {/* Novas vendas — esse mês vs mês anterior (somente Peças/Veículos) */}
              {(filter === "COMPRA_PECA" || filter === "VENDA_VEICULO") && (
              <Card className="relative overflow-hidden p-5 border-border/60 hover:shadow-md transition-shadow min-h-[110px] col-span-2 lg:col-span-1">
                <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 opacity-50 blur-2xl pointer-events-none" />
                <div className="relative flex flex-col h-full gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground line-clamp-2 leading-tight">
                      Novas vendas esse mês
                    </p>
                    <div className="shrink-0 p-2 rounded-lg bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 ring-1 ring-border/40">
                      <CalendarRange className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2 flex-wrap">
                    <p className="text-2xl font-bold tabular-nums leading-none text-foreground">
                      {stats.novosEsseMes.toLocaleString("pt-BR")}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded ${deltaColor}`}>
                      <DeltaIcon className="w-3 h-3" />
                      {deltaLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Mês anterior: <span className="font-medium text-foreground tabular-nums">{stats.novosMesAnterior.toLocaleString("pt-BR")}</span>
                  </p>
                </div>
              </Card>
              )}
            </div>
          );
        })()}

        {(() => {
          const tabsBar = (
            <Tabs
              value={filter}
              onValueChange={(v) => {
                setPage(0);
                setColFilters({});
                setFilter(v as Filter);
              }}
            >
              <TabsList>
                <TabsTrigger value="ALL">
                  <Users className="w-4 h-4 mr-1.5" /> Todos
                </TabsTrigger>
                <TabsTrigger value="COMPRA_PECA">
                  <Package className="w-4 h-4 mr-1.5" /> Peças
                </TabsTrigger>
                <TabsTrigger value="VENDA_VEICULO">
                  <Truck className="w-4 h-4 mr-1.5" /> Veículos
                </TabsTrigger>
                <TabsTrigger value="SITE_CBMAQ">
                  <Globe className="w-4 h-4 mr-1.5" /> Site CBMaq
                </TabsTrigger>
                <TabsTrigger value="INBOX">
                  <InboxIcon className="w-4 h-4 mr-1.5" /> Whatsapp
                </TabsTrigger>
                <TabsTrigger value="POPAGRO">
                  <Globe className="w-4 h-4 mr-1.5" /> PopAgro
                </TabsTrigger>
                <TabsTrigger value="RDSTATION">
                  <Globe className="w-4 h-4 mr-1.5" /> RDstation
                </TabsTrigger>
                <TabsTrigger value="ARRAIA">
                  <PartyPopper className="w-4 h-4 mr-1.5" /> Arraiá CBmaq 2026
                </TabsTrigger>
              </TabsList>
            </Tabs>
          );

          if (filter === "SITE_CBMAQ") {
            return <CbmaqSiteLeadsInner topSlot={tabsBar} onFilteredChange={setSiteFiltered} />;
          }
          if (filter === "INBOX") {
            return (
              <>
                {tabsBar}
                <InboxLeadsList onFilteredChange={setInboxFiltered} />
              </>
            );
          }
          if (filter === "POPAGRO") {
            return (
              <>
                {tabsBar}
                <PopAgroLeadsList />
              </>
            );
          }
          if (filter === "RDSTATION") {
            return (
              <>
                {tabsBar}
                <RdStationLeadsList />
              </>
            );
          }
          if (filter === "ARRAIA") {
            return (
              <>
                {tabsBar}
                <ArraiaLeadsList />
              </>
            );
          }
          return <>{tabsBar}</>;
        })()}

        {filter !== "SITE_CBMAQ" && filter !== "INBOX" && filter !== "POPAGRO" && filter !== "RDSTATION" && filter !== "ARRAIA" && (
          <>
          <AiSearchBar
            loading={aiLoading}
            reasoning={aiReasoning}
            active={aiFilterCodes !== null}
            resultCount={aiFilterCodes?.length ?? null}
            onSearch={runAi}
            onClear={clearAi}
            placeholder="Pergunte... ex: clientes que compraram filtros, quem comprou pá-carregadeira"
          />
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
                      <TableHead>Origem</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Interesse / Produto</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Qtd compras</TableHead>
                      <TableHead className="text-right">Valor unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      {[
                        { k: "origem", ph: "peça / veículo", cls: "" },
                        { k: "cliente", ph: "nome / cód.", cls: "min-w-[160px]" },
                        { k: "contato", ph: "tel / email", cls: "min-w-[160px]" },
                        { k: "interesse", ph: "produto...", cls: "min-w-[200px]" },
                        { k: "qtd", ph: "qtd", cls: "text-center w-[90px]" },
                        { k: "unit", ph: "valor unit.", cls: "text-right w-[110px]" },
                        { k: "total", ph: "total", cls: "text-right w-[110px]" },
                        { k: "empresa", ph: "empresa", cls: "min-w-[140px]" },
                        { k: "data", ph: "data", cls: "w-[120px]" },
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
                    {groupedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhum resultado encontrado.</p>
                        </TableCell>
                      </TableRow>
                    ) : groupedRows.map(({ key, g }, i) => {
                        const r = g.rows[0];
                        const multi = g.rows.length > 1;
                        const latest = g.rows.reduce((acc: any, x: any) => {
                          const t = x.atualizado_em ? Date.parse(x.atualizado_em) : 0;
                          const ta = acc?.atualizado_em ? Date.parse(acc.atualizado_em) : 0;
                          return t > ta ? x : acc;
                        }, r);
                        return (
                          <TableRow key={`${key}-${i}`} className="hover:bg-muted/30 align-top">
                            <TableCell className="py-3 align-top">{originBadge(r.origem)}</TableCell>
                            <TableCell className="py-3 align-top min-w-[200px]">
                              <div className="font-medium text-sm leading-snug">{r.nome || "—"}</div>
                              {r.codigo_cliente != null && (
                                <div className="text-xs text-muted-foreground mt-0.5">cód {r.codigo_cliente}</div>
                              )}
                            </TableCell>
                            <TableCell className="py-3 align-top text-sm min-w-[180px]">
                              <div className="whitespace-nowrap">{r.telefone || "—"}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={r.email || ""}>
                                {r.email || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 align-top text-sm min-w-[240px]">
                              <span className="block leading-snug break-words">{r.interesse || "—"}</span>
                            </TableCell>
                            <TableCell className="py-3 text-center align-top whitespace-nowrap">
                              {multi ? (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                  {g.qtd}x
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground tabular-nums">{g.qtd}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 align-top text-right text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                              {g.qtd > 0 ? formatMoney(g.total / g.qtd) : "—"}
                            </TableCell>
                            <TableCell className="py-3 align-top text-right font-semibold tabular-nums whitespace-nowrap">
                              {formatMoney(g.total)}
                            </TableCell>
                            <TableCell className="py-3 align-top text-sm">
                              {r.empresa ? (
                                <Badge variant="outline" className="whitespace-nowrap">{r.empresa}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="py-3 align-top text-sm text-muted-foreground whitespace-nowrap">
                              {latest.data_registro || r.data_registro || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 gap-4 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-medium">
                    {groupedRows.length === 0 ? 0 : page * pageSize + 1}–
                    {page * pageSize + groupedRows.length}
                  </span>{" "}
                  de <span className="font-medium">{totalGroups.toLocaleString("pt-BR")}</span> clientes (agrupados)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Por página:</span>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={pageSize}
                      onChange={(e) => {
                        setPage(0);
                        setPageSize(Number(e.target.value));
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs">
                      Pág {page + 1} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
        </>
        )}
      </div>
    </AppLayout>
  );
};

export default LeadsDealerNet;

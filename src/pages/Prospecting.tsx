import { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus, Search, Send, MessageCircle, Edit2, Trash2, Download, Upload,
  CheckCircle2, Clock, XCircle, CircleDashed, Loader2, Users, TrendingUp, Settings, Sparkles, Brain, RefreshCw, CalendarDays,
  Phone, Tag, DollarSign, SlidersHorizontal, ChevronDown, X,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useProspectLeads, ProspectLead } from "@/hooks/useProspectLeads";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const DEFAULT_TEMPLATE = "Olá {contato}! Tudo bem? Sou da equipe e gostaria de conversar sobre como podemos ajudar a {empresa}.";
const ACTIVE_TEMPLATE_KEY = "prospecting_active_template_id";

type SavedTemplate = { id: string; name: string; content: string };


type Tab = "historico" | "disparador";
type StatusKey = ProspectLead["interaction_status"];

const STATUS_META: Record<StatusKey, { label: string; icon: any; className: string; dotClass: string }> = {
  novo:      { label: "Novo",         icon: CircleDashed, className: "bg-secondary text-muted-foreground", dotClass: "bg-muted-foreground" },
  sim:       { label: "Interagiu",    icon: CheckCircle2, className: "bg-success/10 text-success",         dotClass: "bg-success" },
  pendente:  { label: "Pendente",     icon: Clock,        className: "bg-warning/10 text-warning",         dotClass: "bg-warning" },
  nao:       { label: "Sem retorno",  icon: XCircle,      className: "bg-destructive/10 text-destructive", dotClass: "bg-destructive" },
};

const SEGMENTS = ["Construção Civil", "Agricultura", "Mineração", "Construção Rodoviário", "Pedreira", "Confinamentos", "Usina"];
const NEXT_STEPS = [
  "Enviar proposta comercial", "Análise de crédito", "Visita ao cliente",
  "Aguardar retorno", "Apresentar estoque", "Negociação de valores",
  "Fechar contrato", "Sem interesse no momento",
];

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const formatPhone = (s: string) => {
  const d = onlyDigits(s);
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};
const formatBRL = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const Prospecting = () => {
  const { user } = useAuth();
  const { leads, loading, refetch } = useProspectLeads();
  const [tab, setTab] = useState<Tab>("disparador");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | StatusKey>("");
  const [filterSeg, setFilterSeg] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterLoss, setFilterLoss] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [editingLead, setEditingLead] = useState<ProspectLead | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmLead, setConfirmLead] = useState<ProspectLead | null>(null);
  const [editableMessage, setEditableMessage] = useState<string>("");
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    () => localStorage.getItem(ACTIVE_TEMPLATE_KEY) || ""
  );
  const messageTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId)?.content || templates[0]?.content || DEFAULT_TEMPLATE,
    [templates, activeTemplateId]
  );
  const setActiveTemplate = (id: string) => {
    setActiveTemplateId(id);
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, id);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("prospecting_templates" as any)
      .select("id, name, content")
      .order("created_at", { ascending: true });
    if (error) { console.error("fetch templates:", error); return; }
    const list = ((data as any) || []) as SavedTemplate[];
    setTemplates(list);
    if (list.length && !list.find((t) => t.id === activeTemplateId)) {
      setActiveTemplate(list[0].id);
    }
  };

  useEffect(() => {
    fetchTemplates();
    const ch = supabase
      .channel("prospecting-templates-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospecting_templates" }, () => fetchTemplates())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTemplates = async (next: SavedTemplate[], newActiveId?: string) => {
    const prevIds = new Set(templates.map((t) => t.id));
    const nextIds = new Set(next.map((t) => t.id));
    const toDelete = templates.filter((t) => !nextIds.has(t.id)).map((t) => t.id);
    const toInsert = next.filter((t) => !prevIds.has(t.id));
    const toUpdate = next.filter((t) => {
      const prev = templates.find((p) => p.id === t.id);
      return prev && (prev.name !== t.name || prev.content !== t.content);
    });
    try {
      if (toDelete.length) {
        const { error } = await supabase.from("prospecting_templates" as any).delete().in("id", toDelete);
        if (error) throw error;
      }
      for (const t of toUpdate) {
        const { error } = await supabase.from("prospecting_templates" as any)
          .update({ name: t.name, content: t.content }).eq("id", t.id);
        if (error) throw error;
      }
      // Inserir novos: deixa o DB gerar id e remapeia o active
      let mappedActive = newActiveId;
      for (const t of toInsert) {
        const { data, error } = await supabase.from("prospecting_templates" as any)
          .insert({ name: t.name, content: t.content, created_by: user?.id })
          .select("id").single();
        if (error) throw error;
        if (mappedActive === t.id) mappedActive = (data as any).id;
      }
      await fetchTemplates();
      if (mappedActive) setActiveTemplate(mappedActive);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar textos padrão");
    }
  };
  // Filtros de data (envio e último retorno) — usados na aba Disparador
  const [dateSentFrom, setDateSentFrom] = useState<string>("");
  const [dateSentTo, setDateSentTo] = useState<string>("");
  const [dateReturnFrom, setDateReturnFrom] = useState<string>("");
  const [dateReturnTo, setDateReturnTo] = useState<string>("");
  // Filtro de envio: "" = todos, "sent" = já enviado, "not_sent" = não enviado
  const [filterSent, setFilterSent] = useState<"" | "sent" | "not_sent">("");
  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [checkingReturns, setCheckingReturns] = useState(false);
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [qualifyingAll, setQualifyingAll] = useState(false);

  const qualifyLead = async (leadId: string) => {
    setQualifyingId(leadId);
    try {
      const { data, error } = await supabase.functions.invoke("qualify-prospect-lead", { body: { leadId } });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.skipped) toast.info(`Sem mensagens do lead para analisar`);
      else if (r?.error) toast.error(`Erro IA: ${r.error}`);
      else { toast.success(`Lead qualificado: ${r?.lead_temperature?.toUpperCase() || ""}`); refetch(); }
    } catch (e: any) { toast.error(e.message || "Erro ao qualificar"); }
    finally { setQualifyingId(null); }
  };

  const qualifyAll = async () => {
    if (!confirm(`Qualificar ${leads.length} leads com IA? Pode levar alguns minutos.`)) return;
    setQualifyingAll(true);
    try {
      const ids = leads.map(l => l.id);
      // Process in chunks of 10 to avoid timeouts
      let okCount = 0, skipCount = 0, errCount = 0;
      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        const { data, error } = await supabase.functions.invoke("qualify-prospect-lead", { body: { leadIds: chunk } });
        if (error) { errCount += chunk.length; continue; }
        for (const r of (data?.results || [])) {
          if (r.ok) okCount++;
          else if (r.skipped) skipCount++;
          else errCount++;
        }
        toast.message(`Progresso: ${i + chunk.length}/${ids.length}`);
      }
      toast.success(`Concluído: ${okCount} qualificados, ${skipCount} sem mensagens, ${errCount} erros`);
      refetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setQualifyingAll(false); }
  };

  // Última interação WA do lead = max(last_interaction_at, message_sent_at)
  const getLastWAInteraction = (l: ProspectLead): Date | null => {
    const a = l.last_interaction_at ? new Date(l.last_interaction_at).getTime() : 0;
    const b = l.message_sent_at ? new Date(l.message_sent_at).getTime() : 0;
    const max = Math.max(a, b);
    return max > 0 ? new Date(max) : null;
  };
  const daysSince = (d: Date | null): number | null => {
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const extractLeadFirstName = (...values: Array<string | null | undefined>): string => {
    for (const value of values) {
      const normalized = (value || "").trim();
      if (!normalized) continue;
      if (/^\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,4})?$/.test(normalized)) continue;
      if (/^[\d\s\/\-.()+]+$/.test(normalized)) continue;

      const first = normalized
        .split(/\s+/)
        .map((part) => part.replace(/[^\p{L}\p{M}'-]/gu, ""))
        .find((part) => part && !/^\d/.test(part));

      if (first) {
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      }
    }

    return "Cliente";
  };

  // Quando abrir o modal de confirmação, pré-preencher mensagem editável com placeholders já substituídos
  useEffect(() => {
    if (confirmLead) {
      const first = extractLeadFirstName(confirmLead.contact_name, confirmLead.company_name);
      const msg = messageTemplate
        .replace(/\{empresa\}/gi, confirmLead.company_name || "")
        .replace(/\{contato\}/gi, first);
      setEditableMessage(msg);
    }
  }, [confirmLead, messageTemplate]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = leads.length;
    const interagiu = leads.filter((l) => l.interaction_status === "sim").length;
    const pendente = leads.filter((l) => l.interaction_status === "pendente").length;
    const semRetorno = leads.filter((l) => l.interaction_status === "nao").length;
    const naoEnviado = leads.filter((l) => !l.message_sent_at).length;
    const valorTotal = leads.reduce((s, l) => s + (l.estimated_value || 0), 0);
    const conversao = total > 0 ? Math.round((interagiu / total) * 100) : 0;
    return { total, interagiu, pendente, semRetorno, naoEnviado, valorTotal, conversao };
  }, [leads]);

  // ── Filtered list ──
  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((l) => {
      if (filterStatus && l.interaction_status !== filterStatus) return false;
      if (filterSeg && l.segment !== filterSeg) return false;
      if (filterState && (l.state || "") !== filterState) return false;
      if (filterLoss && (l.loss_reason || "") !== filterLoss) return false;
      if (filterProduct && (l.equipment_type || "") !== filterProduct) return false;
      if (!q) return true;
      return (
        l.company_name.toLowerCase().includes(q) ||
        (l.contact_name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.segment || "").toLowerCase().includes(q) ||
        (l.state || "").toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q) ||
        (l.equipment_type || "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, filterStatus, filterSeg, filterState, filterLoss, filterProduct]);

  // Opções únicas para filtros dinâmicos (Estado/Motivo de Perda)
  const stateOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => (l.state || "").trim()).filter(Boolean))).sort(),
    [leads]
  );
  const lossOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => (l.loss_reason || "").trim()).filter(Boolean))).sort(),
    [leads]
  );
  const productOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => (l.equipment_type || "").trim()).filter(Boolean))).sort(),
    [leads]
  );

  // Lista para Disparador — filtra por data de envio e data de último retorno
  const dispatchableLeads = useMemo(() => {
    const sf = dateSentFrom ? new Date(dateSentFrom + "T00:00:00").getTime() : null;
    const st = dateSentTo ? new Date(dateSentTo + "T23:59:59").getTime() : null;
    const rf = dateReturnFrom ? new Date(dateReturnFrom + "T00:00:00").getTime() : null;
    const rt = dateReturnTo ? new Date(dateReturnTo + "T23:59:59").getTime() : null;
    return filteredLeads.filter((l) => {
      const sentMs = l.message_sent_at ? new Date(l.message_sent_at).getTime() : null;
      const retMs = l.last_interaction_at ? new Date(l.last_interaction_at).getTime() : null;
      if (filterSent === "sent" && !l.message_sent_at) return false;
      if (filterSent === "not_sent" && l.message_sent_at) return false;
      if (sf != null) { if (sentMs == null || sentMs < sf) return false; }
      if (st != null) { if (sentMs == null || sentMs > st) return false; }
      if (rf != null) { if (retMs == null || retMs < rf) return false; }
      if (rt != null) { if (retMs == null || retMs > rt) return false; }
      return true;
    });
  }, [filteredLeads, dateSentFrom, dateSentTo, dateReturnFrom, dateReturnTo, filterSent]);

  // ── Send WhatsApp (silent, via Evolution API) ──
  const sendWhatsApp = async (lead: ProspectLead, customMessage?: string) => {
    setSendingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-prospect-message", {
        body: { leadId: lead.id, message: customMessage ?? messageTemplate },
      });
      if (error) {
        const errBody = (error as any).context?.body
          ? await (error as any).context.json().catch(() => null)
          : null;
        throw new Error(errBody?.error || error.message || "Erro ao enviar");
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`Mensagem enviada para ${lead.contact_name || lead.company_name}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Falha no envio", { duration: 6000 });
    } finally {
      setSendingId(null);
    }
  };

  // ── Disparo em massa ──
  const sendBulk = async (targetLeads: ProspectLead[]) => {
    if (targetLeads.length === 0) return;
    setBulkSending(true);
    setBulkProgress({ done: 0, total: targetLeads.length, ok: 0, fail: 0 });
    let ok = 0, fail = 0;
    for (let i = 0; i < targetLeads.length; i++) {
      const lead = targetLeads[i];
      const firstName = extractLeadFirstName(lead.contact_name, lead.company_name);
      const msg = messageTemplate
        .replace(/\{empresa\}/gi, lead.company_name || "")
        .replace(/\{contato\}/gi, firstName);
      try {
        const { data, error } = await supabase.functions.invoke("send-prospect-message", {
          body: { leadId: lead.id, message: msg },
        });
        if (error || data?.error) { fail++; }
        else { ok++; }
      } catch { fail++; }
      setBulkProgress({ done: i + 1, total: targetLeads.length, ok, fail });
      // pequeno delay anti-flood
      await new Promise((r) => setTimeout(r, 400));
    }
    setBulkSending(false);
    setBulkConfirmOpen(false);
    setSelectedIds(new Set());
    toast.success(`Disparo concluído: ${ok} enviados · ${fail} falharam`);
    refetch();
  };

  // ── Verificar retornos via Evolution API ──
  const checkReturns = async () => {
    setCheckingReturns(true);
    try {
      const ids = dispatchableLeads.filter((l) => l.message_sent_at).map((l) => l.id);
      if (ids.length === 0) {
        toast.info("Nenhum lead enviado para verificar");
        return;
      }
      const { data, error } = await supabase.functions.invoke("check-prospect-responses", {
        body: { leadIds: ids },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Verificados ${data?.checked || 0} · ${data?.updated || 0} responderam`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar retornos", { duration: 6000 });
    } finally {
      setCheckingReturns(false);
    }
  };


  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lead permanentemente?")) return;
    const { error } = await supabase.from("prospect_leads" as any).delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Lead excluído");
    refetch();
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ["Empresa", "Contato", "Telefone", "Email", "Segmento", "Valor", "Status", "Próximo Passo", "Observações", "Mensagem Enviada", "Última Interação", "Origem"];
    const rows = filteredLeads.map((l) => [
      l.company_name, l.contact_name || "", l.phone, l.email || "",
      l.segment || "", l.estimated_value || "",
      STATUS_META[l.interaction_status].label,
      l.next_step || "", (l.observations || "").replace(/\n/g, " "),
      l.message_sent_at ? new Date(l.message_sent_at).toLocaleString("pt-BR") : "",
      l.last_interaction_at ? new Date(l.last_interaction_at).toLocaleString("pt-BR") : "",
      l.source,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospeccao_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredLeads.length} leads exportados`);
  };

  // ── Import CRM contacts ──
  const importFromCRM = async () => {
    if (!user) return;
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, phone, email")
      .eq("assigned_agent_id", user.id)
      .limit(500);
    if (!contacts || contacts.length === 0) {
      toast.info("Você não tem contatos atribuídos no CRM");
      return;
    }
    // Filtrar contatos já importados
    const existing = new Set(leads.filter((l) => l.contact_id).map((l) => l.contact_id));
    const newOnes = contacts.filter((c) => !existing.has(c.id));
    if (newOnes.length === 0) {
      toast.info("Todos os seus contatos do CRM já foram importados");
      return;
    }
    const rows = newOnes.map((c) => ({
      company_name: c.name,
      contact_name: c.name,
      phone: c.phone,
      email: c.email,
      contact_id: c.id,
      assigned_agent_id: user.id,
      created_by: user.id,
      source: "crm",
    }));
    const { error } = await supabase.from("prospect_leads" as any).insert(rows);
    if (error) return toast.error("Erro ao importar: " + error.message);
    toast.success(`${rows.length} contatos importados do CRM`);
    refetch();
  };

  // ── Import CSV (suporta `,` ou `;`, aspas, BOM, RD Station rico) ──
  const onCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const raw = (await file.text()).replace(/^\uFEFF/, "");

    // Detecta delimitador pela primeira linha (mais ; ou ,)
    const firstLine = raw.split(/\r?\n/)[0] || "";
    const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";

    // Parser CSV robusto (RFC 4180-like): respeita aspas, escapa "" e quebras de linha dentro de aspas
    const rows: string[][] = [];
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
        else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
        else if (c === "\r") { /* skip */ }
        else field += c;
      }
    }
    if (field.length || cur.length) { cur.push(field); rows.push(cur); }
    const dataRows = rows.filter((r) => r.some((c) => c.trim()));
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
      // remove tudo exceto dígitos, vírgula e ponto; aceita 700.000,00 ou 700000.00 ou 700000
      const cleaned = v.replace(/[^\d,.-]/g, "");
      if (!cleaned) return null;
      let normalized = cleaned;
      // se tem ambos . e , assume . como milhar e , como decimal (BR)
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

    // Normaliza telefone (somente dígitos) para deduplicação
    const normPhone = (p: string) => (p || "").replace(/\D/g, "");

    // 1) Dedupe dentro do próprio arquivo (mantém o primeiro de cada telefone)
    const seenInFile = new Set<string>();
    let dupInFile = 0;
    const uniqueInFile: typeof parsed = [];
    for (const r of parsed) {
      const key = normPhone(r.phone);
      if (!key) continue;
      if (seenInFile.has(key)) { dupInFile++; continue; }
      seenInFile.add(key);
      uniqueInFile.push(r);
    }

    // 2) Busca telefones já existentes no banco (em lotes para não estourar URL)
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
      ((data as any[]) || []).forEach((row) => existing.add(normPhone(row.phone)));
    }

    const toInsert = uniqueInFile.filter((r) => !existing.has(normPhone(r.phone)));
    const dupInDb = uniqueInFile.length - toInsert.length;
    const totalDup = dupInFile + dupInDb;

    if (toInsert.length === 0) {
      toast.info(`Nenhum lead novo. ${totalDup} duplicado(s) ignorado(s).`);
      setShowImport(false);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // 3) Insere em chunks de 200 para evitar limites
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
    setShowImport(false);
    refetch();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prospecção</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Disparo de mensagens e acompanhamento de retornos
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={qualifyAll}
              disabled={qualifyingAll || leads.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              title="A IA analisa as últimas 6 mensagens de cada lead e classifica automaticamente"
            >
              {qualifyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {qualifyingAll ? "Qualificando..." : "Qualificar com IA"}
            </button>
            <button
              onClick={() => setShowTemplate(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              title="Configurar mensagem de prospecção"
            >
              <Settings className="w-4 h-4" /> Mensagem
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Upload className="w-4 h-4" /> Importar
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Novo Lead
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {([
            { id: "disparador", label: "Disparador", icon: Send, color: "text-emerald-500" },
            { id: "historico", label: "Histórico", icon: Users, color: "text-purple-500" },
          ] as { id: Tab; label: string; icon: any; color: string }[]).map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 ${tab === id ? "text-primary" : color}`} /> {label}
            </button>
          ))}
        </div>


        {/* ============ HISTÓRICO ============ */}
        {tab === "historico" && (() => {
          const sentLeads = filteredLeads.filter((l) => !!l.message_sent_at);
          const renderMessage = (l: ProspectLead) => {
            const first = extractLeadFirstName(l.contact_name, l.company_name);
            return messageTemplate
              .replace(/\{empresa\}/gi, l.company_name || "")
              .replace(/\{contato\}/gi, first);
          };
          return (
          <div className="space-y-4">
            <FilterBar
              search={search} setSearch={setSearch}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              filterSeg={filterSeg} setFilterSeg={setFilterSeg}
              filterState={filterState} setFilterState={setFilterState}
              filterLoss={filterLoss} setFilterLoss={setFilterLoss}
              stateOptions={stateOptions} lossOptions={lossOptions}
            />
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-3 border-b border-border text-xs text-muted-foreground flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-emerald-500" />
                {sentLeads.length} {sentLeads.length === 1 ? "lead enviado via API" : "leads enviados via API"}
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : sentLeads.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Nenhum lead com mensagem enviada ainda
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {["Empresa", "Contato", "Mensagem enviada", "Enviado em", "Status", "Ações"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sentLeads.map((l) => {
                        const m = STATUS_META[l.interaction_status];
                        const msg = renderMessage(l);
                        return (
                          <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/20 align-top">
                            <td className="px-4 py-2.5 text-foreground font-medium">{l.company_name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {l.contact_name && <div>{l.contact_name}</div>}
                              <div className="text-xs">{formatPhone(l.phone)}</div>
                            </td>
                            <td className="px-4 py-2.5 text-foreground max-w-[420px]">
                              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3" title={msg}>
                                {msg}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {l.message_sent_at ? new Date(l.message_sent_at).toLocaleString("pt-BR") : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${m.className}`}>{m.label}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => qualifyLead(l.id)}
                                  disabled={qualifyingId === l.id}
                                  className="p-1.5 rounded hover:bg-purple-500/10 text-purple-500 disabled:opacity-50"
                                  title="Qualificar com IA (analisa últimas 6 mensagens)"
                                >
                                  {qualifyingId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setEditingLead(l)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500" title="Editar">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ============ DISPARADOR ============ */}
        {tab === "disparador" && (
          <div className="space-y-5">
            {(() => {
              const activeAdvCount =
                (filterSeg ? 1 : 0) +
                (filterState ? 1 : 0) +
                (filterLoss ? 1 : 0) +
                (filterProduct ? 1 : 0) +
                (dateSentFrom || dateSentTo ? 1 : 0) +
                (dateReturnFrom || dateReturnTo ? 1 : 0);
              const clearAdv = () => {
                setFilterSeg(""); setFilterState(""); setFilterLoss(""); setFilterProduct("");
                setDateSentFrom(""); setDateSentTo("");
                setDateReturnFrom(""); setDateReturnTo("");
              };
              return (
            <section className="bg-card border border-border rounded-xl shadow-sm">
              {/* Linha principal: busca + status + template + filtros */}
              <div className="p-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar empresa, contato, segmento…"
                    className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="h-9 px-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todos os Status</option>
                  <option value="novo">Novo</option>
                  <option value="sim">Respondeu</option>
                  <option value="pendente">Pendente</option>
                  <option value="nao">Não respondeu</option>
                </select>

                <div className="flex items-center h-9 rounded-lg border border-input bg-background overflow-hidden">
                  <MessageCircle className="w-4 h-4 text-muted-foreground ml-2.5" />
                  <select
                    value={activeTemplateId}
                    onChange={(e) => setActiveTemplate(e.target.value)}
                    className="h-9 pl-2 pr-2 bg-transparent text-sm text-foreground focus:outline-none border-0 max-w-[160px]"
                    title="Texto padrão"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowTemplate(true)}
                    className="h-9 px-2.5 border-l border-input text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="Editar texto"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setShowAdvFilters((v) => !v)}
                  className={`relative flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    showAdvFilters || activeAdvCount > 0
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filtros
                  {activeAdvCount > 0 && (
                    <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {activeAdvCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvFilters ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Filtros avançados (colapsável) */}
              {showAdvFilters && (
                <div className="px-3 pb-3 pt-1 border-t border-border/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <select
                      value={filterSeg}
                      onChange={(e) => setFilterSeg(e.target.value)}
                      className="h-9 px-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Todos os Segmentos</option>
                      {Array.from(new Set(leads.map((l) => l.segment).filter(Boolean))).map((s) => (
                        <option key={s as string} value={s as string}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={filterProduct}
                      onChange={(e) => setFilterProduct(e.target.value)}
                      className="h-9 px-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Todos os Produtos de interesse</option>
                      {productOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={filterState}
                      onChange={(e) => setFilterState(e.target.value)}
                      className="h-9 px-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Todos os Estados</option>
                      {stateOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={filterLoss}
                      onChange={(e) => setFilterLoss(e.target.value)}
                      className="h-9 px-3 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Motivos de Perda</option>
                      {lossOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data de envio</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="date" value={dateSentFrom} onChange={(e) => setDateSentFrom(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1" />
                        <span className="text-[10px] text-muted-foreground">até</span>
                        <input type="date" value={dateSentTo} onChange={(e) => setDateSentTo(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Último retorno</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="date" value={dateReturnFrom} onChange={(e) => setDateReturnFrom(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1" />
                        <span className="text-[10px] text-muted-foreground">até</span>
                        <input type="date" value={dateReturnTo} onChange={(e) => setDateReturnTo(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1" />
                      </div>
                    </div>
                  </div>

                  {activeAdvCount > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={clearAdv}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" /> Limpar filtros
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Toolbar: status disparo + ações */}
              <div className="px-3 py-2.5 flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 rounded-b-xl">
                {([
                  { v: "", label: `Todos (${filteredLeads.length})` },
                  { v: "not_sent", label: `Não enviados (${filteredLeads.filter((l) => !l.message_sent_at).length})` },
                  { v: "sent", label: `Enviados (${filteredLeads.filter((l) => !!l.message_sent_at).length})` },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setFilterSent(opt.v as any)}
                    className={`px-3 h-7 rounded-full text-xs font-medium border transition-colors ${
                      filterSent === opt.v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dispatchableLeads.length > 0 && dispatchableLeads.every((l) => selectedIds.has(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(dispatchableLeads.map((l) => l.id)));
                        else setSelectedIds(new Set());
                      }}
                      className="w-3.5 h-3.5 rounded border-input"
                    />
                    Selecionar visíveis ({selectedIds.size}/{dispatchableLeads.length})
                  </label>
                  <button
                    onClick={checkReturns}
                    disabled={checkingReturns}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                    title="Lê as conversas via Evolution API e marca quem respondeu após o disparo"
                  >
                    {checkingReturns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Verificar retornos
                  </button>
                  <button
                    onClick={() => setBulkConfirmOpen(true)}
                    disabled={dispatchableLeads.length === 0}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-success text-success-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Disparar
                  </button>
                </div>
              </div>
            </section>
              );
            })()}

            {/* ===== Grid de leads ===== */}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : dispatchableLeads.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum lead elegível para disparo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajuste os filtros de data, importe contatos do CRM ou adicione um lead novo
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {dispatchableLeads.map((l) => {
                  const m = STATUS_META[l.interaction_status];
                  const sent = !!l.message_sent_at;
                  const lastWA = getLastWAInteraction(l);
                  const inactiveDays = daysSince(lastWA);
                  const isSelected = selectedIds.has(l.id);
                  return (
                    <div
                      key={l.id}
                      className={`group relative bg-card rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                        isSelected ? "border-primary/60 ring-2 ring-primary/15" : "border-border hover:border-primary/30"
                      }`}
                    >
                      {/* Accent bar lateral (verde = enviado, laranja = não enviado) */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          sent ? "bg-emerald-500" : "bg-orange-500"
                        }`}
                      />

                      <div className="pl-4 pr-5 py-4 space-y-3">
                        {/* Cabeçalho */}
                        <div className="flex justify-between items-start gap-2">
                          <label className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(l.id); else next.delete(l.id);
                                  return next;
                                });
                              }}
                              className="mt-1 w-4 h-4 rounded border-input shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                                {l.company_name || "Sem nome"}
                              </h3>
                              {l.role && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{l.role}</p>
                              )}
                              {l.contact_name && (
                                <p className="text-[11px] text-foreground/70 font-medium mt-0.5 truncate">{l.contact_name}</p>
                              )}
                              {(l.city || l.state) && (
                                <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                                  {[l.city, l.state].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                          </label>
                          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${m.className}`}>
                            {m.label}
                          </span>
                        </div>

                        {/* Status disparo - destaque grande */}
                        <div
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                            sent
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-orange-500/10 border-orange-500/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {sent ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <CircleDashed className="w-4 h-4 text-orange-500 shrink-0" />
                            )}
                            <span className={`text-xs font-semibold ${sent ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                              {sent ? "Enviado via API" : "Não enviado"}
                            </span>
                          </div>
                          {sent && l.message_sent_at && (
                            <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80 whitespace-nowrap">
                              {new Date(l.message_sent_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>

                        {/* Dados em grid com ícones coloridos */}
                        <div className="grid grid-cols-2 gap-y-2 gap-x-2">
                          <div className="flex items-center gap-1.5 text-xs text-foreground/85 min-w-0">
                            <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{formatPhone(l.phone)}</span>
                          </div>
                          {l.estimated_value != null && (
                            <div className="flex items-center gap-1.5 text-xs min-w-0">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(l.estimated_value)}</span>
                            </div>
                          )}
                          {inactiveDays != null && (
                            <div className="flex items-center gap-1.5 text-xs min-w-0">
                              <Clock className={`w-3.5 h-3.5 shrink-0 ${inactiveDays > 30 ? "text-red-500" : inactiveDays > 7 ? "text-amber-500" : "text-muted-foreground"}`} />
                              <span className={`truncate ${inactiveDays > 30 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                                Inativo {inactiveDays}d
                              </span>
                            </div>
                          )}
                          {l.funnel_stage && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/85 min-w-0 col-span-2">
                              <TrendingUp className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{l.funnel_stage}</span>
                            </div>
                          )}
                          {l.last_interaction_at && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/85 min-w-0 col-span-2">
                              <MessageCircle className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                              <span className="truncate">
                                Retorno: <span className="font-medium">{new Date(l.last_interaction_at).toLocaleDateString("pt-BR")}</span>
                              </span>
                            </div>
                          )}
                          {l.loss_reason && (
                            <div className="flex items-center gap-1.5 text-xs min-w-0 col-span-2">
                              <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="truncate text-red-600 dark:text-red-400">
                                Motivo da perda: <span className="font-medium">{l.loss_reason}</span>
                              </span>
                            </div>
                          )}
                          {(l.source_origin || l.source) && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/85 min-w-0 col-span-2">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">
                                Fonte: <span className="font-medium capitalize">{l.source_origin || l.source}</span>
                              </span>
                            </div>
                          )}
                          {l.equipment_type && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/85 min-w-0 col-span-2">
                              <Tag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                              <span className="truncate">
                                Produtos de interesse: <span className="font-medium">{l.equipment_type}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer com ações */}
                      <div className="px-4 py-3 bg-muted/30 border-t border-border/60 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setConfirmLead(l)}
                          disabled={sendingId === l.id}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm ${
                            sent
                              ? "bg-card border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              : "bg-emerald-500 text-white hover:bg-emerald-600"
                          }`}
                          title="Envia silenciosamente pelo número de prospecção via Evolution API"
                        >
                          {sendingId === l.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                          ) : (
                            <><Send className="w-3.5 h-3.5" /> {sent ? "Reenviar" : "Enviar WA"}</>
                          )}
                        </button>
                        <button
                          onClick={() => setEditingLead(l)}
                          className="flex items-center justify-center gap-1.5 bg-card border border-border text-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:bg-secondary transition-all"
                          title="Registrar retorno"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-500" /> Registrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>


      {/* ============ MODALS ============ */}
      {(showCreate || editingLead) && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => { setShowCreate(false); setEditingLead(null); }}
          onSaved={() => { refetch(); setShowCreate(false); setEditingLead(null); }}
          userId={user?.id || ""}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImportCRM={importFromCRM}
          onPickFile={() => fileRef.current?.click()}
        />
      )}

      {showTemplate && (
        <TemplateModal
          templates={templates}
          activeId={activeTemplateId}
          onClose={() => setShowTemplate(false)}
          onSaveAll={async (next, newActiveId) => {
            await saveTemplates(next, newActiveId);
            toast.success("Textos padrão salvos");
            setShowTemplate(false);
          }}
        />
      )}

      <input ref={fileRef} type="file" accept=".csv" hidden onChange={onCSVUpload} />

      {/* Confirmação de disparo em massa */}
      {bulkConfirmOpen && (() => {
        const targets = selectedIds.size > 0
          ? dispatchableLeads.filter((l) => selectedIds.has(l.id))
          : dispatchableLeads;
        const onlySelected = selectedIds.size > 0;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !bulkSending && setBulkConfirmOpen(false)}>
            <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Disparo em massa</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {onlySelected
                    ? <>Enviar para os <span className="font-semibold text-foreground">{targets.length} selecionado{targets.length === 1 ? "" : "s"}</span></>
                    : <>Enviar para <span className="font-semibold text-foreground">todos os {targets.length}</span> leads visíveis</>}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Mensagem padrão (placeholders {"{empresa}"}/{"{contato}"} serão substituídos)</label>
                <div className="mt-1 p-3 rounded-lg bg-secondary/40 border border-border text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {messageTemplate}
                </div>
              </div>

              {bulkSending && (
                <div className="space-y-2">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${(bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {bulkProgress.done}/{bulkProgress.total} · ✓ {bulkProgress.ok} · ✗ {bulkProgress.fail}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setBulkConfirmOpen(false)}
                  disabled={bulkSending}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => sendBulk(targets)}
                  disabled={bulkSending || targets.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {bulkSending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    : <><Send className="w-4 h-4" /> Confirmar disparo ({targets.length})</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmação de envio WhatsApp */}
      {confirmLead && (() => {
        const last = getLastWAInteraction(confirmLead);
        const days = daysSince(last);
        const isNewContact = days == null;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => sendingId === null && setConfirmLead(null)}>
            <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isNewContact ? "Enviar mensagem (novo contato)" : `Enviar mensagem (último contato há ${days}d)`}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Para <span className="font-medium text-foreground">{extractLeadFirstName(confirmLead.contact_name, confirmLead.company_name)}</span>
                  {" · "}
                  <span className="font-mono">{formatPhone(confirmLead.phone)}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Mensagem (edite antes de enviar)</label>
                <textarea
                  value={editableMessage}
                  onChange={(e) => setEditableMessage(e.target.value)}
                  rows={6}
                  autoFocus
                  className="mt-1 w-full p-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  placeholder="Digite a mensagem que será enviada..."
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {editableMessage.length} caracteres
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmLead(null)}
                  disabled={sendingId !== null}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const lead = confirmLead;
                    const msg = editableMessage.trim();
                    if (!msg) {
                      toast.error("Mensagem não pode estar vazia");
                      return;
                    }
                    await sendWhatsApp(lead, msg);
                    setConfirmLead(null);
                  }}
                  disabled={sendingId !== null || !editableMessage.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {sendingId === confirmLead.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Enviar mensagem</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AppLayout>
  );
};

// ─── Filter Bar ───
const FilterBar = ({
  search, setSearch, filterStatus, setFilterStatus, filterSeg, setFilterSeg,
  filterState, setFilterState, filterLoss, setFilterLoss,
  stateOptions = [], lossOptions = [],
}: any) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative flex-1 min-w-[220px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar empresa, contato, segmento, estado..."
        className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
    <select
      value={filterStatus}
      onChange={(e) => setFilterStatus(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Todos os Status</option>
      <option value="novo">Novo</option>
      <option value="sim">✅ Interagiu</option>
      <option value="pendente">⏳ Pendente</option>
      <option value="nao">❌ Sem retorno</option>
    </select>
    <select
      value={filterSeg}
      onChange={(e) => setFilterSeg(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Todos os Segmentos</option>
      {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
    </select>
    <select
      value={filterState ?? ""}
      onChange={(e) => setFilterState?.(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Todos os Estados</option>
      {stateOptions.map((s: string) => <option key={s} value={s}>{s}</option>)}
    </select>
    <select
      value={filterLoss ?? ""}
      onChange={(e) => setFilterLoss?.(e.target.value)}
      className="h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Todos os Motivos de Perda</option>
      {lossOptions.map((s: string) => <option key={s} value={s}>{s}</option>)}
    </select>
  </div>
);

// ─── Lead Form Modal ───
const LeadFormModal = ({ lead, onClose, onSaved, userId }: {
  lead: ProspectLead | null; onClose: () => void; onSaved: () => void; userId: string;
}) => {
  const [form, setForm] = useState({
    company_name: lead?.company_name || "",
    contact_name: lead?.contact_name || "",
    phone: lead?.phone || "",
    email: lead?.email || "",
    segment: lead?.segment || "",
    estimated_value: lead?.estimated_value?.toString() || "",
    interaction_status: (lead?.interaction_status || "novo") as StatusKey,
    next_step: lead?.next_step || "",
    observations: lead?.observations || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.company_name || !form.phone) return toast.error("Empresa e telefone são obrigatórios");
    setSaving(true);
    const payload = {
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      phone: onlyDigits(form.phone),
      email: form.email || null,
      segment: form.segment || null,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      interaction_status: form.interaction_status,
      next_step: form.next_step || null,
      observations: form.observations || null,
      last_interaction_at: form.interaction_status !== "novo" ? new Date().toISOString() : lead?.last_interaction_at || null,
    };
    let error;
    if (lead) {
      ({ error } = await supabase.from("prospect_leads" as any).update(payload).eq("id", lead.id));
    } else {
      ({ error } = await supabase.from("prospect_leads" as any).insert({
        ...payload,
        assigned_agent_id: userId,
        created_by: userId,
        source: "manual",
      }));
    }
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success(lead ? "Lead atualizado" : "Lead criado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{lead ? "Editar Lead" : "Novo Lead"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Empresa *" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do contato" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
            <Field label="Telefone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" />
          </div>
          <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Segmento" value={form.segment} onChange={(v) => setForm({ ...form, segment: v })} options={["", ...SEGMENTS]} />
            <Field label="Valor estimado (R$)" type="number" value={form.estimated_value} onChange={(v) => setForm({ ...form, estimated_value: v })} />
          </div>
          <SelectField
            label="Status da interação"
            value={form.interaction_status}
            onChange={(v) => setForm({ ...form, interaction_status: v as StatusKey })}
            options={[["novo", "🔘 Novo"], ["sim", "✅ Houve interação"], ["pendente", "⏳ Pendente"], ["nao", "❌ Sem retorno"]] as any}
          />
          <SelectField label="Próximo passo" value={form.next_step} onChange={(v) => setForm({ ...form, next_step: v })} options={["", ...NEXT_STEPS]} />
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Observações</label>
            <textarea
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              rows={3}
              placeholder="Anote o que foi discutido, interesse demonstrado, objeções..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Import Modal ───
const ImportModal = ({ onClose, onImportCRM, onPickFile }: any) => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Importar Leads</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="p-4 space-y-3">
        <button
          onClick={() => { onImportCRM(); onClose(); }}
          className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
        >
          <Users className="w-6 h-6 text-primary shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground">Dos meus contatos do CRM</div>
            <div className="text-xs text-muted-foreground">Importa contatos atribuídos a você</div>
          </div>
        </button>
        <button
          onClick={() => { onPickFile(); onClose(); }}
          className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
        >
          <Upload className="w-6 h-6 text-primary shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground">Arquivo CSV</div>
            <div className="text-xs text-muted-foreground">Suporta formato RD Station (`;` ou `,`) — empresa, telefone, email, segmento, valor, estado, cidade, motivo de perda, etapa, responsável, etc.</div>
          </div>
        </button>
      </div>
    </div>
  </div>
);

// ─── Field helpers ───
const Field = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div>
    <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: any) => (
  <div>
    <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o: any) => {
        if (Array.isArray(o)) return <option key={o[0]} value={o[0]}>{o[1]}</option>;
        return <option key={o} value={o}>{o || "Selecionar..."}</option>;
      })}
    </select>
  </div>
);

// ─── Template Modal (gerenciador de textos padrão) ───
const TemplateModal = ({ templates, activeId, onClose, onSaveAll }: {
  templates: SavedTemplate[];
  activeId: string;
  onClose: () => void;
  onSaveAll: (next: SavedTemplate[], newActiveId?: string) => void;
}) => {
  const [list, setList] = useState<SavedTemplate[]>(templates);
  const [selectedId, setSelectedId] = useState<string>(activeId || templates[0]?.id || "");
  const selected = list.find((t) => t.id === selectedId) || list[0];

  const updateSelected = (patch: Partial<SavedTemplate>) => {
    setList((prev) => prev.map((t) => (t.id === selectedId ? { ...t, ...patch } : t)));
  };

  const addNew = () => {
    const id = `tpl_${Date.now()}`;
    const next: SavedTemplate = { id, name: "Novo texto", content: "" };
    const updated = [...list, next];
    setList(updated);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (list.length <= 1) {
      toast.error("Mantenha ao menos 1 texto padrão");
      return;
    }
    if (!confirm(`Excluir "${selected?.name}"?`)) return;
    const updated = list.filter((t) => t.id !== selectedId);
    setList(updated);
    setSelectedId(updated[0].id);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Textos padrão de prospecção</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crie, edite e selecione modelos de mensagem reutilizáveis</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[220px_1fr]">
          {/* Lista lateral */}
          <div className="border-r border-border p-3 space-y-1 overflow-y-auto">
            <button
              onClick={addNew}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 mb-2"
            >
              <Plus className="w-3.5 h-3.5" /> Novo texto
            </button>
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === t.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <div className="truncate">{t.name || "(sem nome)"}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.content.slice(0, 40) || "—"}</div>
              </button>
            ))}
          </div>
          {/* Editor */}
          <div className="p-4 space-y-3 overflow-y-auto">
            {selected ? (
              <>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Nome do texto</label>
                  <input
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                    placeholder="Ex: Apresentação inicial, Follow-up 7 dias..."
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Mensagem</label>
                  <textarea
                    value={selected.content}
                    onChange={(e) => updateSelected({ content: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Digite a mensagem que será enviada ao lead..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: <code className="bg-secondary px-1 rounded">{`{contato}`}</code> · <code className="bg-secondary px-1 rounded">{`{empresa}`}</code>
                  </p>
                </div>
                <button
                  onClick={removeSelected}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir este texto
                </button>
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12">Nenhum texto. Clique em "Novo texto".</div>
            )}
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary">Cancelar</button>
          <button
            onClick={() => {
              const cleaned = list
                .map((t) => ({ ...t, name: t.name.trim() || "Sem nome", content: t.content }))
                .filter((t) => t.content.trim() || t.name);
              if (cleaned.length === 0) {
                toast.error("Salve ao menos 1 texto");
                return;
              }
              onSaveAll(cleaned, selectedId);
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Salvar tudo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Prospecting;

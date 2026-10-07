import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, X, FileSpreadsheet, Loader2, Info, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ApprovedTemplate {
  name: string;
  language: string;
  category: string;
  variables: number;
  body: string;
}

function normPhone(raw: string): string {
  return (raw || "").toString().replace(/\D/g, "");
}

function pick(row: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase().trim() === k.toLowerCase()) {
        const v = row[rk];
        if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return null;
}

function firstNameOf(v: string | null): string {
  const s = (v || "").trim();
  if (!s) return "Cliente";
  const first = s.split(/\s+/)[0];
  if (!first) return "Cliente";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function MetaTemplateCampaignCreateModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<ApprovedTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [throttle, setThrottle] = useState(1500);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [handoffDeptId, setHandoffDeptId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTemplatesLoading(true);
    supabase.functions.invoke("list-wa-templates", { body: {} })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        const list: ApprovedTemplate[] = (data?.templates || [])
          .filter((t: any) => t.status === "APPROVED")
          .map((t: any) => ({
            name: t.name,
            language: t.language,
            category: t.category,
            variables: t.variables || 0,
            body: t.body || t.body_preview || "",
          }));
        setTemplates(list);
        if (list.length > 0) setTemplateName(list[0].name);
        else toast.error("Nenhum template aprovado encontrado nesta conta do WhatsApp");
      })
      .catch((e: any) => toast.error("Erro ao buscar templates: " + (e.message || e)))
      .finally(() => setTemplatesLoading(false));
  }, [open]);

  const template = useMemo(
    () => templates.find((t) => t.name === templateName) || null,
    [templates, templateName]
  );

  const preview = useMemo(() => {
    if (!template) return "";
    const sampleName = rows[0] ? firstNameOf(pick(rows[0], ["Nome", "nome", "Name"])) : "Cliente";
    const sampleCity = (rows[0] ? pick(rows[0], ["Cidade", "cidade", "City"]) : null) || "sua região";
    return template.body
      .replace(/\{\{\s*1\s*\}\}/g, sampleName)
      .replace(/\{\{\s*2\s*\}\}/g, sampleCity)
      .replace(/\{\{\s*\d+\s*\}\}/g, "…");
  }, [rows, template]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { defval: "" });
      setRows(json);
      setFileName(file.name);
      if (!name) setName(`${template?.name || "Campanha"} — ${file.name.replace(/\.(xlsx|csv)$/i, "")}`);
      toast.success(`${json.length} linhas lidas da aba "${sheetName}"`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    }
  };

  const reset = () => {
    setName("");
    setThrottle(1500); setRows([]); setFileName(""); setHandoffDeptId("");
  };


  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe um nome para a campanha");
    if (!templateName) return toast.error("Selecione um template aprovado");
    if (rows.length === 0) return toast.error("Faça upload de uma planilha com leads");
    if (!handoffDeptId) return toast.error("Selecione o setor que receberá as respostas");

    setSubmitting(true);
    try {
      const selected = templates.find((t) => t.name === templateName)!;
      const { data: campaign, error: cErr } = await supabase
        .from("mass_campaigns")
        .insert({
          name: name.trim(),
          message_template: selected.body,
          throttle_ms: throttle,
          status: "draft",
          channel: "meta_template",
          meta_template_name: selected.name,
          meta_template_language: selected.language,
          handoff_department_id: handoffDeptId,
        } as any)
        .select().single();
      if (cErr) throw cErr;

      const seen = new Set<string>();
      const leads = rows
        .map((r) => {
          const phoneRaw = pick(r, ["Telefone normalizado", "Telefone", "Phone", "phone", "Celular"]) || "";
          const phone = normPhone(phoneRaw);
          if (!phone || phone.length < 10) return null;
          if (seen.has(phone)) return null;
          seen.add(phone);
          const scoreStr = pick(r, ["Score", "score"]);
          return {
            campaign_id: campaign.id,
            nome: pick(r, ["Nome", "nome", "Name"]),
            empresa: pick(r, ["Empresa", "empresa", "Company"]),
            telefone: phoneRaw,
            telefone_normalizado: phone,
            modelo: pick(r, ["Produto sugerido", "Modelo", "modelo", "Produto"]),
            cidade: pick(r, ["Cidade", "cidade", "City"]),
            uf: pick(r, ["UF", "Estado", "State"]),
            fonte: pick(r, ["Fonte", "fonte", "Source"]),
            segmento: pick(r, ["Segmento sugerido", "Segmento", "segmento"]),
            score: scoreStr ? Number(scoreStr) || null : null,
            prioridade: pick(r, ["Prioridade", "prioridade"]),
            email: pick(r, ["Email", "email", "E-mail"]),
            status: "pending",
          };
        })
        .filter(Boolean) as any[];

      if (leads.length === 0) {
        await supabase.from("mass_campaigns").delete().eq("id", campaign.id);
        throw new Error("Nenhum lead válido encontrado (verifique a coluna Telefone)");
      }

      for (let i = 0; i < leads.length; i += 500) {
        const chunk = leads.slice(i, i + 500);
        const { error } = await supabase.from("mass_campaign_leads").insert(chunk);
        if (error) throw error;
      }

      await supabase.from("mass_campaigns").update({ total_leads: leads.length }).eq("id", campaign.id);

      toast.success(`Campanha criada com ${leads.length} leads`);
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Nova Campanha — Template Meta</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da campanha"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Intervalo entre envios</label>
              <div className="flex items-center gap-3">
                <input type="number" min={500} step={250} value={throttle}
                  onChange={(e) => setThrottle(Number(e.target.value) || 1500)}
                  className="w-32 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Template aprovado (busca na Meta)</label>
            {templatesLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando templates aprovados…
              </div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg bg-secondary/30">
                Nenhum template aprovado. Verifique o token na aba Configurações → Meta.
              </div>
            ) : (
              <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.language}){t.variables > 0 ? ` — ${t.variables} variáveis` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {template && (
            <div className="bg-secondary/40 border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Prévia (usando o 1º lead)</p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{preview}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5" /> Setor que receberá as respostas
            </label>
            <select value={handoffDeptId} onChange={(e) => setHandoffDeptId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
              <option value="">Selecione um setor…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Quando o lead responder, a conversa aparece no Inbox já atribuída a este setor. Sem resposta, nada aparece.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Planilha de leads</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg px-4 py-6 text-center hover:bg-secondary/30 transition">
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-xs text-muted-foreground">— {rows.length} linhas</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para enviar XLSX ou CSV</span>
                </div>
              )}
            </button>
            <div className="flex items-start gap-2 mt-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Colunas: <strong>Nome, Empresa, Telefone, Produto sugerido, Cidade, UF, Fonte, Score</strong>. Telefones duplicados são removidos. As variáveis do template usam Nome ({{1}}) e Cidade ({{2}}).</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting || rows.length === 0 || !templateName}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar campanha ({rows.length})
          </button>
        </div>
      </div>
    </div>
  );
}

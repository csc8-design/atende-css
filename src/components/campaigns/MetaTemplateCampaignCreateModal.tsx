import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, X, FileSpreadsheet, Loader2, Info, Image as ImageIcon, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SEGMENTS = ["Agro", "Escavadeiras", "Pás Carregadeiras", "Mini Escavadeiras", "Florestal", "Não identificado", "Outro"];

// Templates aprovados (adicione aqui novos templates conforme forem aprovados na Meta)
const META_TEMPLATES = [
  {
    name: "arraiacbmaq",
    language: "pt_BR",
    label: "Arraiá ENGWE — 30% OFF + Starlink",
    hasHeaderImage: false,
    body: "🔥 Arraiá de Ofertas ENGWE:\n\nAté 30% OFF e Concorra a uma Starlink.\n\nOlá, {{1}}! Theo aqui.\n\nVi seu cadastro e separei as máquinas ideais para o seu segmento com um super desconto de 30% OFF exclusivo de Festa Junina.\n\nÉ a oportunidade certa para melhorar sua operação com o melhor preço do ano.\n\nQuer receber os modelos e as condições de pagamento? Clique abaixo e fale comigo agora!",
    variables: ["nome"] as const,
  },
  {
    name: "tratores_arraia",
    language: "pt_BR",
    label: "Tratores Arraiá — 30% OFF + Starlink",
    hasHeaderImage: true,
    body: "🔥 Arraiá de Ofertas ENGWE:\n\nAté 30% OFF e Concorra a uma Starlink.\n\nOlá, {{1}}! Theo aqui.\n\nVi seu cadastro e separei as tratores ideais para o seu segmento com um super desconto de 30% OFF exclusivo de Festa Junina.\n\nÉ a oportunidade certa para melhorar sua operação com o melhor preço do ano.\n\nQuer receber os modelos e as condições de pagamento?",
    variables: ["nome"] as const,
  },
];

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
  const [segment, setSegment] = useState("Agro");
  const [templateName, setTemplateName] = useState(META_TEMPLATES[0].name);
  const [throttle, setThrottle] = useState(1500);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [handoffDeptId, setHandoffDeptId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [open]);


  const template = useMemo(() => META_TEMPLATES.find((t) => t.name === templateName)!, [templateName]);

  const preview = useMemo(() => {
    const sampleName = rows[0] ? firstNameOf(pick(rows[0], ["Nome", "nome", "Name"])) : "Cliente";
    return template.body.replace(/\{\{\s*1\s*\}\}/g, sampleName);
  }, [rows, template]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      let sheetName = wb.SheetNames[0];
      const segLower = segment.toLowerCase();
      const matched = wb.SheetNames.find((s) => s.toLowerCase().includes(segLower.split(" ")[0]));
      if (matched) sheetName = matched;
      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { defval: "" });
      setRows(json);
      setFileName(file.name);
      if (!name) setName(`${template.label} — ${file.name.replace(/\.(xlsx|csv)$/i, "")}`);
      toast.success(`${json.length} linhas lidas da aba "${sheetName}"`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx 5MB para header Meta)");
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `meta-campaigns/headers/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("whatsapp-media").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      setHeaderImageUrl(data.publicUrl);
      toast.success("Imagem de cabeçalho anexada");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  const reset = () => {
    setName(""); setSegment("Agro"); setTemplateName(META_TEMPLATES[0].name);
    setThrottle(1500); setRows([]); setFileName(""); setHeaderImageUrl(null); setHandoffDeptId("");
  };


  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe um nome para a campanha");
    if (rows.length === 0) return toast.error("Faça upload de uma planilha com leads");
    // imagem de header é opcional
    if (!handoffDeptId) return toast.error("Selecione o setor que receberá as respostas");

    setSubmitting(true);
    try {
      const { data: campaign, error: cErr } = await supabase
        .from("mass_campaigns")
        .insert({
          name: name.trim(),
          segment,
          message_template: template.body,
          throttle_ms: throttle,
          status: "draft",
          channel: "meta_template",
          meta_template_name: template.name,
          meta_template_language: template.language,
          meta_header_media_url: headerImageUrl,
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
            segmento: pick(r, ["Segmento sugerido", "Segmento", "segmento"]) || segment,
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
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Arraiá Escavadeiras"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Segmento</label>
              <select value={segment} onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Template Meta aprovado</label>
            <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
              {META_TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.label} ({t.name})</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Variáveis do template: {template.variables.map((v, i) => <code key={v} className="bg-secondary px-1 rounded mx-0.5">{`{{${i+1}}}=${v}`}</code>)}
            </p>
          </div>

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



          <div className="bg-secondary/40 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Prévia (usando o 1º lead)</p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{preview}</p>
          </div>

          {template.hasHeaderImage && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                Imagem do cabeçalho (obrigatória) <span className="normal-case text-muted-foreground/70 font-normal">— JPG/PNG até 5MB</span>
              </label>
              <input ref={mediaRef} type="file" accept="image/jpeg,image/png" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])} />
              {headerImageUrl ? (
                <div className="border border-border rounded-lg p-2 flex items-center gap-3">
                  <img src={headerImageUrl} alt="header" className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">Imagem anexada</p>
                    <p className="text-[10px] text-muted-foreground truncate">{headerImageUrl.split("/").pop()}</p>
                  </div>
                  <button onClick={() => mediaRef.current?.click()} className="text-xs text-primary hover:underline">Trocar</button>
                  <button onClick={() => setHeaderImageUrl(null)} className="text-xs text-destructive hover:underline">Remover</button>
                </div>
              ) : (
                <button onClick={() => mediaRef.current?.click()} disabled={uploadingMedia}
                  className="w-full border-2 border-dashed border-border rounded-lg px-4 py-4 text-center hover:bg-secondary/30 transition flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                  {uploadingMedia ? "Enviando..." : "Anexar imagem do header"}
                </button>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Intervalo entre envios</label>
            <div className="flex items-center gap-3">
              <input type="number" min={500} step={250} value={throttle}
                onChange={(e) => setThrottle(Number(e.target.value) || 1500)}
                className="w-32 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
              <span className="text-xs text-muted-foreground">ms (rec. 1000-2000 para respeitar rate limit Meta)</span>
            </div>
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
              <span>Colunas: <strong>Nome, Empresa, Telefone, Produto sugerido, Cidade, UF, Fonte, Score</strong>. Telefones duplicados são removidos.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting || rows.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar campanha ({rows.length})
          </button>
        </div>
      </div>
    </div>
  );
}

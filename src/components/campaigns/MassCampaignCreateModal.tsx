import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, X, FileSpreadsheet, Loader2, Info, Paperclip, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SEGMENTS = [
  "Agro",
  "Escavadeiras",
  "Pás Carregadeiras",
  "Mini Escavadeiras",
  "Florestal",
  "Não identificado",
  "Outro",
];

const INSTANCES = ["COMERCIAL_THEO", "ENVIO_NOT"];

const DEFAULT_TEMPLATE = "";

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

export default function MassCampaignCreateModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("Agro");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [evolutionInstance, setEvolutionInstance] = useState<string>("COMERCIAL_THEO");
  const [throttle, setThrottle] = useState(2000);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [mediaMime, setMediaMime] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

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
      if (!name) setName(`${segment} — ${file.name.replace(/\.(xlsx|csv)$/i, "")}`);
      toast.success(`${json.length} linhas lidas da aba "${sheetName}"`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) return toast.error("Arquivo muito grande (máx 16MB)");
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `mass-campaigns/new/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("whatsapp-media").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const mt = file.type.startsWith("image/") ? "image"
        : file.type.startsWith("video/") ? "video"
        : file.type.startsWith("audio/") ? "audio" : "document";
      setMediaUrl(data.publicUrl);
      setMediaType(mt);
      setMediaMime(file.type);
      toast.success("Mídia anexada");
    } catch (err: any) {
      toast.error("Erro ao enviar mídia: " + err.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  const reset = () => {
    setName(""); setSegment("Agro"); setTemplate(DEFAULT_TEMPLATE);
    setThrottle(2000); setRows([]); setFileName("");
    setEvolutionInstance("COMERCIAL_THEO");
    setMediaUrl(null); setMediaType(null); setMediaMime(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe um nome para a campanha");
    if (rows.length === 0) return toast.error("Faça upload de uma planilha com leads");

    setSubmitting(true);
    try {
      const { data: campaign, error: cErr } = await supabase
        .from("mass_campaigns")
        .insert({
          name: name.trim(),
          segment,
          message_template: template.trim() || null,
          throttle_ms: throttle,
          status: "draft",
          media_url: mediaUrl,
          media_type: mediaType,
          media_mime: mediaMime,
          evolution_instance: evolutionInstance,
        } as any)
        .select()
        .single();
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

      await supabase
        .from("mass_campaigns")
        .update({ total_leads: leads.length })
        .eq("id", campaign.id);

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
          <h2 className="text-lg font-semibold">Nova Campanha — Disparo em Massa</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Arraiá Escavadeiras"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Segmento</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
              Mensagem <span className="normal-case text-muted-foreground/70 font-normal">(opcional — pode definir depois)</span>
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              placeholder="Deixe em branco para escrever só na hora de enviar"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background font-mono"
            />

            <div className="flex flex-wrap gap-1.5 mt-2">
              {["{{nome}}", "{{empresa}}", "{{modelo}}", "{{cidade}}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemplate((t) => t + " " + v)}
                  className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Mídia anexa */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
              Anexo <span className="normal-case text-muted-foreground/70 font-normal">(foto, vídeo ou PDF — opcional)</span>
            </label>
            <input
              ref={mediaRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
            />
            {mediaUrl ? (
              <div className="border border-border rounded-lg p-2 flex items-center gap-3">
                {mediaType === "image" ? (
                  <img src={mediaUrl} alt="anexo" className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center">
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{mediaType?.toUpperCase()} anexado</p>
                  <p className="text-[10px] text-muted-foreground truncate">{mediaUrl.split("/").pop()}</p>
                </div>
                <button onClick={() => mediaRef.current?.click()} className="text-xs text-primary hover:underline">Trocar</button>
                <button
                  onClick={() => { setMediaUrl(null); setMediaType(null); setMediaMime(null); }}
                  className="text-xs text-destructive hover:underline"
                >Remover</button>
              </div>
            ) : (
              <button
                onClick={() => mediaRef.current?.click()}
                disabled={uploadingMedia}
                className="w-full border-2 border-dashed border-border rounded-lg px-4 py-4 text-center hover:bg-secondary/30 transition flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                {uploadingMedia ? "Enviando..." : "Anexar foto / vídeo / PDF"}
              </button>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Se anexar mídia, a mensagem acima vira a legenda enviada com o arquivo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Chip de envio (Evolution)</label>
              <select
                value={evolutionInstance}
                onChange={(e) => setEvolutionInstance(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <strong>ENVIO_NOT</strong> para disparos frios e <strong>COMERCIAL_THEO</strong> só para contatos que já te conhecem.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Intervalo entre envios</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={500}
                  step={250}
                  value={throttle}
                  onChange={(e) => setThrottle(Number(e.target.value) || 2000)}
                  className="w-32 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
                <span className="text-xs text-muted-foreground">ms (rec. 1500-3000)</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Planilha de leads</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg px-4 py-6 text-center hover:bg-secondary/30 transition"
            >
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
              <span>
                Colunas aceitas: <strong>Nome, Empresa, Telefone (ou Telefone normalizado), Produto sugerido, Cidade, UF, Fonte, Score</strong>. Telefones duplicados são removidos automaticamente.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary"
          >Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar campanha ({rows.length})
          </button>
        </div>
      </div>
    </div>
  );
}

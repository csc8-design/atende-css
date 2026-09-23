import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface ImportContactsProps {
  onImportComplete: () => void;
}

interface ParsedContact {
  name: string;
  phone: string;
  email: string;
  tags: string;
  valid: boolean;
  error?: string;
}

const BATCH_SIZE = 200;

const ImportContacts = ({ onImportComplete }: ImportContactsProps) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number; duplicates: number } | null>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    return lines.map((line) => {
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if ((ch === "," || ch === ";") && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());
      return cols;
    });
  };

  const detectColumns = (header: string[]) => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const lower = header.map(normalize);

    const nameIdx = lower.findIndex((h) => h.includes("nome") || h === "name" || h === "contato" || h === "fullname");
    const firstNameIdx = lower.findIndex((h) => h === "firstname");
    const middleNameIdx = lower.findIndex((h) => h === "middlename");
    const lastNameIdx = lower.findIndex((h) => h === "lastname");
    const fileAsIdx = lower.findIndex((h) => h === "fileas");
    const organizationIdx = lower.findIndex((h) => h === "organizationname" || h === "company");

    const phoneIndices = lower
      .map((h, index) => ({ h, index }))
      .filter(({ h }) => {
        const hasPhoneKeyword = h.includes("telefone") || h.includes("phone") || h.includes("celular") || h.includes("whatsapp") || h.includes("fone") || h.includes("mobile");
        const isValueColumn = h.includes("value") || !h.includes("label");
        return hasPhoneKeyword && isValueColumn;
      })
      .map(({ index }) => index);

    const emailIndices = lower
      .map((h, index) => ({ h, index }))
      .filter(({ h }) => (h.includes("email") || h.includes("mail")) && (h.includes("value") || !h.includes("label")))
      .map(({ index }) => index);

    const tagsIdx = lower.findIndex((h) => h.includes("tag") || h.includes("etiqueta") || h.includes("grupo") || h.includes("labels"));

    return {
      nameIdx,
      firstNameIdx,
      middleNameIdx,
      lastNameIdx,
      fileAsIdx,
      organizationIdx,
      phoneIndices,
      emailIndices,
      tagsIdx,
    };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setProgress(0);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast.error("Arquivo vazio ou sem dados suficientes");
        return;
      }

      const {
        nameIdx,
        firstNameIdx,
        middleNameIdx,
        lastNameIdx,
        fileAsIdx,
        organizationIdx,
        phoneIndices,
        emailIndices,
        tagsIdx,
      } = detectColumns(rows[0]);

      if (phoneIndices.length === 0) {
        toast.error("Não foi possível identificar colunas de telefone no cabeçalho do CSV");
        return;
      }

      // Deduplicate by phone
      const seen = new Set<string>();
      const contacts: ParsedContact[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        const composedName = [
          firstNameIdx !== -1 ? row[firstNameIdx]?.trim() || "" : "",
          middleNameIdx !== -1 ? row[middleNameIdx]?.trim() || "" : "",
          lastNameIdx !== -1 ? row[lastNameIdx]?.trim() || "" : "",
        ]
          .join(" ")
          .trim();

        const name =
          (nameIdx !== -1 ? row[nameIdx]?.trim() || "" : "") ||
          composedName ||
          (fileAsIdx !== -1 ? row[fileAsIdx]?.trim() || "" : "") ||
          (organizationIdx !== -1 ? row[organizationIdx]?.trim() || "" : "") ||
          "Sem nome";

        const email =
          emailIndices
            .map((idx) => row[idx]?.trim() || "")
            .find(Boolean) ||
          "";

        const tags = tagsIdx !== -1 ? row[tagsIdx]?.trim() || "" : "";

        const extractedPhones = phoneIndices
          .flatMap((idx) => (row[idx] || "").split(/\s*:::\s*/g))
          .map((raw) => raw.trim())
          .filter(Boolean)
          .map((raw) => raw.replace(/\D/g, ""));

        if (extractedPhones.length === 0) {
          contacts.push({ name, phone: "", email, tags, valid: false, error: "Telefone vazio" });
          continue;
        }

        for (const phone of extractedPhones) {
          let valid = true;
          let error = "";

          if (phone.length < 10) {
            valid = false;
            error = "Telefone inválido";
          } else if (seen.has(phone)) {
            valid = false;
            error = "Duplicado no arquivo";
          }

          if (valid) seen.add(phone);
          contacts.push({ name, phone, email, tags, valid, error });
        }
      }

      setParsed(contacts);
      toast.success(`${contacts.length} linhas lidas do arquivo`);
    };
    reader.readAsText(file, "UTF-8");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    const validContacts = parsed.filter((c) => c.valid);
    if (validContacts.length === 0) {
      toast.error("Nenhum contato válido para importar");
      return;
    }

    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    let duplicates = 0;
    const totalBatches = Math.ceil(validContacts.length / BATCH_SIZE);

    for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
      const batch = validContacts.slice(i, i + BATCH_SIZE).map((c) => ({
        name: c.name,
        phone: c.phone,
        whatsapp_id: c.phone,
        email: c.email || null,
        tags: c.tags ? c.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        assigned_agent_id: user?.id || null,
      }));

      const { data, error } = await supabase
        .from("contacts")
        .upsert(batch, { onConflict: "phone", ignoreDuplicates: true })
        .select("id");

      if (error) {
        failed += batch.length;
        console.error("Import batch error:", error);
      } else {
        const inserted = data?.length || 0;
        success += inserted;
        duplicates += batch.length - inserted;
      }

      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      setProgress(Math.round((currentBatch / totalBatches) * 100));

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < validContacts.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    setResult({ success, failed, duplicates });
    setImporting(false);
    setProgress(100);
    if (success > 0) {
      toast.success(`${success} contato(s) importado(s) com sucesso!`);
      onImportComplete();
    }
    if (duplicates > 0) {
      toast.info(`${duplicates} contato(s) já existiam e foram ignorados`);
    }
    if (failed > 0) {
      toast.error(`${failed} contato(s) falharam na importação`);
    }
  };

  const validCount = parsed.filter((c) => c.valid).length;
  const invalidCount = parsed.filter((c) => !c.valid).length;

  const downloadTemplate = () => {
    const csv = "nome,telefone,email,tags\nJoão Silva,5511999999999,joao@email.com,cliente\nMaria Santos,5521988888888,,fornecedor";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_contatos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {parsed.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">Importar Contatos</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Importe uma lista de contatos a partir de um arquivo CSV. O arquivo deve conter as colunas: <strong>nome</strong>, <strong>telefone</strong> e <strong>email</strong> (opcional).
          </p>
          <div className="flex items-center justify-center gap-3">
            <label className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
              Selecionar arquivo CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar modelo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">{parsed.length.toLocaleString("pt-BR")} contato(s) encontrado(s)</p>
              </div>
            </div>
            {!importing && (
              <button
                onClick={() => { setParsed([]); setResult(null); setProgress(0); }}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-foreground">{validCount.toLocaleString("pt-BR")} válido(s)</span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-foreground">{invalidCount.toLocaleString("pt-BR")} com erro(s)</span>
              </div>
            )}
          </div>

          {/* Progress bar during import */}
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Importando... {progress}%
              </p>
            </div>
          )}

          {/* Preview table */}
          <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Telefone</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((c, i) => (
                  <tr key={i} className={`border-t border-border/50 ${!c.valid ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-1.5">
                      {c.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <span className="text-[10px] text-destructive">{c.error}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-foreground">{c.name || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.length > 50 && (
            <p className="text-xs text-muted-foreground">
              Pré-visualizando 50 de {parsed.length.toLocaleString("pt-BR")} contatos
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-foreground">
                  {result.success.toLocaleString("pt-BR")} importado(s)
                  {result.duplicates > 0 && ` · ${result.duplicates.toLocaleString("pt-BR")} duplicado(s) ignorado(s)`}
                  {result.failed > 0 && ` · ${result.failed.toLocaleString("pt-BR")} com falha`}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!importing && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setParsed([]); setResult(null); setProgress(0); }}
                className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
              >
                {result ? "Nova importação" : "Cancelar"}
              </button>
              {!result && (
                <button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Importar {validCount.toLocaleString("pt-BR")} contato(s)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportContacts;

import { useState } from "react";
import { Check, Loader2, Sparkles, FileText, RefreshCw, Ban, Flame, Snowflake, Thermometer, RotateCcw, Eye, EyeOff, Target, UserCheck, Clock, Wallet, Pencil, X, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { QualConversation, QualQualification, CriterionState } from "@/hooks/useQualification";
import { temperatureFromScore } from "@/hooks/useQualification";

interface Props {
  conversation: QualConversation | null;
  qualification: QualQualification | null;
  analyzing: boolean;
  onReanalyze: () => void;
  onSetDisqualified: (v: boolean) => Promise<void> | void;
  onSetCriterionManual?: (key: keyof QualQualification["criteria"], qualified: boolean, reason: string) => Promise<void> | void;
  expanded?: boolean;
  showHistory?: boolean;
  onToggleHistory?: () => void;
}

const CRITERIA: Array<{ key: keyof QualQualification["criteria"]; label: string; tag: string; icon: typeof Target; accent: string; bgSoft: string }> = [
  { key: "necessidade", label: "Necessidade", tag: "Equipamento atual e função", icon: Target, accent: "text-sky-600 dark:text-sky-400", bgSoft: "bg-sky-500/10" },
  { key: "decisor", label: "Decisor", tag: "Quem aprova a compra", icon: UserCheck, accent: "text-violet-600 dark:text-violet-400", bgSoft: "bg-violet-500/10" },
  { key: "prazo", label: "Prazo / Urgência", tag: "Quando precisam", icon: Clock, accent: "text-amber-600 dark:text-amber-400", bgSoft: "bg-amber-500/10" },
  { key: "capacidade", label: "Capacidade Financeira", tag: "Porte e forma de pagamento", icon: Wallet, accent: "text-emerald-600 dark:text-emerald-400", bgSoft: "bg-emerald-500/10" },
];

function rankFromScore(s: number) {
  if (s === 0) return { label: "Desconsidere o lead", tone: "destructive" as const };
  if (s <= 2) return { label: "Lead frio", tone: "warning" as const };
  if (s === 3) return { label: "Lead potencial", tone: "info" as const };
  return { label: "Passagem de bastão", tone: "success" as const };
}

function CriterionRow({
  ckey, label, tag, state, icon: Icon, accent, bgSoft, onSetManual,
}: {
  ckey: keyof QualQualification["criteria"];
  label: string;
  tag: string;
  state: CriterionState | undefined;
  icon: typeof Target;
  accent: string;
  bgSoft: string;
  onSetManual?: (key: keyof QualQualification["criteria"], qualified: boolean, reason: string) => Promise<void> | void;
}) {
  const qualified = state?.status === "qualified";
  const isManual = !!state?.manual;
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(isManual ? (state?.summary || state?.evidence || "") : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSetManual) return;
    if (!reason.trim()) {
      toast.error("Descreva o motivo da qualificação");
      return;
    }
    setSaving(true);
    try {
      await onSetManual(ckey, true, reason.trim());
      toast.success(`${label} qualificado manualmente`);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveManual = async () => {
    if (!onSetManual) return;
    setSaving(true);
    try {
      await onSetManual(ckey, false, "");
      setReason("");
      toast.success("Qualificação manual removida");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-2.5 transition-colors overflow-hidden",
        qualified
          ? "border-emerald-500/30"
          : "border-border hover:border-primary/30",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-0.5",
          qualified ? "bg-emerald-500" : "bg-transparent",
        )}
      />
      <div className="flex items-start gap-2.5 pl-1">
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
            qualified ? "bg-emerald-500 text-white" : cn(bgSoft, accent),
          )}
        >
          {qualified ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold text-foreground leading-tight">{label}</h4>
              <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{tag}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isManual && (
                <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  <UserCog className="w-2.5 h-2.5" />
                  Manual
                </span>
              )}
              <span
                className={cn(
                  "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                  qualified
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {qualified ? "OK" : "—"}
              </span>
            </div>
          </div>
          {state?.summary && !editing && (
            <p className="text-[11.5px] text-foreground/80 mt-1.5 leading-snug">{state.summary}</p>
          )}
          {state?.evidence && !editing && (
            <p className="text-[11px] text-muted-foreground mt-1 italic border-l-2 border-emerald-500/40 pl-2 leading-snug">
              "{state.evidence}"
            </p>
          )}

          {onSetManual && !editing && (
            <div className="mt-2 flex items-center gap-2">
              {!qualified ? (
                <label className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground cursor-pointer hover:text-foreground">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => setEditing(true)}
                    className="h-3 w-3"
                  />
                  Qualificar manualmente
                </label>
              ) : isManual ? (
                <>
                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10.5px]" onClick={() => setEditing(true)}>
                    <Pencil className="w-2.5 h-2.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10.5px] text-destructive hover:text-destructive"
                    onClick={handleRemoveManual}
                    disabled={saving}
                  >
                    <X className="w-2.5 h-2.5 mr-1" /> Remover
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {editing && (
            <div className="mt-2 space-y-1.5">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da qualificação"
                className="text-xs min-h-[52px]"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-6 text-[11px] px-2" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                  Qualificar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QualAIPanel({ conversation, qualification, analyzing, onReanalyze, onSetDisqualified, onSetCriterionManual, expanded, showHistory, onToggleHistory }: Props) {
  const { isAdmin } = useAuth();
  const [showHandoff, setShowHandoff] = useState(false);
  const [showDisq, setShowDisq] = useState(false);
  const score = qualification?.score ?? 0;
  const disqualified = !!qualification?.disqualified;
  const temp = temperatureFromScore(score, disqualified);
  const rank = rankFromScore(score);
  const asideWidthCls = expanded ? "flex-1 min-w-0" : "w-[360px]";

  if (!conversation) {
    return (
      <aside className={cn(asideWidthCls, "border-l border-border bg-card flex items-center justify-center")}>
        <p className="text-xs text-muted-foreground">Selecione uma conversa</p>
      </aside>
    );
  }

  const lead = qualification?.lead_data || {};

  const handoffText = () => {
    const now = new Date();
    const c = qualification?.criteria;
    const line = (label: string, s: CriterionState | undefined) =>
      s?.status === "qualified"
        ? `✔ ${label}\n   ${s.summary || s.evidence || ""}`
        : `○ ${label}  (pendente)`;
    return `PASSAGEM DE BASTÃO — QUALIFICAÇÃO CBMAQ

Data: ${now.toLocaleDateString("pt-BR")}
Hora: ${now.toLocaleTimeString("pt-BR")}

Nome:     ${lead.nome || conversation.contact_name || "—"}
Empresa:  ${lead.empresa || "—"}
Telefone: ${conversation.phone}
Cidade:   ${lead.cidade || "—"}  ${lead.uf ? `/ ${lead.uf}` : ""}
CPF/CNPJ: ${lead.cnpj || lead.cpf || "—"}

Score: ${score}/4  —  ${rank.label}

QUALIFICAÇÃO
${line("Necessidade", c?.necessidade)}
${line("Decisor", c?.decisor)}
${line("Prazo", c?.prazo)}
${line("Capacidade Financeira", c?.capacidade)}

RESUMO GERAL
${qualification?.ai_summary || "—"}

Próximo passo recomendado:
${score >= 4 ? "Enviar proposta comercial e encaminhar para vendedor." : score === 3 ? "Manter follow-up próximo e completar qualificação." : "Nutrir lead até critérios mínimos."}`;
  };

  const copyHandoff = () => {
    navigator.clipboard.writeText(handoffText());
    toast.success("Passagem de bastão copiada");
  };

  return (
    <>
      <aside className={cn(asideWidthCls, "border-l border-border bg-card flex flex-col")}>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold leading-none">
                  Qualificação
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums leading-none">{score}</span>
                  <span className="text-sm text-muted-foreground leading-none">/4</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border w-fit",
                  temp.className,
                )}>
                  {temp.key === "quente" && <Flame className="w-2.5 h-2.5" />}
                  {temp.key === "morno" && <Thermometer className="w-2.5 h-2.5" />}
                  {temp.key === "frio" && <Snowflake className="w-2.5 h-2.5" />}
                  {temp.key === "disq" && <Ban className="w-2.5 h-2.5" />}
                  {temp.label}
                </span>
                {!disqualified && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9.5px] uppercase tracking-wider font-semibold border px-1.5 py-0 h-auto w-fit",
                      rank.tone === "success" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                      rank.tone === "info" && "border-blue-500/40 text-blue-700 dark:text-blue-400",
                      rank.tone === "warning" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
                      rank.tone === "destructive" && "border-destructive/40 text-destructive",
                    )}
                  >
                    {rank.label}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onToggleHistory && isAdmin && (
                <Button
                  variant={showHistory ? "secondary" : "outline"}
                  size="sm"
                  onClick={onToggleHistory}
                  className="h-7 text-[11px] gap-1 px-2"
                  title="Histórico é privado — exiba apenas para leitura quando necessário"
                >
                  {showHistory ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showHistory ? "Ocultar" : "Histórico"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onReanalyze}
                disabled={analyzing || disqualified}
                title={disqualified ? "Lead desqualificado" : "Reanalisar agora"}
                className="h-7 w-7"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-3 space-y-3.5">
            {/* Resumo IA */}
            <section>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <h4 className="text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Resumo da IA
                </h4>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[11.5px] leading-snug text-foreground/90 whitespace-pre-wrap">
                {qualification?.ai_summary ||
                  (analyzing ? "Analisando..." : "Aguardando mensagens para gerar resumo.")}
              </div>
            </section>

            {/* Dados do lead */}
            {(lead.empresa || lead.cidade || lead.segmento) && (
              <section>
                <h4 className="text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">
                  Dados do Lead
                </h4>
                <div className="rounded-md border border-border bg-card p-2.5 space-y-1 text-[11.5px]">
                  {lead.empresa && <Row label="Empresa" value={lead.empresa} />}
                  {(lead.cidade || lead.uf) && <Row label="Localização" value={`${lead.cidade || ""}${lead.uf ? " / " + lead.uf : ""}`} />}
                  {lead.segmento && <Row label="Segmento" value={lead.segmento} />}
                  {(lead.cnpj || lead.cpf) && <Row label="Documento" value={lead.cnpj || lead.cpf || ""} />}
                </div>
              </section>
            )}

            {/* Critérios */}
            <section>
              <h4 className="text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">
                Critérios
              </h4>
              <div className="space-y-1.5">
                {CRITERIA.map((c) => (
                  <CriterionRow
                    key={c.key}
                    ckey={c.key}
                    label={c.label}
                    tag={c.tag}
                    icon={c.icon}
                    accent={c.accent}
                    bgSoft={c.bgSoft}
                    state={qualification?.criteria[c.key]}
                    onSetManual={onSetCriterionManual}
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="border-t border-border px-3 py-2.5 flex gap-2">
          <Button onClick={() => setShowHandoff(true)} className="flex-1 h-9" variant="default" disabled={disqualified} size="sm">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Passagem de Bastão
          </Button>
          {disqualified ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={async () => {
                await onSetDisqualified(false);
                toast.success("Lead reativado para qualificação");
              }}
              title="Reativar qualificação"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowDisq(true)}
              title="Não qualificar lead"
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </aside>


      <Dialog open={showHandoff} onOpenChange={setShowHandoff}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Passagem de Bastão</DialogTitle>
          </DialogHeader>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg border border-border max-h-[60vh] overflow-y-auto">
            {handoffText()}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowHandoff(false)}>
              Fechar
            </Button>
            <Button onClick={copyHandoff}>Copiar texto</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisq} onOpenChange={setShowDisq}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Não qualificar este lead?</DialogTitle>
            <DialogDescription>
              A IA deixará de analisar a conversa automaticamente e o lead será marcado como
              desqualificado. Você pode reativar depois se mudar de ideia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisq(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onSetDisqualified(true);
                setShowDisq(false);
                toast.success("Lead marcado como não qualificado");
              }}
            >
              <Ban className="w-4 h-4 mr-2" />
              Não qualificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 font-medium text-right">{value}</span>
    </div>
  );
}

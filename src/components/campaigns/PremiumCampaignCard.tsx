import { Trash2, RefreshCw, Loader2, MessageSquareText, Rocket, Activity, TrendingUp, Users2 } from "lucide-react";
import DailySendChart from "./DailySendChart";
import type { DailyPoint } from "@/hooks/useMassCampaignDaily";

type Campaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  replied_count: number;
  message_template?: string | null;
};

const statusBadge: Record<string, { label: string; cls: string; dot?: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground border border-border" },
  sending: { label: "Enviando", cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500 animate-pulse" },
  paused: { label: "Pausada", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  completed: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  active: { label: "Ativa", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500 animate-pulse" },
  cancelled: { label: "Cancelada", cls: "bg-destructive/10 text-destructive border border-destructive/20" },
};

function Gauge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * c;
  const color = pct >= 90 ? "text-emerald-500" : pct >= 60 ? "text-primary" : pct >= 30 ? "text-amber-500" : "text-destructive";
  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg viewBox="0 0 100 100" className={`w-28 h-28 -rotate-90 ${color}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground leading-none">{value.toFixed(0)}%</span>
        {sub && <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{sub}</span>}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="relative h-5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(pct, 8)}%` }}
        >
          <span className="text-[10px] font-bold text-white drop-shadow">{value.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export default function PremiumCampaignCard({
  campaign: c,
  daily,
  handoff,
  refreshing,
  onClick,
  onDelete,
  onRefresh,
}: {
  campaign: Campaign;
  daily: DailyPoint[];
  handoff: number;
  refreshing: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const sb = statusBadge[c.status] || statusBadge.draft;
  const sent = c.sent_count || 0;
  const failed = c.failed_count || 0;
  const replied = c.replied_count || 0;
  const total = c.total_leads || 0;
  const processed = sent + failed;
  const progress = total > 0 ? (processed / total) * 100 : 0;
  const deliveryRate = processed > 0 ? (sent / processed) * 100 : 0;
  const responseRate = sent > 0 ? (replied / sent) * 100 : 0;
  const usefulRate = replied > 0 ? Math.min(100, (handoff / replied) * 100 * 0.7) : 0;
  const handoffRate = replied > 0 ? (handoff / replied) * 100 : 0;
  const pending = Math.max(total - processed, 0);
  const messagePreview = c.message_template || "";

  return (
    <div
      onClick={onClick}
      className="group bg-card border border-border rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden flex flex-col"
    >
      <div className="p-5 space-y-4 flex-1">
        {/* Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-foreground truncate">{c.name}</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${sb.cls}`}>
                {sb.dot && <span className={`w-1.5 h-1.5 rounded-full ${sb.dot}`} />}
                <Activity className="w-3 h-3" />
                {sb.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              {" • "}{total} leads{" • "}<span className="text-primary font-semibold">{(c as any).channel === "meta_template" ? ((c as any).meta_template_name || "Meta Template") : ((c as any).evolution_instance || "COMERCIAL_THEO")}</span>
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Bento grid top: 3 cards (Envio | Taxa Entrega | Funil) */}
        <div className="grid grid-cols-3 gap-3">
          {/* Envio da campanha */}
          <div className="bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/60 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Envio da Campanha</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-primary via-primary to-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              <Rocket className="w-3.5 h-3.5 text-primary absolute -top-1.5" style={{ left: `calc(${Math.min(95, progress)}% - 6px)` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-medium">
              <span>0</span><span>100%</span>
            </div>
            <div className="mt-auto pt-3">
              <p className="text-2xl font-bold text-foreground leading-none">
                {sent} <span className="text-base text-muted-foreground font-normal">/ {total}</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Entregues</p>
            </div>
          </div>

          {/* Taxa de entrega gauge */}
          <div className="bg-gradient-to-br from-emerald-50 to-secondary/30 dark:from-emerald-500/10 dark:to-secondary/30 border border-border/60 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground self-start">Taxa de Entrega</span>
            <div className="flex-1 flex items-center justify-center my-1">
              <Gauge value={deliveryRate} label="entrega" sub={failed === 0 ? "Sem falhas" : `${failed} falha${failed > 1 ? "s" : ""}`} />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${deliveryRate >= 90 ? "bg-emerald-100 text-emerald-700" : deliveryRate >= 60 ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
              {deliveryRate >= 90 ? "SCORE ALTO" : deliveryRate >= 60 ? "SCORE BOM" : "ATENÇÃO"}
            </span>
          </div>

          {/* Taxa de resposta gauge */}
          <div className="bg-gradient-to-br from-primary/5 to-secondary/30 border border-border/60 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground self-start">Taxa de Resposta</span>
            <div className="flex-1 flex items-center justify-center my-1">
              <Gauge value={responseRate} label="resposta" sub={`${replied} resposta${replied !== 1 ? "s" : ""}`} />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${responseRate >= 50 ? "bg-emerald-100 text-emerald-700" : responseRate >= 20 ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
              {responseRate >= 50 ? "ENGAJAMENTO ALTO" : responseRate >= 20 ? "ENGAJAMENTO MÉDIO" : "BAIXO"}
            </span>
          </div>
        </div>

        {/* Bottom grid: message + chart + handoff */}
        <div className="grid grid-cols-3 gap-3">
          {/* Message preview spans 2 */}
          {messagePreview && (
            <div className="col-span-2 bg-primary/5 p-3 rounded-2xl border border-primary/10 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-primary/70 shrink-0" />
              <p className="text-[11px] text-foreground/70 italic truncate">"{messagePreview}"</p>
            </div>
          )}
          {!messagePreview && <div className="col-span-2" />}

          {/* Passagem do bastão */}
          <div className="row-span-2 bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/60 rounded-2xl p-3 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Passagem do Bastão</span>
            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
              <div className="relative">
                <Users2 className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-foreground leading-none">{handoff}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {handoff === 1 ? "lead transferido" : "leads transferidos"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-1 pt-1 border-t border-border/60">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-semibold text-foreground">{handoffRate.toFixed(0)}% conv.</span>
            </div>
          </div>

          {/* Chart spans 2 */}
          <div className="col-span-2">
            <DailySendChart data={daily} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-secondary/30 px-5 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          {pending > 0 ? `${pending} pendentes` : `${progress.toFixed(0)}% concluído`}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          disabled={refreshing || sent === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          title="Consulta a Evolution e verifica quais números responderam"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar Respostas
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { ArrowLeft, Play, Pause, Send, Loader2, Search, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMassLeads, type MassCampaign } from "@/hooks/useMassCampaigns";

interface Props {
  campaign: MassCampaign;
  onClose: () => void;
  onRefresh: () => void;
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-secondary text-muted-foreground" },
  sent: { label: "Enviado", cls: "bg-success/10 text-success" },
  failed: { label: "Falha", cls: "bg-destructive/10 text-destructive" },
  replied: { label: "Respondeu", cls: "bg-info/10 text-info" },
  optout: { label: "Opt-out", cls: "bg-warning/10 text-warning" },
};

export default function MetaTemplateCampaignDetailDrawer({ campaign, onClose, onRefresh }: Props) {
  const { leads, loading, refetch } = useMassLeads(campaign.id);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (l.nome || "").toLowerCase().includes(q)
        || (l.empresa || "").toLowerCase().includes(q)
        || (l.telefone || "").includes(q);
    });
  }, [leads, filter, search]);

  const invokeAction = async (action: string, extra: any = {}) => {
    return await supabase.functions.invoke("send-meta-mass-campaign", {
      body: { campaignId: campaign.id, action, ...extra },
    });
  };

  const handleSendAll = async () => {
    if (!confirm(`Disparar via template ${campaign.meta_template_name} para todos os leads pendentes?`)) return;
    setSending(true);
    try {
      const { data, error } = await invokeAction("send_batch");
      if (error) throw error;
      toast.success(`${data.sent} enviados · ${data.failed} falhas${data.pendingLeft ? ` · ${data.pendingLeft} restantes` : ""}`);
      refetch(); onRefresh();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSending(false); }
  };

  const handlePause = async () => {
    await invokeAction("pause"); toast.success("Pausada"); onRefresh();
  };

  const handleSendOne = async (leadId: string) => {
    setSendingOne(leadId);
    try {
      const { data, error } = await invokeAction("send_one", { leadId });
      if (error) throw error;
      if (data?.ok) toast.success("Enviado"); else toast.error(data?.reason || "Falha");
      refetch(); onRefresh();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSendingOne(null); }
  };

  const handleRetryFailed = async () => {
    if (!confirm("Reenviar todos os leads com falha?")) return;
    setRetrying(true);
    try {
      const { data, error } = await invokeAction("retry_failed");
      if (error) throw error;
      toast.success(`${data.sent} reenviados · ${data.failed} falhas`);
      refetch(); onRefresh();
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setRetrying(false); }
  };

  const counts = leads.reduce<Record<string, number>>((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});
  const isSending = campaign.status === "sending";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {isSending ? (
            <button onClick={handlePause} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary">
              <Pause className="w-4 h-4" /> Pausar
            </button>
          ) : (
            <button onClick={handleSendAll} disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Disparar pendentes
            </button>
          )}
          {(counts.failed || 0) > 0 && (
            <button onClick={handleRetryFailed} disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary disabled:opacity-50">
              {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />} Reenviar falhas
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
        <h2 className="text-xl font-bold">{campaign.name}</h2>
        <p className="text-xs text-muted-foreground">
          Template: <span className="font-mono text-foreground">{campaign.meta_template_name}</span> · {campaign.meta_template_language} · Segmento: {campaign.segment} · Throttle: {campaign.throttle_ms}ms
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {["pending", "sent", "failed", "replied"].map((s) => (
            <span key={s} className={`text-xs px-2 py-1 rounded-full ${statusLabel[s].cls}`}>
              {statusLabel[s].label}: <strong>{counts[s] || 0}</strong>
            </span>
          ))}
          {(() => {
            const sent = (counts.sent || 0) + (counts.replied || 0);
            const rate = sent > 0 ? ((counts.replied || 0) / sent) * 100 : 0;
            return (
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Taxa de resposta: <strong>{rate.toFixed(1)}%</strong>
              </span>
            );
          })()}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, empresa ou telefone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="sent">Enviados</option>
          <option value="failed">Falhas</option>
          <option value="replied">Respondeu</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum lead</p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/60 backdrop-blur">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-muted-foreground">Telefone</th>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const s = statusLabel[l.status] || statusLabel.pending;
                  return (
                    <tr key={l.id} className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="px-4 py-2">{l.nome || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{l.empresa || "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{l.telefone}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                        {l.error_message && <p className="text-[10px] text-destructive truncate max-w-[240px] mt-0.5" title={l.error_message}>{l.error_message}</p>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(l.status === "pending" || l.status === "failed") && (
                          <button onClick={() => handleSendOne(l.id)} disabled={sendingOne === l.id}
                            className="p-1.5 rounded hover:bg-primary/10 text-primary disabled:opacity-50" title="Enviar este lead">
                            {sendingOne === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        )}
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
}

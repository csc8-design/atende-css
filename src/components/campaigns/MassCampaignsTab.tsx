import { useState } from "react";
import { Plus, Send, Users, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useMassCampaigns } from "@/hooks/useMassCampaigns";
import { useMassCampaignHandoffs } from "@/hooks/useMassCampaignHandoffs";
import { useMassCampaignDaily } from "@/hooks/useMassCampaignDaily";
import PremiumCampaignCard from "./PremiumCampaignCard";
import MassCampaignCreateModal from "./MassCampaignCreateModal";
import MassCampaignDetailDrawer from "./MassCampaignDetailDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const kpiStyles = [
  { bg: "bg-blue-50 dark:bg-blue-500/10", fg: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-indigo-50 dark:bg-indigo-500/10", fg: "text-indigo-600 dark:text-indigo-400" },
  { bg: "bg-red-50 dark:bg-red-500/10", fg: "text-red-600 dark:text-red-400" },
  { bg: "bg-primary/10", fg: "text-primary" },
];

export default function MassCampaignsTab() {
  const { campaigns, loading, refetch } = useMassCampaigns("evolution");
  const { counts: handoffCounts } = useMassCampaignHandoffs();
  const { series: dailySeries } = useMassCampaignDaily(7);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const grouped = campaigns.reduce<Record<string, typeof campaigns>>((acc, c) => {
    (acc[c.segment] ||= []).push(c);
    return acc;
  }, {});

  const totalLeads = campaigns.reduce((s, c) => s + c.total_leads, 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);
  const totalFailed = campaigns.reduce((s, c) => s + c.failed_count, 0);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir campanha e todos os leads dela?")) return;
    const { error } = await supabase.from("mass_campaigns").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Campanha excluída"); refetch(); }
  };

  const handleRefreshResponses = async (id: string) => {
    setRefreshingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("check-mass-campaign-responses", {
        body: { campaignId: id },
      });
      if (error) throw error;
      toast.success(`Verificado: ${data.checked} envios · ${data.total_replied} respostas${data.replied > 0 ? ` (+${data.replied} novas)` : ""}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar respostas");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAllResponses = async () => {
    setRefreshingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-mass-campaign-responses", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Análise concluída: ${data.campaigns} campanhas · ${data.checked} envios · ${data.total_replied} respostas${data.replied > 0 ? ` (+${data.replied} novas)` : ""}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao analisar respostas");
    } finally {
      setRefreshingAll(false);
    }
  };

  const detailCampaign = campaigns.find((c) => c.id === detailId);

  const kpis = [
    { icon: Users, label: "Total de Leads", value: totalLeads.toLocaleString() },
    { icon: Send, label: "Enviados", value: totalSent.toLocaleString() },
    { icon: AlertCircle, label: "Falhas", value: totalFailed.toLocaleString() },
    { icon: CheckCircle2, label: "Campanhas", value: String(campaigns.length) },
  ];

  if (detailCampaign) {
    return <MassCampaignDetailDrawer campaign={detailCampaign} onClose={() => setDetailId(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Disparo em Massa (Evolution)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Variáveis dinâmicas: Nome, Empresa, Modelo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAllResponses}
            disabled={refreshingAll || campaigns.length === 0}
            className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary transition-all disabled:opacity-50"
            title="Analisa todas as campanhas e cruza respostas pela Evolution"
          >
            {refreshingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Analisar respostas
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((s, i) => {
          const st = kpiStyles[i];
          return (
            <div key={s.label} className="bg-card p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-xl ${st.bg} ${st.fg}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold text-foreground leading-tight">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grouped list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha de disparo em massa</p>
          <p className="text-xs text-muted-foreground mt-1">Crie sua primeira campanha enviando uma planilha de leads</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([seg, list]) => (
            <div key={seg} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold rounded-full uppercase tracking-wide">{seg}</span>
                <span className="text-muted-foreground font-medium text-sm">{list.length} {list.length === 1 ? "campanha" : "campanhas"}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {list.map((c) => (
                  <PremiumCampaignCard
                    key={c.id}
                    campaign={c as any}
                    daily={dailySeries[c.id] || []}
                    handoff={handoffCounts[c.id] || 0}
                    refreshing={refreshingId === c.id}
                    onClick={() => setDetailId(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRefresh={() => handleRefreshResponses(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <MassCampaignCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />
    </div>
  );
}

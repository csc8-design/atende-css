import { useState } from "react";
import { Plus, Send, Users, CheckCircle2, AlertCircle, Loader2, MessageCircleReply, RefreshCw } from "lucide-react";
import { useMassCampaigns } from "@/hooks/useMassCampaigns";
import { useMassCampaignHandoffs } from "@/hooks/useMassCampaignHandoffs";
import { useMassCampaignDaily } from "@/hooks/useMassCampaignDaily";
import PremiumCampaignCard from "./PremiumCampaignCard";
import MetaTemplateCampaignCreateModal from "./MetaTemplateCampaignCreateModal";
import MetaTemplateCampaignDetailDrawer from "./MetaTemplateCampaignDetailDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const kpiStyles = [
  { bg: "bg-blue-50 dark:bg-blue-500/10", fg: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-indigo-50 dark:bg-indigo-500/10", fg: "text-indigo-600 dark:text-indigo-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-red-50 dark:bg-red-500/10", fg: "text-red-600 dark:text-red-400" },
  { bg: "bg-primary/10", fg: "text-primary" },
];

export default function MetaTemplateCampaignsTab() {
  const { campaigns, loading, refetch } = useMassCampaigns("meta_template");
  const { counts: handoffCounts } = useMassCampaignHandoffs();
  const { series: dailySeries } = useMassCampaignDaily(7);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const totalLeads = campaigns.reduce((s, c) => s + c.total_leads, 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);
  const totalFailed = campaigns.reduce((s, c) => s + c.failed_count, 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.replied_count || 0), 0);
  const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

  const grouped = campaigns.reduce<Record<string, typeof campaigns>>((acc, c) => {
    const key = c.meta_template_name || "sem template";
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir campanha e todos os leads dela?")) return;
    const { error } = await supabase.from("mass_campaigns").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Campanha excluída"); refetch(); }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-meta-campaign-responses", { body: {} });
      if (error) throw error;
      toast.success(`${data?.new_replies ?? 0} nova(s) resposta(s) detectada(s) em ${data?.campaigns ?? 0} campanha(s)`);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao reanalisar respostas");
    } finally {
      setReanalyzing(false);
    }
  };

  const detailCampaign = campaigns.find((c) => c.id === detailId);

  const kpis = [
    { icon: Users, label: "Total de Leads", value: totalLeads.toLocaleString() },
    { icon: Send, label: "Enviados", value: totalSent.toLocaleString() },
    { icon: MessageCircleReply, label: "Taxa de Resposta", value: `${replyRate.toFixed(1)}%`, sub: `${totalReplied.toLocaleString()} respostas` },
    { icon: AlertCircle, label: "Falhas", value: totalFailed.toLocaleString() },
    { icon: CheckCircle2, label: "Campanhas", value: String(campaigns.length) },
  ];

  if (detailCampaign) {
    return <MetaTemplateCampaignDetailDrawer campaign={detailCampaign as any} onClose={() => setDetailId(null)} onRefresh={refetch} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Templates Meta (API Oficial)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Disparo via templates aprovados pela Meta — respeita rate limit e opt-in</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reanalisar respostas
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                {(s as any).sub && <p className="text-[10px] text-muted-foreground mt-0.5">{(s as any).sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha de template Meta</p>
          <p className="text-xs text-muted-foreground mt-1">Crie sua primeira campanha selecionando um template aprovado e enviando a planilha</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([tpl, list]) => (
            <div key={tpl} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold rounded-full uppercase tracking-wide">{tpl}</span>
                <span className="text-muted-foreground font-medium text-sm">{list.length} {list.length === 1 ? "campanha" : "campanhas"}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {list.map((c) => (
                  <PremiumCampaignCard
                    key={c.id}
                    campaign={c as any}
                    daily={dailySeries[c.id] || []}
                    handoff={handoffCounts[c.id] || 0}
                    refreshing={false}
                    onClick={() => setDetailId(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRefresh={() => refetch()}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <MetaTemplateCampaignCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />
    </div>
  );
}

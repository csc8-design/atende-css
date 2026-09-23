import { useState, useMemo, useRef, useEffect } from "react";
import { X, Send, Play, Pause, StopCircle, Loader2, Search, Download, Pencil, Image as ImageIcon, Paperclip, RotateCw, Wifi, WifiOff, ArrowLeft, Check, CheckCheck, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMassLeads, type MassCampaign } from "@/hooks/useMassCampaigns";

interface Props {
  campaign: MassCampaign;
  onClose: () => void;
}



const statusLabel: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-secondary text-muted-foreground" },
  sent: { label: "Enviado", cls: "bg-success/10 text-success" },
  failed: { label: "Falha", cls: "bg-destructive/10 text-destructive" },
  replied: { label: "Respondeu", cls: "bg-info/10 text-info" },
  optout: { label: "Opt-out", cls: "bg-warning/10 text-warning" },
};

export default function MassCampaignDetailDrawer({ campaign, onClose }: Props) {
  const { leads, loading } = useMassLeads(campaign.id);
  const [view, setView] = useState<"leads" | "followup">("leads");
  const [filter, setFilter] = useState<string>("all");
  const [followBucket, setFollowBucket] = useState<"all" | "d3" | "d7" | "d14">("all");
  const [search, setSearch] = useState("");
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState(campaign.message_template || "");
  const [composeMode, setComposeMode] = useState<"edit" | "send_all" | "send_one">("edit");
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(campaign.media_url || null);
  const [mediaType, setMediaType] = useState<string | null>(campaign.media_type || null);
  const [mediaMime, setMediaMime] = useState<string | null>(campaign.media_mime || null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [instanceState, setInstanceState] = useState<string>("checking");
  const [checkingState, setCheckingState] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [evolutionInstance, setEvolutionInstance] = useState<string>(campaign.evolution_instance || "COMERCIAL_THEO");
  const [savingInstance, setSavingInstance] = useState(false);
  const [detailLead, setDetailLead] = useState<any | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  const toggleManualReplied = async (lead: any, next: boolean) => {
    setSavingDetail(true);
    try {
      const patch: any = {
        manual_replied: next,
      };
      if (next) {
        patch.status = "replied";
        patch.replied_at = lead.replied_at || new Date().toISOString();
      } else if (lead.status === "replied" && !lead.replied_at) {
        // se estava só marcado manual e não teve resposta real, volta pra sent
        patch.status = lead.sent_at ? "sent" : "pending";
      }
      const { error } = await supabase
        .from("mass_campaign_leads")
        .update(patch)
        .eq("id", lead.id);
      if (error) throw error;
      setDetailLead({ ...lead, ...patch });
      await refreshCampaignCounters();
      toast.success(next ? "Marcado como respondido" : "Desmarcado");
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSavingDetail(false);
    }
  };

  const toggleManualHandoff = async (lead: any, next: boolean) => {
    setSavingDetail(true);
    try {
      const patch: any = {
        manual_handoff: next,
        manual_handoff_at: next ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from("mass_campaign_leads")
        .update(patch)
        .eq("id", lead.id);
      if (error) throw error;
      setDetailLead({ ...lead, ...patch });
      toast.success(next ? "Passagem de bastão registrada" : "Passagem de bastão removida");
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSavingDetail(false);
    }
  };

  const fetchInstanceState = async () => {
    setCheckingState(true);
    try {
      const { data } = await supabase.functions.invoke("send-mass-campaign", {
        body: { action: "instance_status", campaignId: campaign.id },
      });
      setInstanceState(data?.state || "unknown");
    } catch {
      setInstanceState("unknown");
    } finally {
      setCheckingState(false);
    }
  };

  useEffect(() => {
    fetchInstanceState();
    const t = setInterval(fetchInstanceState, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, evolutionInstance]);

  const handleChangeInstance = async (next: string) => {
    setEvolutionInstance(next);
    setSavingInstance(true);
    try {
      const { error } = await supabase
        .from("mass_campaigns")
        .update({ evolution_instance: next } as any)
        .eq("id", campaign.id);
      if (error) throw error;
      (campaign as any).evolution_instance = next;
      toast.success(`Chip alterado para ${next}`);
      fetchInstanceState();
    } catch (err: any) {
      toast.error(err.message || "Erro ao trocar chip");
    } finally {
      setSavingInstance(false);
    }
  };

  const runRetryFailed = async () => {
    if (counts.failed === 0) return toast.error("Nenhuma falha para reenviar");
    if (!confirm(`Reenviar ${counts.failed} leads que falharam?`)) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-mass-campaign", {
        body: { action: "retry_failed", campaignId: campaign.id },
      });
      if (error) throw error;
      toast.success(`Reenvio: ${data.sent} enviados, ${data.failed} falhas`);
    } catch (err: any) {
      toast.error(err.message || "Erro no reenvio");
    } finally {
      setRetrying(false);
    }
  };


  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.nome || "").toLowerCase().includes(q) ||
          (l.empresa || "").toLowerCase().includes(q) ||
          (l.telefone || "").includes(q) ||
          (l.modelo || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, pending: 0, sent: 0, failed: 0, replied: 0, optout: 0 };
    leads.forEach((l) => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leads]);

  // ===== Follow-up: leads sem resposta, agrupados por dias desde o PRIMEIRO envio =====
  const followupLeads = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    return leads
      .filter((l) => l.status === "sent")
      .map((l) => {
        const firstSent = (l as any).first_sent_at || l.sent_at;
        if (!firstSent) return { ...l, _days: 0, _bucket: null as any, _firstSent: null };
        const days = Math.floor((now - new Date(firstSent as string).getTime()) / DAY);
        let bucket: "d3" | "d7" | "d14" | null = null;
        if (days >= 14) bucket = "d14";
        else if (days >= 7) bucket = "d7";
        else if (days >= 3) bucket = "d3";
        return { ...l, _days: days, _bucket: bucket, _firstSent: firstSent };
      })
      .filter((l) => l._bucket !== null)
      .sort((a, b) => (b._days || 0) - (a._days || 0));
  }, [leads]);

  const followCounts = useMemo(() => {
    const c = { all: followupLeads.length, d3: 0, d7: 0, d14: 0 };
    followupLeads.forEach((l) => { if (l._bucket) c[l._bucket]++; });
    return c;
  }, [followupLeads]);

  const filteredFollowup = useMemo(() => {
    return followupLeads.filter((l) => {
      if (followBucket !== "all" && l._bucket !== followBucket) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.nome || "").toLowerCase().includes(q) ||
          (l.empresa || "").toLowerCase().includes(q) ||
          (l.telefone || "").includes(q) ||
          (l.modelo || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [followupLeads, followBucket, search]);

  const handleResendFollowup = async (lead: any, channel: "api" | "waweb") => {
    if (channel === "waweb") {
      await handleSendWaWeb(lead);
      return;
    }
    // Via Evolution API: mantém o lead em "sent" (preserva first_sent_at via trigger)
    // para que continue evoluindo entre os buckets D+3 → D+7 → D+14 como uma esteira.
    try {
      await runSendOne(lead.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar");
    }
  };



  const openCompose = (mode: "edit" | "send_all" | "send_one", leadId?: string) => {
    setComposeText(campaign.message_template || "");
    setMediaUrl(campaign.media_url || null);
    setMediaType(campaign.media_type || null);
    setMediaMime(campaign.media_mime || null);
    setComposeMode(mode);
    setComposeLeadId(leadId || null);
    setComposeOpen(true);
  };


  const runSendAll = async () => {
    if (counts.pending === 0) return toast.error("Nenhum lead pendente");
    if (!confirm(`Iniciar disparo de ${counts.pending} leads? Intervalo: ${campaign.throttle_ms}ms`)) return;
    setSendingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-mass-campaign", {
        body: { action: "send_batch", campaignId: campaign.id },
      });
      if (error) throw error;
      toast.success(`Lote concluído: ${data.sent} enviados, ${data.failed} falhas${data.pendingLeft ? `, ${data.pendingLeft} restantes` : ""}`);
    } catch (err: any) {
      toast.error(err.message || "Erro no disparo");
    } finally {
      setSendingAll(false);
    }
  };

  const runSendOne = async (leadId: string) => {
    setSendingOne(leadId);
    try {
      const { data, error } = await supabase.functions.invoke("send-mass-campaign", {
        body: { action: "send_one", campaignId: campaign.id, leadId },
      });
      if (error) throw error;
      if (data.ok) toast.success("Mensagem enviada");
      else toast.error(data.reason || "Falha no envio");
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSendingOne(null);
    }
  };

  const hasContent = () => !!(campaign.message_template?.trim() || campaign.media_url);

  const handleSendAll = () => {
    if (!hasContent()) return openCompose("send_all");
    runSendAll();
  };

  const handleSendOne = (leadId: string) => {
    if (!hasContent()) return openCompose("send_one", leadId);
    runSendOne(leadId);
  };

  // Helpers locais — sem chamar API, apenas geram link wa.me
  const firstNameLocal = (name?: string | null, fallback?: string | null) => {
    for (const v of [name, fallback]) {
      const s = (v || "").trim();
      if (!s) continue;
      if (/^[\d\s\/\-.()+]+$/.test(s)) continue;
      const first = s.split(/\s+/).find((p) => p && !/^\d/.test(p));
      if (first) {
        const clean = first.replace(/[^\p{L}\p{M}'-]/gu, "");
        if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      }
    }
    return "Cliente";
  };
  const renderLocal = (tpl: string, lead: any) => {
    const nome = firstNameLocal(lead.nome, lead.empresa);
    const empresa = (lead.empresa || lead.nome || "sua empresa").toString().trim();
    const modelo = (lead.modelo || "").toString().trim();
    const cidade = (lead.cidade || "").toString().trim();
    return (tpl || "")
      .replace(/\{\{\s*nome\s*\}\}/gi, nome)
      .replace(/\{\{\s*empresa\s*\}\}/gi, empresa)
      .replace(/\{\{\s*modelo\s*\}\}/gi, modelo)
      .replace(/\{\{\s*cidade\s*\}\}/gi, cidade);
  };
  const normalizePhoneLocal = (raw: string) => {
    let p = (raw || "").replace(/\D/g, "");
    if (!p) return "";
    if (p.startsWith("55") && p.length > 11) p = p.slice(2);
    if (p.length === 10) p = p.slice(0, 2) + "9" + p.slice(2);
    return "55" + p;
  };

  const handleSendWaWeb = async (lead: any) => {
    const phone = normalizePhoneLocal(lead.telefone_normalizado || lead.telefone);
    if (!phone || phone.length < 12) {
      toast.error("Telefone inválido");
      return;
    }
    const text = renderLocal(campaign.message_template || "", lead);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    // wa.me redireciona para WhatsApp Web no desktop e abre o app no mobile
    window.open(url, "_blank");
    // Marca como enviado para que o monitoramento de resposta via Evolution funcione
    try {
      await supabase
        .from("mass_campaign_leads")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          final_message: text,
          telefone_normalizado: phone,
          error_message: null,
        })
        .eq("id", lead.id);
      await refreshCampaignCounters();
      toast.success("Marcado como enviado");
    } catch (err) {
      console.error("[wa-web] failed to mark sent", err);
    }
  };

  const refreshCampaignCounters = async () => {
    try {
      const { data: rows } = await supabase
        .from("mass_campaign_leads")
        .select("status")
        .eq("campaign_id", campaign.id);
      const total = rows?.length || 0;
      const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
      const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
      const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
      await supabase
        .from("mass_campaigns")
        .update({
          total_leads: total,
          sent_count: sent,
          failed_count: failed,
          replied_count: replied,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      (campaign as any).sent_count = sent;
      (campaign as any).failed_count = failed;
      (campaign as any).replied_count = replied;
      (campaign as any).total_leads = total;
    } catch (err) {
      console.error("[counters] refresh failed", err);
    }
  };





  const handleSaveTemplate = async () => {
    if (!composeText.trim() && !mediaUrl) return toast.error("Escreva a mensagem ou anexe uma mídia");
    setSavingTpl(true);
    try {
      const { error } = await supabase
        .from("mass_campaigns")
        .update({
          message_template: composeText,
          media_url: mediaUrl,
          media_type: mediaType,
          media_mime: mediaMime,
        })
        .eq("id", campaign.id);
      if (error) throw error;
      campaign.message_template = composeText;
      campaign.media_url = mediaUrl;
      campaign.media_type = mediaType;
      campaign.media_mime = mediaMime;
      setComposeOpen(false);
      toast.success("Mensagem salva");
      if (composeMode === "send_all") await runSendAll();
      else if (composeMode === "send_one" && composeLeadId) await runSendOne(composeLeadId);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingTpl(false);
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) return toast.error("Arquivo muito grande (máx 16MB)");
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `mass-campaigns/${campaign.id}/${Date.now()}.${ext}`;
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

  const handleRemoveMedia = () => {
    setMediaUrl(null);
    setMediaType(null);
    setMediaMime(null);
  };




  const handlePause = async () => {
    await supabase.functions.invoke("send-mass-campaign", { body: { action: "pause", campaignId: campaign.id } });
    toast.success("Campanha pausada");
  };

  const handleCancel = async () => {
    if (!confirm("Cancelar campanha? Leads pendentes não serão enviados.")) return;
    await supabase.functions.invoke("send-mass-campaign", { body: { action: "cancel", campaignId: campaign.id } });
    toast.success("Campanha cancelada");
  };

  const handleExport = () => {
    const headers = ["Nome", "Empresa", "Telefone", "Modelo", "Cidade", "UF", "Status", "Enviado em", "Erro"];
    const rows = filtered.map((l) => [
      l.nome || "", l.empresa || "", l.telefone || "", l.modelo || "",
      l.cidade || "", l.uf || "", statusLabel[l.status]?.label || l.status,
      l.sent_at ? new Date(l.sent_at).toLocaleString("pt-BR") : "",
      l.error_message || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${campaign.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-secondary transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div>
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <p className="text-xs text-muted-foreground">Segmento: {campaign.segment} · {campaign.total_leads} leads</p>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Chip:</label>
              <select
                value={evolutionInstance}
                onChange={(e) => handleChangeInstance(e.target.value)}
                disabled={savingInstance}
                className="px-2 py-1 text-xs border border-border rounded-lg bg-background font-medium"
              >
                <option value="COMERCIAL_THEO">COMERCIAL_THEO</option>
                <option value="ENVIO_NOT">ENVIO_NOT</option>
              </select>
            </div>
            <button
              onClick={fetchInstanceState}
              title={`Status do chip Evolution (${evolutionInstance}) — clique para revalidar`}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border ${
                instanceState === "open"
                  ? "bg-success/10 text-success border-success/30"
                  : instanceState === "checking"
                  ? "bg-secondary text-muted-foreground border-border"
                  : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              {checkingState ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : instanceState === "open" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {instanceState === "open"
                ? "Conectado"
                : instanceState === "checking"
                ? "Verificando..."
                : `${instanceState === "close" ? "Desconectado" : instanceState}`}
            </button>
          </div>
        </div>

        {instanceState !== "open" && instanceState !== "checking" && (
          <div className="px-5 py-2 text-xs bg-destructive/10 text-destructive border-b border-destructive/30">
            ⚠️ O chip Evolution <strong>{evolutionInstance}</strong> está <strong>{instanceState}</strong>. Reconecte no painel da Evolution antes de disparar, ou todos os envios retornarão "Connection Closed".
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-secondary/20 flex-wrap">
          <button
            onClick={handleSendAll}
            disabled={sendingAll || counts.pending === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-success text-success-foreground hover:opacity-90 disabled:opacity-50"
          >
            {sendingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Disparar pendentes ({counts.pending})
          </button>
          <button
            onClick={runRetryFailed}
            disabled={retrying || counts.failed === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 disabled:opacity-50"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            Reenviar falhas ({counts.failed})
          </button>
          {campaign.status === "sending" && (
            <button onClick={handlePause} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-warning/10 text-warning border border-warning/30">
              <Pause className="w-4 h-4" /> Pausar
            </button>
          )}
          <button onClick={handleCancel} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-secondary">
            <StopCircle className="w-4 h-4" /> Cancelar
          </button>
          <button onClick={() => openCompose("edit")} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-primary/40 text-primary hover:bg-primary/10 ml-auto">
            <Pencil className="w-4 h-4" /> {campaign.message_template ? "Editar mensagem" : "Escrever mensagem"}
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-secondary">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-border">
          <button
            onClick={() => setView("leads")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              view === "leads"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => { setView("followup"); setSearch(""); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              view === "followup"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Follow-up ({followCounts.all})
          </button>
        </div>

        {view === "leads" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
              {(["all", "pending", "sent", "failed", "replied", "optout"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full border transition ${
                    filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f === "all" ? "Todos" : statusLabel[f].label} ({counts[f] || 0})
                </button>
              ))}
              <div className="relative ml-auto">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome, empresa, telefone..."
                  className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background w-64"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Nenhum lead encontrado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Lead</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Telefone</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Modelo</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => {
                      const sc = statusLabel[l.status] || statusLabel.pending;
                      const isHandoff = (l as any).manual_handoff;
                      const isManualReplied = (l as any).manual_replied;
                      return (
                        <tr
                          key={l.id}
                          onClick={() => setDetailLead(l)}
                          className="border-b border-border/40 hover:bg-secondary/30 cursor-pointer"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate max-w-[240px]">{l.nome || l.empresa || "—"}</p>
                                {l.empresa && l.nome && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[240px]">{l.empresa}</p>
                                )}
                              </div>
                              {isHandoff && (
                                <span title="Passagem de bastão (manual)" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/30">
                                  <Handshake className="w-3 h-3" /> Bastão
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{l.telefone_normalizado || l.telefone}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.modelo || "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sc.cls}`}>{sc.label}</span>
                            {isManualReplied && l.status === "replied" && (
                              <span className="ml-1 text-[10px] text-muted-foreground">(manual)</span>
                            )}
                            {l.error_message && (
                              <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[200px]" title={l.error_message}>
                                {l.error_message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {(l.status === "pending" || l.status === "failed") && (
                                <>
                                  <button
                                    onClick={() => handleSendOne(l.id)}
                                    disabled={sendingOne === l.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                                    title="Enviar via Evolution API"
                                  >
                                    {sendingOne === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Enviar
                                  </button>
                                  <button
                                    onClick={() => handleSendWaWeb(l)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-success/40 text-success hover:bg-success/10"
                                    title="Abrir conversa no WhatsApp (envio manual, não usa API)"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    WhatsApp
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {view === "followup" && (
          <>
            {/* Follow-up summary cards */}
            <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-border bg-secondary/10">
              {([
                { key: "d3" as const, label: "D+3", desc: "3 a 6 dias sem resposta", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                { key: "d7" as const, label: "D+7", desc: "7 a 13 dias sem resposta", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
                { key: "d14" as const, label: "D+14", desc: "14+ dias sem resposta", color: "bg-destructive/10 text-destructive border-destructive/30" },
              ]).map((b) => (
                <button
                  key={b.key}
                  onClick={() => setFollowBucket(b.key)}
                  className={`text-left p-4 rounded-xl border transition ${
                    followBucket === b.key ? b.color + " ring-2 ring-offset-1 ring-offset-background" : "border-border hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{b.label}</span>
                    <span className="text-2xl font-bold text-foreground">{followCounts[b.key]}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{b.desc}</p>
                </button>
              ))}
            </div>

            {/* Follow-up filter bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
              {([
                { k: "all" as const, label: `Todos (${followCounts.all})` },
                { k: "d3" as const, label: `D+3 (${followCounts.d3})` },
                { k: "d7" as const, label: `D+7 (${followCounts.d7})` },
                { k: "d14" as const, label: `D+14 (${followCounts.d14})` },
              ]).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFollowBucket(f.k)}
                  className={`px-3 py-1 text-xs rounded-full border transition ${
                    followBucket === f.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="relative ml-auto">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome, empresa, telefone..."
                  className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background w-64"
                />
              </div>
            </div>

            {/* Follow-up table */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredFollowup.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <p className="text-sm text-muted-foreground">Nenhum lead nessa cadência de follow-up</p>
                  <p className="text-xs text-muted-foreground mt-1">Aparecem aqui leads enviados há 3+ dias que ainda não responderam.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Lead</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Telefone</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Primeiro envio</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Cadência</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFollowup.map((l) => {
                      const bucketCls =
                        l._bucket === "d14" ? "bg-destructive/10 text-destructive border-destructive/30"
                        : l._bucket === "d7" ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-blue-500/10 text-blue-600 border-blue-500/30";
                      const bucketLabel = l._bucket === "d14" ? "D+14" : l._bucket === "d7" ? "D+7" : "D+3";
                      return (
                        <tr key={l.id} className="border-b border-border/40 hover:bg-secondary/30">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-foreground truncate max-w-[260px]">{l.nome || l.empresa || "—"}</p>
                            {l.empresa && l.nome && (
                              <p className="text-xs text-muted-foreground truncate max-w-[260px]">{l.empresa}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{l.telefone_normalizado || l.telefone}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {l._firstSent ? new Date(l._firstSent).toLocaleDateString("pt-BR") : "—"}
                            <span className="block text-[10px]">há {l._days} dias</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${bucketCls}`}>{bucketLabel}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => handleResendFollowup(l, "api")}
                                disabled={sendingOne === l.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
                                title="Reenviar via Evolution API"
                              >
                                {sendingOne === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                                Reenviar
                              </button>
                              <button
                                onClick={() => handleResendFollowup(l, "waweb")}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-success/40 text-success hover:bg-success/10"
                                title="Abrir conversa no WhatsApp"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                WhatsApp Web
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>


      {/* Compose / Edit message modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setComposeOpen(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold">
                {composeMode === "edit" ? "Editar mensagem da campanha" : "Escreva a mensagem antes de enviar"}
              </h3>
              <button onClick={() => setComposeOpen(false)} className="p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                rows={8}
                placeholder="Olá {{nome}}, ..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {["{{nome}}", "{{empresa}}", "{{modelo}}", "{{cidade}}"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setComposeText((t) => t + " " + v)}
                    className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                  >{v}</button>
                ))}
              </div>

              {/* Mídia anexa */}
              <div>
                <input
                  ref={mediaInputRef}
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
                    <button
                      onClick={() => mediaInputRef.current?.click()}
                      className="text-xs text-primary hover:underline"
                    >Trocar</button>
                    <button
                      onClick={handleRemoveMedia}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    ><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border border-dashed border-border rounded-lg hover:bg-secondary/30 disabled:opacity-50"
                  >
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {uploadingMedia ? "Enviando..." : "Anexar foto / vídeo / PDF"}
                  </button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">A mensagem e a mídia ficam salvas na campanha e são reutilizadas nos próximos envios.</p>

            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setComposeOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTpl}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {savingTpl && <Loader2 className="w-4 h-4 animate-spin" />}
                {composeMode === "edit" ? "Salvar" : "Salvar e disparar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead detail modal — marcações manuais */}
      {detailLead && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setDetailLead(null)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <h3 className="text-base font-semibold truncate">{detailLead.nome || detailLead.empresa || "Lead"}</h3>
                <p className="text-xs text-muted-foreground font-mono">{detailLead.telefone_normalizado || detailLead.telefone}</p>
              </div>
              <button onClick={() => setDetailLead(null)} className="p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">{statusLabel[detailLead.status]?.label || detailLead.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Enviado em</p>
                  <p className="font-medium text-foreground">
                    {detailLead.sent_at ? new Date(detailLead.sent_at).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                {detailLead.replied_at && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Respondeu em</p>
                    <p className="font-medium text-foreground">{new Date(detailLead.replied_at).toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">Marcações manuais</p>
                <p className="text-xs text-muted-foreground">
                  O sistema já detecta automaticamente respostas e passagem de bastão. Use as marcações abaixo para casos que precisam ser registrados manualmente.
                </p>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!detailLead.manual_replied || detailLead.status === "replied"}
                    disabled={savingDetail}
                    onChange={(e) => toggleManualReplied(detailLead, e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <CheckCheck className="w-3.5 h-3.5 text-info" /> Marcar como respondido
                    </p>
                    <p className="text-[11px] text-muted-foreground">Conta como lead que respondeu à campanha.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!detailLead.manual_handoff}
                    disabled={savingDetail}
                    onChange={(e) => toggleManualHandoff(detailLead, e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Handshake className="w-3.5 h-3.5 text-success" /> Passagem de bastão realizada
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Conta como lead entregue ao comercial (soma no card "Passagem do Bastão").
                    </p>
                    {detailLead.manual_handoff_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Registrado em {new Date(detailLead.manual_handoff_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setDetailLead(null)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


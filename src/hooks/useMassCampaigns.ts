import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MassCampaign = {
  id: string;
  name: string;
  segment: string;
  message_template: string;
  status: "draft" | "sending" | "paused" | "completed" | "cancelled";
  throttle_ms: number;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  replied_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_mime?: string | null;
  evolution_instance?: string | null;
  channel?: string | null;
  meta_template_name?: string | null;
  meta_template_language?: string | null;
  meta_header_media_url?: string | null;
};


export type MassLead = {
  id: string;
  campaign_id: string;
  nome: string | null;
  empresa: string | null;
  telefone: string;
  telefone_normalizado: string | null;
  modelo: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: string | null;
  segmento: string | null;
  score: number | null;
  prioridade: string | null;
  email: string | null;
  status: "pending" | "sent" | "failed" | "replied" | "optout";
  sent_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  final_message: string | null;
  created_at: string;
};

export function useMassCampaigns(channel: "evolution" | "meta_template" | "all" = "all") {
  const [campaigns, setCampaigns] = useState<MassCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("mass_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (channel !== "all") q = q.eq("channel", channel);
    const { data } = await q;
    setCampaigns((data as any) || []);
    setLoading(false);
  }, [channel]);

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel(`mass_campaigns_changes_${channel}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_campaigns" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch, channel]);

  return { campaigns, loading, refetch };
}

export function useMassLeads(campaignId: string | null) {
  const [leads, setLeads] = useState<MassLead[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!campaignId) {
      setLeads([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("mass_campaign_leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
      .limit(2000);
    setLeads((data as any) || []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    refetch();
    if (!campaignId) return;
    const ch = supabase
      .channel(`mass_leads_${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mass_campaign_leads", filter: `campaign_id=eq.${campaignId}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [campaignId, refetch]);

  return { leads, loading, refetch };
}

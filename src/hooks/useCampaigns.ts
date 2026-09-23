import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  channel: string;
  template_name: string | null;
  template_language: string | null;
  template_category: string | null;
  template_components: any;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  send_rate_per_second: number;
  batch_size: number;
  batch_delay_seconds: number;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Fetch campaigns error:", error);
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();

    const channel = supabase
      .channel("campaigns-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
        fetchCampaigns();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCampaigns]);

  return { campaigns, loading, refetch: fetchCampaigns };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProspectLead {
  id: string;
  contact_id: string | null;
  assigned_agent_id: string | null;
  created_by: string;
  company_name: string;
  contact_name: string | null;
  phone: string;
  email: string | null;
  segment: string | null;
  estimated_value: number | null;
  message_sent_at: string | null;
  interaction_status: "novo" | "sim" | "pendente" | "nao";
  next_step: string | null;
  observations: string | null;
  last_interaction_at: string | null;
  source: "manual" | "crm" | "csv";
  state?: string | null;
  city?: string | null;
  loss_reason?: string | null;
  funnel_stage?: string | null;
  responsible?: string | null;
  equipment_type?: string | null;
  role?: string | null;
  source_origin?: string | null;
  created_at: string;
  updated_at: string;
}

export function useProspectLeads() {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("prospect_leads" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch prospect_leads:", error);
    setLeads(((data as any) || []) as ProspectLead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("prospect-leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prospect_leads" },
        () => fetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { leads, loading, refetch: fetch };
}

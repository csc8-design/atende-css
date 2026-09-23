import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function phoneVariants(raw: string | null | undefined): string[] {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const set = new Set<string>();
  set.add(digits);
  if (digits.startsWith("55")) set.add(digits.slice(2));
  else set.add("55" + digits);
  for (const v of [...set]) {
    // sem o 9º dígito (celular BR)
    if (v.length === 13 && v.startsWith("55") && v[4] === "9") set.add(v.slice(0, 4) + v.slice(5));
    if (v.length === 11 && v[2] === "9") set.add(v.slice(0, 2) + v.slice(3));
  }
  return [...set];
}

/**
 * Conta passagens de bastão por campanha: leads cujo telefone tem
 * qual_lead_qualification.score = 4 (e não desqualificado) na aba Qualificação IA.
 */
export function useMassCampaignHandoffs() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);

    // 1) Telefones com score 4 na Qualificação IA
    const { data: quals } = await supabase
      .from("qual_lead_qualification")
      .select("score, disqualified, qual_conversations!inner(phone)")
      .eq("score", 4)
      .eq("disqualified", false);

    const score4 = new Set<string>();
    for (const q of (quals as any[]) || []) {
      const phone = q.qual_conversations?.phone;
      for (const v of phoneVariants(phone)) score4.add(v);
    }

    // 2) Leads que responderam (status replied)
    const { data: leads } = await supabase
      .from("mass_campaign_leads")
      .select("campaign_id, telefone, telefone_normalizado, manual_handoff")
      .eq("status", "replied")
      .limit(10000);

    const map: Record<string, number> = {};
    const counted = new Set<string>();
    for (const l of leads || []) {
      const variants = phoneVariants(l.telefone_normalizado || l.telefone);
      const autoHit = variants.some((v) => score4.has(v));
      if (autoHit || (l as any).manual_handoff) {
        map[l.campaign_id] = (map[l.campaign_id] || 0) + 1;
        counted.add(`${l.campaign_id}:${(l.telefone_normalizado || l.telefone)}`);
      }
    }

    // 3) Leads com passagem de bastão manual mesmo sem status replied
    const { data: manualLeads } = await supabase
      .from("mass_campaign_leads")
      .select("campaign_id, telefone, telefone_normalizado")
      .eq("manual_handoff", true)
      .neq("status", "replied")
      .limit(10000);
    for (const l of manualLeads || []) {
      const key = `${l.campaign_id}:${(l.telefone_normalizado || l.telefone)}`;
      if (counted.has(key)) continue;
      map[l.campaign_id] = (map[l.campaign_id] || 0) + 1;
      counted.add(key);
    }

    setCounts(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel("mass_campaign_handoffs")
      .on("postgres_changes", { event: "*", schema: "public", table: "qual_lead_qualification" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_campaign_leads" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return { counts, loading, refetch };
}

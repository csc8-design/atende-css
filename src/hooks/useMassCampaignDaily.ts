import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DailyPoint = {
  date: string;
  count: number;
  replies: number;
  rate: number; // response rate (%)
};

export function useMassCampaignDaily(days = 7) {
  const [series, setSeries] = useState<Record<string, DailyPoint[]>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("mass_campaign_leads")
      .select("campaign_id, sent_at, replied_at, manual_replied")
      .gte("sent_at", since.toISOString())
      .not("sent_at", "is", null)
      .limit(50000);

    // Build sends + replies buckets per campaign (indexed by send-day)
    const sendsBuckets: Record<string, Record<string, number>> = {};
    const repliesBuckets: Record<string, Record<string, number>> = {};
    (data || []).forEach((row: any) => {
      if (!row.sent_at) return;
      const d = new Date(row.sent_at);
      const key = d.toISOString().slice(0, 10);
      sendsBuckets[row.campaign_id] ||= {};
      repliesBuckets[row.campaign_id] ||= {};
      sendsBuckets[row.campaign_id][key] = (sendsBuckets[row.campaign_id][key] || 0) + 1;
      if (row.replied_at || row.manual_replied) {
        repliesBuckets[row.campaign_id][key] = (repliesBuckets[row.campaign_id][key] || 0) + 1;
      }
    });

    // Fill missing days (chronological order)
    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }

    const out: Record<string, DailyPoint[]> = {};
    Object.keys(sendsBuckets).forEach((cid) => {
      out[cid] = dayKeys.map((k) => {
        const count = sendsBuckets[cid][k] || 0;
        const replies = repliesBuckets[cid]?.[k] || 0;
        const rate = count > 0 ? Math.round((replies / count) * 100) : 0;
        return { date: k, count, replies, rate };
      });
    });
    setSeries(out);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel("mass_daily_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_campaign_leads" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  return { series, loading, refetch, days };
}

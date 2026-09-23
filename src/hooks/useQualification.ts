import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QualConversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  assigned_agent_id: string | null;
  finished_at: string | null;
  handoff_summary: string | null;
  evolution_instance: string | null;
  archived?: boolean;
}

export interface QualMessage {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  sender_name: string | null;
  sent_at: string;
}

export interface CriterionState {
  status: "pending" | "qualified";
  confidence: number;
  evidence: string | null;
  summary: string | null;
  manual?: boolean;
}

export interface QualQualification {
  conversation_id: string;
  score: number;
  criteria: {
    necessidade: CriterionState;
    decisor: CriterionState;
    prazo: CriterionState;
    capacidade: CriterionState;
  };
  ai_summary: string | null;
  lead_data: Record<string, string | null>;
  last_analyzed_at: string | null;
  last_message_count: number;
  disqualified?: boolean;
}

export function useQualificationsMap() {
  const [map, setMap] = useState<Record<string, QualQualification>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("qual_lead_qualification").select("*");
    const m: Record<string, QualQualification> = {};
    (data || []).forEach((row: any) => { m[row.conversation_id] = row; });
    setMap(m);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("qual-qual-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "qual_lead_qualification" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return map;
}

export function useQualConversations() {
  const [items, setItems] = useState<QualConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("qual_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    setItems((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("qual-conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "qual_conversations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { items, loading, reload: load };
}

export async function setQualConversationArchived(id: string, archived: boolean) {
  const { error } = await supabase
    .from("qual_conversations")
    .update({ archived })
    .eq("id", id);
  if (error) throw error;
}

export function useQualMessages(conversationId: string | null) {
  const [items, setItems] = useState<QualMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    supabase
      .from("qual_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        setItems((data as any) || []);
        setLoading(false);
      });

    const ch = supabase
      .channel(`qual-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "qual_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setItems((prev) => [...prev, payload.new as QualMessage]);
        },
      )
      .subscribe();

    // Reset unread
    supabase.from("qual_conversations").update({ unread_count: 0 }).eq("id", conversationId).then(() => {});

    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId]);

  return { items, loading };
}

export function useQualQualification(conversationId: string | null) {
  const [data, setData] = useState<QualQualification | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const { data: row } = await supabase
      .from("qual_lead_qualification")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    setData((row as any) || null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      return;
    }
    load();
    const ch = supabase
      .channel(`qual-qual-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "qual_lead_qualification",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, load]);

  const triggerAnalysis = useCallback(async (force = false) => {
    if (!conversationId) return;
    setAnalyzing(true);
    try {
      await supabase.functions.invoke("qual-analyze-lead", { body: { conversationId, force } });
    } finally {
      setAnalyzing(false);
    }
  }, [conversationId]);

  const setDisqualified = useCallback(
    async (value: boolean) => {
      if (!conversationId) return;
      await supabase
        .from("qual_lead_qualification")
        .upsert(
          { conversation_id: conversationId, disqualified: value },
          { onConflict: "conversation_id" },
        );
      load();
    },
    [conversationId, load],
  );

  // Debounced auto-analysis when messages arrive.
  // 45s debounce + server-side guards (no_new_messages / 2min throttle)
  // mantêm o custo de IA baixo mesmo em conversas ativas.
  const scheduleAnalysis = useCallback(() => {
    if (data?.disqualified) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerAnalysis(false);
    }, 45_000);
  }, [triggerAnalysis, data?.disqualified]);


  const setCriterionManual = useCallback(
    async (key: keyof QualQualification["criteria"], qualified: boolean, reason: string) => {
      if (!conversationId) return;
      const { data: row } = await supabase
        .from("qual_lead_qualification")
        .select("*")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      const current = (row as any) || {};
      const criteria = {
        necessidade: { status: "pending", confidence: 0, evidence: null, summary: null },
        decisor: { status: "pending", confidence: 0, evidence: null, summary: null },
        prazo: { status: "pending", confidence: 0, evidence: null, summary: null },
        capacidade: { status: "pending", confidence: 0, evidence: null, summary: null },
        ...(current.criteria || {}),
      } as any;
      if (qualified) {
        criteria[key] = {
          status: "qualified",
          confidence: 1,
          evidence: reason || null,
          summary: reason || "Qualificado manualmente pelo agente",
          manual: true,
        };
      } else {
        criteria[key] = {
          status: "pending",
          confidence: 0,
          evidence: null,
          summary: null,
          manual: false,
        };
      }
      const score =
        (criteria.necessidade.status === "qualified" ? 1 : 0) +
        (criteria.decisor.status === "qualified" ? 1 : 0) +
        (criteria.prazo.status === "qualified" ? 1 : 0) +
        (criteria.capacidade.status === "qualified" ? 1 : 0);
      await supabase
        .from("qual_lead_qualification")
        .upsert(
          {
            conversation_id: conversationId,
            score,
            criteria,
            ai_summary: current.ai_summary ?? null,
            lead_data: current.lead_data ?? {},
            last_analyzed_at: current.last_analyzed_at ?? new Date().toISOString(),
            last_message_count: current.last_message_count ?? 0,
          },
          { onConflict: "conversation_id" },
        );
      load();
    },
    [conversationId, load],
  );

  return { data, analyzing, triggerAnalysis, scheduleAnalysis, setDisqualified, setCriterionManual };
}

export function temperatureFromScore(score: number, disqualified?: boolean):
  { label: string; key: "disq" | "frio" | "morno" | "quente"; className: string } {
  if (disqualified) return { label: "Desqualificado", key: "disq", className: "bg-muted text-muted-foreground border-border" };
  if (score >= 3) return { label: "Quente", key: "quente", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" };
  if (score === 2) return { label: "Morno", key: "morno", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  return { label: "Frio", key: "frio", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" };
}

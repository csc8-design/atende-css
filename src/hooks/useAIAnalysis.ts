import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIAnalysis {
  sentiment: string | null;
  sentiment_score: number | null;
  lead_score: string | null;
  summary: string | null;
  suggested_responses: string[];
  alert_supervisor: boolean;
  alert_reason?: string;
}

export interface AISuggestion {
  id: string;
  content: string;
  suggestion_type: string;
  is_used: boolean;
  created_at: string;
}

export function useAIAnalysis(conversationId: string | null) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const autoAnalysisTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchExistingAnalysis = useCallback(async () => {
    if (!conversationId) {
      setAnalysis(null);
      setSuggestions([]);
      return;
    }

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("sentiment, sentiment_score, lead_score, ai_summary")
      .eq("id", conversationId)
      .single();

    if (convError) {
      console.error("Error fetching AI analysis data:", convError);
    }

    if (conv && (conv.sentiment || conv.ai_summary || conv.lead_score)) {
      setAnalysis({
        sentiment: conv.sentiment,
        sentiment_score: conv.sentiment_score,
        lead_score: conv.lead_score,
        summary: conv.ai_summary,
        suggested_responses: [],
        alert_supervisor: false,
      });
    } else {
      setAnalysis(null);
    }

    setLoadingSuggestions(true);
    const { data: suggs } = await supabase
      .from("ai_suggestions")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setSuggestions((suggs as AISuggestion[]) || []);
    setLoadingSuggestions(false);
  }, [conversationId]);

  useEffect(() => {
    fetchExistingAnalysis();
  }, [fetchExistingAnalysis]);

  const runAnalysis = useCallback(async (silent = false) => {
    if (!conversationId) return;
    setAnalyzing(true);
    console.log("Running AI analysis for conversation:", conversationId);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analyze", {
        body: { conversationId },
      });

      console.log("AI analysis response:", { data, error });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        // Small delay to ensure DB writes from edge function are committed before re-fetching
        setTimeout(() => fetchExistingAnalysis(), 1500);
        if (!silent) toast.success("Análise de IA concluída");
      }
    } catch (err: any) {
      console.error("AI analysis error:", err);
      if (!silent) {
        if (err.message?.includes("429")) {
          toast.error("Limite de requisições. Tente novamente em alguns segundos.");
        } else if (err.message?.includes("402")) {
          toast.error("Créditos de IA esgotados.");
        } else {
          toast.error("Erro ao analisar conversa");
        }
      }
    } finally {
      setAnalyzing(false);
    }
  }, [conversationId, fetchExistingAnalysis]);

  // Auto-análise no Inbox foi desativada: a qualificação por IA agora vive
  // exclusivamente na aba Qualificação IA. Mantemos apenas leitura de dados
  // anteriores e a possibilidade de rodar manualmente via runAnalysis().

  // Listen for conversation updates (sentiment/lead_score changes) in real-time
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`ai-conv-updates-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.sentiment || updated.lead_score || updated.ai_summary) {
            setAnalysis(prev => ({
              sentiment: updated.sentiment,
              sentiment_score: updated.sentiment_score,
              lead_score: updated.lead_score,
              summary: updated.ai_summary,
              suggested_responses: prev?.suggested_responses || [],
              alert_supervisor: prev?.alert_supervisor || false,
              alert_reason: prev?.alert_reason,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Listen for new AI suggestions in real-time
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`ai-suggestions-rt-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_suggestions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newSugg = payload.new as AISuggestion;
          if (!newSugg.is_used) {
            setSuggestions(prev => {
              // Avoid duplicates
              if (prev.some(s => s.id === newSugg.id)) return prev;
              return [newSugg, ...prev].slice(0, 5);
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_suggestions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as AISuggestion;
          if (updated.is_used) {
            setSuggestions(prev => prev.filter(s => s.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const markSuggestionUsed = useCallback(async (suggestionId: string) => {
    await supabase
      .from("ai_suggestions")
      .update({ is_used: true })
      .eq("id", suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  return {
    analysis,
    suggestions,
    analyzing,
    loadingSuggestions,
    runAnalysis: () => runAnalysis(false),
    markSuggestionUsed,
    refetch: fetchExistingAnalysis,
  };
}

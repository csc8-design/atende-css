import { Brain, Sparkles, TrendingUp, AlertTriangle, RefreshCw, Loader2, ThermometerSun } from "lucide-react";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { Button } from "@/components/ui/button";

interface AIAnalysisPanelProps {
  conversationId: string | null;
}

const sentimentConfig: Record<string, { label: string; color: string; emoji: string }> = {
  positivo: { label: "Positivo", color: "text-green-600 bg-green-500/10", emoji: "😊" },
  satisfeito: { label: "Satisfeito", color: "text-green-600 bg-green-500/10", emoji: "😄" },
  neutro: { label: "Neutro", color: "text-yellow-600 bg-yellow-500/10", emoji: "😐" },
  negativo: { label: "Negativo", color: "text-orange-600 bg-orange-500/10", emoji: "😟" },
  irritado: { label: "Irritado", color: "text-red-600 bg-red-500/10", emoji: "😡" },
};

const leadConfig: Record<string, { label: string; color: string; icon: string }> = {
  quente: { label: "Quente", color: "text-red-500 bg-red-500/10", icon: "🔥" },
  morno: { label: "Morno", color: "text-yellow-500 bg-yellow-500/10", icon: "🌤️" },
  frio: { label: "Frio", color: "text-blue-500 bg-blue-500/10", icon: "❄️" },
};

const AIAnalysisPanel = ({ conversationId }: AIAnalysisPanelProps) => {
  const { analysis, analyzing, runAnalysis } = useAIAnalysis(conversationId);

  if (!conversationId) return null;

  const sentiment = analysis?.sentiment ? sentimentConfig[analysis.sentiment] : null;
  const lead = analysis?.lead_score ? leadConfig[analysis.lead_score] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          Análise IA
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={runAnalysis}
          disabled={analyzing}
          className="h-7 px-2 text-xs"
        >
          {analyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {!analysis && !analyzing && (
        <button
          onClick={runAnalysis}
          className="w-full py-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:bg-secondary/50 transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Analisar conversa com IA
        </button>
      )}

      {analyzing && (
        <div className="py-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Analisando conversa...
        </div>
      )}

      {analysis && !analyzing && (
        <div className="space-y-2.5">
          {/* Sentiment */}
          {sentiment && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${sentiment.color}`}>
              <span className="text-lg">{sentiment.emoji}</span>
              <div>
                <p className="text-xs font-semibold">Sentimento</p>
                <p className="text-[11px]">{sentiment.label} ({((analysis.sentiment_score || 0) * 100).toFixed(0)}%)</p>
              </div>
            </div>
          )}

          {/* Lead Score */}
          {lead && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${lead.color}`}>
              <span className="text-lg">{lead.icon}</span>
              <div>
                <p className="text-xs font-semibold">Lead</p>
                <p className="text-[11px]">{lead.label}</p>
              </div>
            </div>
          )}

          {/* Alert */}
          {analysis.alert_supervisor && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 bg-red-500/10">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p className="text-[11px] font-medium">{analysis.alert_reason || "Atenção requerida"}</p>
            </div>
          )}

          {/* Summary */}
          {analysis.summary && (
            <div className="bg-secondary p-2.5 rounded-lg">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Resumo</p>
              <p className="text-xs text-foreground leading-relaxed">{analysis.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPanel;

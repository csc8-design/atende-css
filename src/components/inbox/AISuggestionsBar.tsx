import { Sparkles } from "lucide-react";
import { AISuggestion } from "@/hooks/useAIAnalysis";

interface AISuggestionsBarProps {
  suggestions: AISuggestion[];
  markSuggestionUsed: (id: string) => void;
  onUseSuggestion: (text: string) => void;
}

const AISuggestionsBar = ({ suggestions, markSuggestionUsed, onUseSuggestion }: AISuggestionsBarProps) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-border bg-primary/5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[11px] font-semibold text-primary">Sugestões de IA</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              onUseSuggestion(s.content);
              markSuggestionUsed(s.id);
            }}
            className="group relative text-xs px-3 py-1.5 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors max-w-[280px] truncate"
            title={s.content}
          >
            {s.content}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AISuggestionsBar;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, X, ArrowUp } from "lucide-react";

export type AiSearchBarProps = {
  placeholder?: string;
  loading?: boolean;
  reasoning?: string | null;
  active?: boolean;
  resultCount?: number | null;
  onSearch: (query: string) => void | Promise<void>;
  onClear: () => void;
  className?: string;
};

export const AiSearchBar = ({
  placeholder = "Pergunte alguma coisa...",
  loading,
  reasoning,
  active,
  resultCount,
  onSearch,
  onClear,
  className = "",
}: AiSearchBarProps) => {
  const [q, setQ] = useState("");

  const run = () => {
    if (!q.trim() || loading) return;
    onSearch(q.trim());
  };

  const canSubmit = !!q.trim() && !loading;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        {/* Glow CBMaq azul */}
        <div
          className="absolute -inset-2 rounded-full opacity-70 blur-2xl pointer-events-none transition-opacity"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(59,111,160,0.45) 0%, rgba(30,58,95,0.25) 45%, transparent 75%)",
          }}
        />
        <div
          className="relative flex items-center gap-2 bg-background rounded-full pl-3 pr-2 py-2 border border-border/60 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_10px_40px_-10px_rgba(59,111,160,0.55)] focus-within:border-[#3b6fa0]/60 transition-colors"
        >
          <div className="shrink-0 flex items-center gap-1.5 pl-1 pr-2 border-r border-border/50 mr-1">
            <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#0f1b3d] flex items-center justify-center shadow-[0_0_12px_rgba(59,111,160,0.55)]">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold tracking-wide text-[#1e3a5f] dark:text-[#7fb0e0] uppercase">IA</span>
          </div>
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            placeholder={placeholder}
            disabled={loading}
            rows={1}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-[15px] placeholder:text-muted-foreground/70 py-1.5 max-h-32"
          />

          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                onClear();
              }}
              className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-foreground"
              title="Limpar busca IA"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          <button
            type="button"
            onClick={run}
            disabled={!canSubmit}
            aria-label="Buscar"
            className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all
              ${canSubmit
                ? "bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white shadow-[0_0_20px_rgba(59,111,160,0.6)]"
                : "bg-muted text-muted-foreground cursor-not-allowed"}
            `}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {(reasoning || (active && resultCount != null)) && (
        <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 border border-[#3b6fa0]/25 bg-[#3b6fa0]/5">
          <Sparkles className="w-3.5 h-3.5 text-[#3b6fa0] mt-0.5 shrink-0" />
          <div className="flex-1 text-foreground/80">
            {active && resultCount != null && (
              <span className="font-semibold mr-1">
                {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
              </span>
            )}
            {reasoning && <span className="text-muted-foreground">· {reasoning}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiSearchBar;

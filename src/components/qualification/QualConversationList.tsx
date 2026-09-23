import { useState } from "react";
import { Search, Flame, Snowflake, Thermometer, Ban, Lock, Archive, ArchiveRestore } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { QualConversation, QualQualification } from "@/hooks/useQualification";
import { temperatureFromScore, setQualConversationArchived } from "@/hooks/useQualification";

interface Props {
  items: QualConversation[];
  qualifications: Record<string, QualQualification>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function initials(name: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function TempIcon({ k, className }: { k: "disq" | "frio" | "morno" | "quente"; className?: string }) {
  if (k === "disq") return <Ban className={className} />;
  if (k === "quente") return <Flame className={className} />;
  if (k === "morno") return <Thermometer className={className} />;
  return <Snowflake className={className} />;
}

export default function QualConversationList({ items, qualifications, selectedId, onSelect }: Props) {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const filtered = items.filter((c) => {
    if (showArchived ? !c.archived : c.archived) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (c.contact_name || "").toLowerCase().includes(s) || c.phone.includes(s);
  });

  const toggleArchive = async (e: React.MouseEvent, c: QualConversation) => {
    e.stopPropagation();
    try {
      await setQualConversationArchived(c.id, !c.archived);
      toast.success(c.archived ? "Conversa desarquivada" : "Conversa arquivada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao arquivar");
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="font-semibold text-lg text-foreground">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-9 h-9 bg-secondary border-0"
          />
        </div>
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors",
              !showArchived ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            Ativas
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn(
              "flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1",
              showArchived ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            <Archive className="w-3 h-3" />
            Arquivadas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nenhuma conversa ainda.
            <br />
            Aguardando mensagens da Evolution API.
          </div>
        ) : (
          (() => {
            let lastDateLabel: string | null = null;
            return filtered.map((c) => {
              const qual = qualifications[c.id];
              const score = qual?.score ?? 0;
              const temp = temperatureFromScore(score, qual?.disqualified);
              const name = c.contact_name || c.phone;
              const active = c.id === selectedId;

              const lastDate = c.last_message_at ? new Date(c.last_message_at) : null;
              const timeStr = lastDate
                ? lastDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "";
              let dateLabel = "";
              if (lastDate) {
                const today = new Date();
                const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
                if (sameDay(lastDate, today)) dateLabel = "Hoje";
                else if (sameDay(lastDate, yesterday)) dateLabel = "Ontem";
                else dateLabel = lastDate.toLocaleDateString("pt-BR");
              }
              const showDateDivider = dateLabel && dateLabel !== lastDateLabel;
              if (dateLabel) lastDateLabel = dateLabel;

              return (
                <div key={c.id}>
                  {showDateDivider && (
                    <div className="sticky top-0 z-10 px-4 py-1.5 bg-card/95 backdrop-blur-sm border-b border-border/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(c.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSelect(c.id); }}
                    className={cn(
                      "group relative w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b border-border/30 cursor-pointer",
                      active
                        ? "bg-primary/8 border-l-[3px] border-l-primary"
                        : "border-l-[3px] border-l-transparent hover:bg-secondary/40",
                      c.archived && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleArchive(e, c)}
                      title={c.archived ? "Desarquivar" : "Arquivar conversa"}
                      className="absolute top-2 right-2 z-10 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {c.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-11 h-11 ring-2 ring-background shadow-sm">
                        <AvatarFallback className="text-sm font-semibold text-white" style={{ backgroundColor: avatarColor(name) }}>
                          {initials(c.contact_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-card flex items-center justify-center",
                        temp.key === "quente" && "bg-red-500",
                        temp.key === "morno" && "bg-amber-500",
                        temp.key === "frio" && "bg-blue-500",
                        temp.key === "disq" && "bg-muted-foreground",
                      )}>
                        <TempIcon k={temp.key} className="w-2 h-2 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Nome + horário */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-foreground truncate">{name}</span>
                        <span className={cn(
                          "text-[11px] flex-shrink-0",
                          c.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground",
                        )}>
                          {timeStr}
                        </span>
                      </div>

                      {/* Linha 2: Última mensagem (somente admin) */}
                      {isAdmin ? (
                        <p className={cn(
                          "text-xs truncate mb-1.5",
                          c.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground",
                        )}>
                          {c.last_message_preview || "Sem mensagens"}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/70 italic mb-1.5 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Conteúdo privado
                        </p>
                      )}

                      {/* Linha 3: Temperatura + score + telefone + unread */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border",
                            temp.className,
                          )}>
                            <TempIcon k={temp.key} className="w-2.5 h-2.5" />
                            {temp.label}
                          </span>
                          <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                            {score}/4
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 truncate">· {c.phone}</span>
                        </div>
                        {c.unread_count > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}

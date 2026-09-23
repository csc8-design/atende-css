import { useState } from "react";
import { Search, Archive, BellOff, Pin, MailOpen, Heart, XCircle, List, Trash2, ArrowRightLeft, MessageSquarePlus, Flame, Thermometer, Snowflake, Building2, AlertCircle, UserCheck, UserX } from "lucide-react";
import { getDepartmentIcon } from "@/lib/departmentIcon";
import { ConversationWithContact } from "@/hooks/useConversations";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ChannelBadge from "@/components/shared/ChannelBadge";
import { useAuth } from "@/contexts/AuthContext";
import { maskPhone } from "@/lib/maskPhone";
import StatusDot from "@/components/shared/StatusDot";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

interface ConversationListProps {
  conversations: ConversationWithContact[];
  loading: boolean;
  selectedId?: string;
  onSelect: (conversation: ConversationWithContact) => void;
  onNewConversation?: () => void;
  isMobile?: boolean;
}

const ConversationList = ({ conversations, loading, selectedId, onSelect, onNewConversation, isMobile }: ConversationListProps) => {
  const { isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "resolved">("all");

  // Deduplicate globally: keep only ONE conversation per contact (the most recent).
  const uniqueByContact = conversations.reduce((acc, c) => {
    if (!c.contacts) return acc;
    const existing = acc.get(c.contact_id);
    if (!existing || new Date(c.last_message_at || c.created_at) > new Date(existing.last_message_at || existing.created_at)) {
      acc.set(c.contact_id, c);
    }
    return acc;
  }, new Map<string, ConversationWithContact>());

  const filtered = Array.from(uniqueByContact.values())
    .filter((c) => {
      const matchesSearch =
        c.contacts.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.contacts.phone?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || c.status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const ta = new Date(a.last_message_at || a.created_at).getTime();
      const tb = new Date(b.last_message_at || b.created_at).getTime();
      return tb - ta;
    });

  const openCount = conversations.filter((c) => c.status === "open").length;

  return (
    <div className={`${isMobile ? "w-full" : "w-[340px]"} border-r border-border flex flex-col bg-card h-full`}>
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">Conversas</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewConversation}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Nova conversa"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
              {openCount} abertas
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-1">
          {(["all", "open", "pending", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "all" ? "Todas" : f === "open" ? "Abertas" : f === "pending" ? "Pendentes" : "Resolvidas"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
        ) : (
          (() => {
            let lastDateLabel: string | null = null;
            return filtered.map((conversation) => {
            const initials = conversation.contacts.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2);

            // Generate unique color from name
            let hash = 0;
            for (let i = 0; i < conversation.contacts.name.length; i++) {
              hash = conversation.contacts.name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            const avatarBgColor = `hsl(${hue}, 55%, 45%)`;

            const lastDate = conversation.last_message_at ? new Date(conversation.last_message_at) : null;
            const timeAgo = lastDate
              ? lastDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              : "";

            let dateLabel = "";
            if (lastDate) {
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              const sameDay = (a: Date, b: Date) =>
                a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
              if (sameDay(lastDate, today)) dateLabel = "Hoje";
              else if (sameDay(lastDate, yesterday)) dateLabel = "Ontem";
              else dateLabel = lastDate.toLocaleDateString("pt-BR");
            }

            const lm = conversation.last_message;
            let lastMessagePreview = "";
            if (lm) {
              const prefix = lm.sender_type === "contact" ? "" : "Você: ";
              if (lm.message_type === "image") lastMessagePreview = `${prefix}📷 Imagem`;
              else if (lm.message_type === "video") lastMessagePreview = `${prefix}🎥 Vídeo`;
              else if (lm.message_type === "audio") lastMessagePreview = `${prefix}🎵 Áudio`;
              else if (lm.message_type === "document") lastMessagePreview = `${prefix}📎 Documento`;
              else lastMessagePreview = `${prefix}${lm.content || ""}`;
            }

            const showDateDivider = dateLabel && dateLabel !== lastDateLabel;
            if (dateLabel) lastDateLabel = dateLabel;

            const statusColor =
              conversation.status === "open"
                ? "bg-green-500"
                : conversation.status === "pending"
                ? "bg-yellow-500"
                : conversation.status === "resolved"
                ? "bg-blue-500"
                : "bg-muted-foreground";

            return (
              <div key={conversation.id}>
                {showDateDivider && (
                  <div className="sticky top-0 z-10 px-4 py-1.5 bg-card/95 backdrop-blur-sm border-b border-border/40">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {dateLabel}
                    </span>
                  </div>
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => onSelect(conversation)}
                      className={`group w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/30 ${
                        selectedId === conversation.id
                          ? "bg-primary/8 border-l-[3px] border-l-primary"
                          : "border-l-[3px] border-l-transparent hover:bg-secondary/40"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-11 h-11 ring-2 ring-background shadow-sm">
                          <AvatarImage src={conversation.contacts.avatar_url || undefined} alt={conversation.contacts.name} />
                          <AvatarFallback className="text-sm font-semibold text-white" style={{ backgroundColor: avatarBgColor }}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-card ${statusColor}`} />
                        <div className="absolute -top-1 -right-1">
                          <ChannelBadge channel={conversation.channel as any} />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Linha 1: Nome + score + horário */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {conversation.contacts.name}
                            </span>
                            {conversation.lead_score && (
                              <span
                                title={`Lead ${conversation.lead_score}`}
                                className={`flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full ${
                                  conversation.lead_score === "quente"
                                    ? "text-destructive"
                                    : conversation.lead_score === "morno"
                                    ? "text-orange-500"
                                    : "text-blue-500"
                                }`}
                              >
                                {conversation.lead_score === "quente" ? (
                                  <Flame className="w-3.5 h-3.5" />
                                ) : conversation.lead_score === "morno" ? (
                                  <Thermometer className="w-3.5 h-3.5" />
                                ) : (
                                  <Snowflake className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] flex-shrink-0 ${conversation.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {timeAgo}
                          </span>
                        </div>

                        {/* Linha 2: Última mensagem */}
                        <p className={`text-xs truncate mb-1 ${conversation.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {lastMessagePreview || "Sem mensagens"}
                        </p>

                        {/* Linha 3: Departamento + telefone + unread */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {(() => {
                              const hasDept = !!conversation.departments?.name;
                              const DeptIcon = hasDept ? getDepartmentIcon(conversation.departments!.name) : AlertCircle;
                              return (
                                <span
                                  title={hasDept ? undefined : "Atribuir a um departamento"}
                                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate ${
                                    hasDept
                                      ? "bg-primary/10 text-primary"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse"
                                  }`}
                                >
                                  <DeptIcon className={`w-2.5 h-2.5 flex-shrink-0 ${hasDept ? "" : "fill-amber-500/20"}`} />
                                  {hasDept ? conversation.departments!.name : "Atribuir depto"}
                                </span>
                              );
                            })()}
                            <span className="text-[10px] text-muted-foreground/80 truncate">
                              · {maskPhone(conversation.contacts.phone, !isManager && !isAdmin)}
                            </span>
                          </div>
                          {conversation.unread_count > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>

                        {/* Linha 4: Atendente atribuído */}
                        <div className="mt-1">
                          {(() => {
                            const agentName = conversation.assigned_profile?.full_name;
                            if (agentName) {
                              return (
                                <span
                                  title={`Atendente: ${agentName}`}
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                >
                                  <UserCheck className="w-2.5 h-2.5 flex-shrink-0" />
                                  {agentName}
                                </span>
                              );
                            }
                            return (
                              <span
                                title="Sem atendente atribuído"
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40"
                              >
                                <UserX className="w-2.5 h-2.5 flex-shrink-0" />
                                Sem atendente
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar conversa
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <BellOff className="mr-2 h-4 w-4" />
                      Silenciar notificações
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <Pin className="mr-2 h-4 w-4" />
                      Fixar conversa
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <MailOpen className="mr-2 h-4 w-4" />
                      Marcar como não lida
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <Heart className="mr-2 h-4 w-4" />
                      Adicionar aos favoritos
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                      onSelect(conversation);
                      toast.info("Selecione o departamento no painel lateral para transferir");
                    }}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transferir conversa
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Fechar conversa
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")}>
                      <List className="mr-2 h-4 w-4" />
                      Adicionar à lista
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => toast.info("Funcionalidade em breve")} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Apagar conversa
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            );
            });
          })()
        )}
      </div>
    </div>
  );
};

export default ConversationList;

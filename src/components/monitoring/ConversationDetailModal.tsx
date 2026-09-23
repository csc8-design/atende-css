import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusDot from "@/components/shared/StatusDot";
import ChannelBadge from "@/components/shared/ChannelBadge";
import { MessageSquare, User, FileText, Image, Mic, Video, MapPin, Sticker, Clock, Tag } from "lucide-react";

interface Message {
  id: string;
  content: string | null;
  sender_type: string;
  message_type: string;
  media_url: string | null;
  created_at: string;
  sender_id: string | null;
  is_read: boolean;
}

interface ConversationDetailModalProps {
  open: boolean;
  onClose: () => void;
  conversation: any | null;
}

const messageTypeIcon: Record<string, any> = {
  image: Image,
  audio: Mic,
  video: Video,
  document: FileText,
  location: MapPin,
  sticker: Sticker,
};

const ConversationDetailModal = ({ open, onClose, conversation }: ConversationDetailModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; avatar_url: string | null }>>({});

  const fetchMessages = useCallback(async () => {
    if (!conversation?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
      // Fetch agent profiles
      const agentIds = [...new Set(data.filter(m => m.sender_type === "agent" && m.sender_id).map(m => m.sender_id!))];
      if (agentIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", agentIds);
        if (profileData) {
          const map: Record<string, { full_name: string; avatar_url: string | null }> = {};
          profileData.forEach(p => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (open && conversation?.id) {
      fetchMessages();
    } else {
      setMessages([]);
      setProfiles({});
    }
  }, [open, conversation?.id, fetchMessages]);

  const contactName = conversation?.contacts?.name || "Desconhecido";
  const contactPhone = conversation?.contacts?.phone || "";

  // Avatar color from name
  let hash = 0;
  for (let i = 0; i < contactName.length; i++) {
    hash = contactName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const avatarBg = `hsl(${Math.abs(hash % 360)}, 55%, 45%)`;
  const initials = contactName.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  const statusLabels: Record<string, string> = { open: "Aberta", pending: "Pendente", resolved: "Resolvida", closed: "Fechada" };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border space-y-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={conversation?.contacts?.avatar_url || undefined} />
              <AvatarFallback className="text-sm font-bold text-white" style={{ backgroundColor: avatarBg }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground truncate">{contactName}</SheetTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{contactPhone}</span>
                {conversation && (
                  <>
                    <span>•</span>
                    <ChannelBadge channel={conversation.channel} size="sm" />
                    <span>•</span>
                    <StatusDot status={conversation.status} />
                    <span>{statusLabels[conversation?.status] || conversation?.status}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Metadata row */}
          {conversation && (
            <div className="flex flex-wrap gap-3 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Criada: {format(new Date(conversation.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              {conversation.last_message_at && (
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Última msg: {format(new Date(conversation.last_message_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              )}
              {conversation.lead_score && (
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Lead: {conversation.lead_score}</span>
              )}
              {conversation.sentiment && (
                <span className="flex items-center gap-1">Sentimento: {conversation.sentiment}</span>
              )}
              {conversation.ai_summary && (
                <p className="w-full text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2 mt-1">
                  <strong>Resumo IA:</strong> {conversation.ai_summary}
                </p>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={`h-12 rounded-lg ${i % 2 === 0 ? "w-3/4" : "w-2/3 ml-auto"}`} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma mensagem nesta conversa</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => {
                const isAgent = msg.sender_type === "agent";
                const isSystem = msg.sender_type === "system";
                const isContact = msg.sender_type === "contact";
                const profile = msg.sender_id ? profiles[msg.sender_id] : null;
                const TypeIcon = messageTypeIcon[msg.message_type];

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center py-1">
                      <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      isAgent
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}>
                      {/* Sender name for agents */}
                      {isAgent && profile && (
                        <p className="text-[10px] font-semibold opacity-80 mb-0.5">
                          {profile.full_name}
                        </p>
                      )}
                      {isContact && (
                        <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                          {contactName}
                        </p>
                      )}

                      {/* Media */}
                      {msg.media_url && msg.message_type === "image" && (
                        <img src={msg.media_url} alt="" className="rounded-lg mb-1 max-h-48 object-cover" />
                      )}
                      {msg.media_url && msg.message_type === "audio" && (
                        <audio controls src={msg.media_url} className="max-w-full mb-1" />
                      )}
                      {msg.media_url && msg.message_type === "video" && (
                        <video controls src={msg.media_url} className="rounded-lg mb-1 max-h-48" />
                      )}
                      {msg.media_url && msg.message_type === "document" && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline mb-1">
                          <FileText className="w-3 h-3" /> Documento
                        </a>
                      )}

                      {/* Content */}
                      {msg.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}

                      {/* Timestamp */}
                      <p className={`text-[10px] mt-1 ${isAgent ? "text-primary-foreground/60" : "text-muted-foreground"} text-right`}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          {messages.length} mensagens nesta conversa
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ConversationDetailModal;

import { useState, useRef, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import VideoCallModal from "@/components/internal-chat/VideoCallModal";
import {
  useInternalChannels,
  useInternalMessages,
  useTeamMembers,
  InternalChannel,
} from "@/hooks/useInternalChat";
import {
  Search,
  Send,
  Plus,
  Hash,
  MessageCircle,
  Users,
  X,
  UserPlus,
  Pin,
  Star,
  MoreVertical,
  Archive,
  BellOff,
  CheckCheck,
  LogOut,
  Mic,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const InternalChat = () => {
  const { user, profile } = useAuth();
  const { channels, loading, createGroup, startDirectMessage, togglePin, toggleFavorite } = useInternalChannels();
  const { members } = useTeamMembers();
  const isMobile = useIsMobile();
  const [selectedChannel, setSelectedChannel] = useState<InternalChannel | null>(null);
  const [search, setSearch] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [tab, setTab] = useState<"all" | "groups" | "direct" | "favorites" | "unread">("all");

  const filtered = channels
    .filter((ch) => {
      const name = ch.channel_type === "direct" ? ch.other_user?.full_name || "" : ch.name || "";
      const matchSearch = name.toLowerCase().includes(search.toLowerCase());
      if (tab === "favorites") return matchSearch && ch.is_favorite;
      if (tab === "unread") return matchSearch && (ch.unread_count ?? 0) > 0;
      const matchTab =
        tab === "all" ||
        (tab === "groups" && (ch.channel_type === "group" || ch.channel_type === "department")) ||
        (tab === "direct" && ch.channel_type === "direct");
      return matchSearch && matchTab;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });

  const handleBack = () => setSelectedChannel(null);

  const totalUnread = channels.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const channelsList = (
    <div className={`${isMobile ? 'flex-1' : 'w-[340px]'} border-r border-border flex flex-col bg-card h-full`}>
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">Chat Interno</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewDM(true)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              title="Nova conversa direta"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNewGroup(true)}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Novo grupo"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
              {totalUnread} não lidas
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversas, pessoas ou grupos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {(["all", "groups", "direct", "favorites", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t === "favorites" && <Star className="w-3 h-3" />}
              {t === "unread" && <MessageCircle className="w-3 h-3" />}
              {t === "all" ? "Todos" : t === "groups" ? "Grupos" : t === "direct" ? "Diretas" : t === "favorites" ? "Favoritos" : "Não lidas"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie um grupo ou inicie uma conversa direta</p>
          </div>
        ) : (
          filtered.map((ch) => {
            const isDirect = ch.channel_type === "direct";
            const name = isDirect ? ch.other_user?.full_name || "Conversa" : ch.name || "Grupo";
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            // Hashed avatar color
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
              hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            const avatarBgColor = `hsl(${hue}, 55%, 45%)`;

            const timeAgo = ch.last_message_at
              ? new Date(ch.last_message_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
              : "";

            const isSelected = selectedChannel?.id === ch.id;
            const hasUnread = (ch.unread_count ?? 0) > 0;
            const typeLabel = isDirect ? "Direta" : ch.channel_type === "department" ? "Departamento" : "Grupo";

            return (
              <div key={ch.id} className="relative">
                <button
                  onClick={() => setSelectedChannel(ch)}
                  className={`group w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/30 ${
                    isSelected && !isMobile
                      ? "bg-primary/8 border-l-[3px] border-l-primary"
                      : "border-l-[3px] border-l-transparent hover:bg-secondary/40"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-full ring-2 ring-background shadow-sm flex items-center justify-center text-sm font-semibold text-white"
                      style={{ backgroundColor: isDirect ? avatarBgColor : 'hsl(var(--primary))' }}
                    >
                      {isDirect ? initials : <Hash className="w-5 h-5" />}
                    </div>
                    {ch.is_pinned && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-card flex items-center justify-center">
                        <Pin className="w-2.5 h-2.5 text-primary rotate-45" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Linha 1: Nome + favorito + horário */}
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate">{name}</span>
                        {ch.is_favorite && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className={`text-[11px] flex-shrink-0 ${hasUnread ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {timeAgo}
                      </span>
                    </div>

                    {/* Linha 2: Última mensagem */}
                    <p className={`text-xs truncate mb-1 ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {ch.last_message || "Sem mensagens"}
                    </p>

                    {/* Linha 3: Tipo + unread */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate ${
                          isDirect ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isDirect ? <MessageCircle className="w-2.5 h-2.5" /> : <Hash className="w-2.5 h-2.5" />}
                        {typeLabel}
                      </span>
                      {hasUnread && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
                          {ch.unread_count! > 99 ? "99+" : ch.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Context menu - only on desktop */}
                {!isMobile && (
                  <div className="absolute right-2 top-3 hidden group-hover:flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); togglePin(ch.id, !!ch.is_pinned); }}>
                          <Pin className="w-4 h-4 mr-2" />
                          {ch.is_pinned ? "Desafixar conversa" : "Fixar conversa"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleFavorite(ch.id, !!ch.is_favorite); }}>
                          <Star className={`w-4 h-4 mr-2 ${ch.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                          {ch.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <CheckCheck className="w-4 h-4 mr-2" />
                          Marcar como lida
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <BellOff className="w-4 h-4 mr-2" />
                          Silenciar notificações
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Archive className="w-4 h-4 mr-2" />
                          Arquivar conversa
                        </DropdownMenuItem>
                        {ch.channel_type !== "direct" && (
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-destructive focus:text-destructive">
                            <LogOut className="w-4 h-4 mr-2" />
                            Sair do grupo
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const modals = (
    <>
      {showNewGroup && (
        <NewGroupModal
          members={members.filter((m) => m.user_id !== user?.id)}
          onClose={() => setShowNewGroup(false)}
          onCreate={async (name, desc, memberIds) => {
            const ch = await createGroup(name, desc, memberIds);
            if (ch) setSelectedChannel(ch as any);
            setShowNewGroup(false);
          }}
        />
      )}
      {showNewDM && (
        <NewDMModal
          members={members.filter((m) => m.user_id !== user?.id)}
          onClose={() => setShowNewDM(false)}
          onSelect={async (userId) => {
            const channelId = await startDirectMessage(userId);
            setShowNewDM(false);
            if (channelId) {
              setTimeout(() => {
                const found = channels.find((c) => c.id === channelId);
                if (found) {
                  setSelectedChannel(found);
                } else {
                  const member = members.find((m) => m.user_id === userId);
                  setSelectedChannel({
                    id: channelId,
                    name: null,
                    description: null,
                    channel_type: "direct",
                    created_by: user?.id || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    other_user: member ? { full_name: member.full_name, user_id: member.user_id } : null,
                  });
                }
              }, 500);
            }
          }}
        />
      )}
    </>
  );

  // Mobile: single panel navigation
  if (isMobile) {
    const hideBottomNav = !!selectedChannel;
    return (
      <AppLayout hideBottomNav={hideBottomNav}>
        <div className={`flex flex-col ${hideBottomNav ? 'h-[100dvh]' : 'h-[calc(100dvh-56px)]'}`}>
          {!selectedChannel ? (
            channelsList
          ) : (
            <ChatAreaInternal channel={selectedChannel} isMobile onBack={handleBack} />
          )}
        </div>
        {modals}
      </AppLayout>
    );
  }

  // Desktop: multi-panel
  return (
    <AppLayout>
      <div className="flex h-screen">
        {channelsList}
        {selectedChannel ? (
          <ChatAreaInternal channel={selectedChannel} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-secondary/30">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Chat Interno</h3>
              <p className="text-sm text-muted-foreground">Selecione uma conversa ou crie um novo grupo</p>
            </div>
          </div>
        )}
        {modals}
      </div>
    </AppLayout>
  );
};

const EMOJI_CATEGORIES = [
  {
    name: "Smileys e pessoas",
    icon: "😊",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉",
      "😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲",
      "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫",
      "🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒",
      "🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒",
      "🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳",
      "🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯",
      "😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢",
      "😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤",
      "😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹",
    ],
  },
  {
    name: "Gestos e corpo",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌",
      "🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
      "👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛",
      "🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅",
      "🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠",
    ],
  },
  {
    name: "Animais e natureza",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨",
      "🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔",
      "🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴",
      "🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲",
    ],
  },
  {
    name: "Comida e bebida",
    icon: "🍔",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐",
      "🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑",
      "🌮","🌯","🥙","🧆","🥚","🍳","🥘","🍲","🫕","🥣",
      "☕","🍵","🧋","🍺","🍻","🥂","🍷","🍸","🍹","🧃",
    ],
  },
  {
    name: "Objetos",
    icon: "💡",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","🔥",
      "⭐","🌟","✨","⚡","💥","🎉","🎊","🎈","🎁","🏆",
      "🥇","🥈","🥉","⚽","🏀","🏈","⚾","🎾","🏐","🎮",
    ],
  },
  {
    name: "Símbolos",
    icon: "🏁",
    emojis: [
      "✅","❌","❓","❗","‼️","⁉️","💯","🔴","🟠","🟡",
      "🟢","🔵","🟣","⚫","⚪","🟤","🔶","🔷","🔸","🔹",
      "▶️","⏸️","⏹️","⏺️","⏭️","⏮️","🔀","🔁","🔂","🔄",
      "➕","➖","➗","✖️","♾️","💲","💱","™️","©️","®️",
    ],
  },
];

// Chat area component
const ChatAreaInternal = ({ channel, isMobile, onBack }: { channel: InternalChannel; isMobile?: boolean; onBack?: () => void }) => {
  const { user, profile } = useAuth();
  const { messages, loading, sendMessage } = useInternalMessages(channel.id);
  const [text, setText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [videoCallRoom, setVideoCallRoom] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    if (showEmojis) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojis]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    const msg = text;
    setText("");
    await sendMessage(msg, user.id);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      console.error("Microphone access denied");
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !user) return;
    setSendingAudio(true);

    const recorder = mediaRecorderRef.current;
    
    const audioBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve(blob);
      };
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingTime(0);

    // Upload to Supabase storage
    const fileName = `audio_${user.id}_${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("internal-audio")
      .upload(fileName, audioBlob, { contentType: "audio/webm" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setSendingAudio(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("internal-audio").getPublicUrl(fileName);
    await sendMessage("🎤 Áudio", user.id, "audio", urlData.publicUrl);
    setSendingAudio(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const channelName =
    channel.channel_type === "direct"
      ? channel.other_user?.full_name || "Conversa"
      : channel.name || "Grupo";

  const startVideoCall = useCallback(async () => {
    const roomId = `atendecss-${channel.id.slice(0, 8)}-${Date.now()}`;
    setVideoCallRoom(roomId);
    // Send system message about the call
    if (user) {
      await sendMessage(`📹 ${profile?.full_name || "Alguém"} iniciou uma videochamada`, user.id);
    }
  }, [channel.id, user, profile, sendMessage]);

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
      {/* Video Call Modal */}
      {videoCallRoom && (
        <VideoCallModal
          roomName={videoCallRoom}
          displayName={profile?.full_name || "Usuário"}
          onClose={() => setVideoCallRoom(null)}
        />
      )}

      {/* Header */}
      <div className={`${isMobile ? 'h-14' : 'h-16'} border-b border-border flex items-center justify-between px-4 flex-shrink-0`}>
        <div className="flex items-center gap-3">
          {isMobile && onBack && (
            <button onClick={onBack} className="p-1 -ml-1 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {channel.channel_type === "direct" ? (
              channelName.split(" ").map((n) => n[0]).join("").slice(0, 2)
            ) : (
              <Hash className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{channelName}</h3>
            {channel.description && (
              <p className="text-xs text-muted-foreground">{channel.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={startVideoCall}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
          title="Iniciar videochamada"
        >
          <Video className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma mensagem. Comece a conversa!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-bl-md"
                  }`}
                >
                  {!isOwn && msg.sender_profile && (
                    <p className="text-[10px] font-semibold mb-1 opacity-80">
                      {msg.sender_profile.full_name}
                    </p>
                  )}
                  {msg.message_type === "audio" && msg.media_url ? (
                    <audio controls src={msg.media_url} className="max-w-[240px] h-8" />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      isOwn ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border relative">
        {/* Emoji picker */}
        {showEmojis && (
          <div
            ref={emojiRef}
            className="absolute bottom-full left-4 mb-2 bg-card border border-border rounded-xl shadow-lg w-[340px] z-10 flex flex-col max-h-[380px]"
          >
            {/* Category tabs */}
            <div className="flex items-center border-b border-border px-2 pt-2 gap-1">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.name}
                  onClick={() => { setEmojiCategory(i); setEmojiSearch(""); }}
                  className={`p-1.5 text-lg rounded-lg transition-colors ${emojiCategory === i ? "bg-primary/10" : "hover:bg-secondary"}`}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar emoji"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary rounded-lg border-0 outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            {/* Category label */}
            <p className="px-3 text-xs font-medium text-muted-foreground mb-1">
              {emojiSearch ? "Resultados" : EMOJI_CATEGORIES[emojiCategory].name}
            </p>
            {/* Emojis grid */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
              <div className="grid grid-cols-10 gap-0.5">
                {(emojiSearch
                  ? EMOJI_CATEGORIES.flatMap((c) => c.emojis)
                  : EMOJI_CATEGORIES[emojiCategory].emojis
                ).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setText((prev) => prev + emoji)}
                    className="w-7 h-7 flex items-center justify-center text-[1.25rem] rounded-md hover:bg-secondary transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-3 bg-destructive/10 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
            <span className="text-xs text-muted-foreground flex-1">Gravando áudio...</span>
            <button
              onClick={cancelRecording}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Cancelar"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={stopAndSendRecording}
              disabled={sendingAudio}
              className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              title="Enviar áudio"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-secondary rounded-xl px-4 py-2">
            <button
              onClick={() => setShowEmojis(!showEmojis)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg"
              title="Emojis"
            >
              <span className="text-lg">😊</span>
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground py-1.5"
            />
            {text.trim() ? (
              <button
                onClick={handleSend}
                className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                title="Gravar áudio"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// New Group Modal
const NewGroupModal = ({
  members,
  onClose,
  onCreate,
}: {
  members: { user_id: string; full_name: string }[];
  onClose: () => void;
  onCreate: (name: string, desc: string, memberIds: string[]) => void;
}) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Novo Grupo</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Nome do grupo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              placeholder="Ex: Equipe Suporte"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Descrição</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              placeholder="Descrição do grupo (opcional)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Membros ({selected.length} selecionados)
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground mb-2"
              placeholder="Buscar colaboradores..."
            />
            <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
              {filtered.map((m) => (
                <label
                  key={m.user_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(m.user_id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelected([...selected, m.user_id]);
                      else setSelected(selected.filter((id) => id !== m.user_id));
                    }}
                    className="rounded"
                  />
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {m.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-sm text-foreground">{m.full_name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => onCreate(name, desc, selected)}
            disabled={!name.trim() || selected.length === 0}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            Criar Grupo
          </button>
        </div>
      </div>
    </div>
  );
};

// New DM Modal
const NewDMModal = ({
  members,
  onClose,
  onSelect,
}: {
  members: { user_id: string; full_name: string }[];
  onClose: () => void;
  onSelect: (userId: string) => void;
}) => {
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Nova Conversa</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-secondary rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground mb-3"
            placeholder="Buscar colaborador..."
          />
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {filtered.map((m) => (
              <button
                key={m.user_id}
                onClick={() => onSelect(m.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {m.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <span className="text-sm text-foreground">{m.full_name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum colaborador encontrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalChat;

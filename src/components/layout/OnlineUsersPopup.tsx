import { useEffect, useRef, useState } from "react";
import { Users, X, Send, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface OnlineUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  online_at: string;
}

const PRESENCE_CHANNEL = "presence:online-users";

const OnlineUsersPopup = () => {
  const { user, profile, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [open, setOpen] = useState(false);
  const [composeFor, setComposeFor] = useState<OnlineUser | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Real-time presence tracking for ALL authenticated users
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    const updateList = () => {
      const state = channel.presenceState() as Record<string, OnlineUser[]>;
      const list: OnlineUser[] = [];
      const seen = new Set<string>();
      Object.values(state).forEach((arr) => {
        arr.forEach((u) => {
          if (u?.user_id && !seen.has(u.user_id)) {
            seen.add(u.user_id);
            list.push(u);
          }
        });
      });
      list.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setOnline(list);
    };

    const trackSelf = () => channel.track({
      user_id: user.id,
      full_name: profile?.full_name || user.email || "Usuário",
      avatar_url: profile?.avatar_url || null,
      online_at: new Date().toISOString(),
    });

    channel
      .on("presence", { event: "sync" }, updateList)
      .on("presence", { event: "join" }, updateList)
      .on("presence", { event: "leave" }, updateList)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await trackSelf();
      });

    // Heartbeat every 30s + re-track when tab becomes visible
    const heartbeat = setInterval(() => { trackSelf(); }, 30000);
    const onVisibility = () => { if (!document.hidden) trackSelf(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, profile?.full_name, profile?.avatar_url]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setComposeFor(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!isAdmin && !isManager) return null;

  const handleSendMessage = async (target: OnlineUser) => {
    if (!draft.trim() || !user) return;
    setSending(true);
    try {
      const { data: channelId, error } = await supabase.rpc("get_or_create_dm_channel", {
        other_user_id: target.user_id,
      });
      if (error || !channelId) throw error || new Error("Falha ao abrir canal");
      const { error: msgErr } = await supabase.from("internal_messages").insert({
        channel_id: channelId as string,
        sender_id: user.id,
        content: draft.trim(),
        message_type: "text",
      });
      if (msgErr) throw msgErr;
      toast({ title: "Mensagem enviada", description: `Para ${target.full_name}` });
      setDraft("");
      setComposeFor(null);
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openChatWith = async (target: OnlineUser) => {
    try {
      const { data: channelId } = await supabase.rpc("get_or_create_dm_channel", {
        other_user_id: target.user_id,
      });
      navigate(`/chat${channelId ? `?channel=${channelId}` : ""}`);
      setOpen(false);
      setComposeFor(null);
    } catch {
      navigate("/chat");
    }
  };

  // Closed: small round bubble
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 group flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-all"
        title={`${online.length} usuário(s) online`}
        aria-label="Usuários online"
      >
        <Users className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
          {online.length}
        </span>
        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-primary" />
      </button>
    );
  }

  // Open: expanded panel
  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 origin-bottom-right"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold truncate">
            {online.length} {online.length === 1 ? "online" : "online"}
          </span>
        </div>
        <button
          onClick={() => { setOpen(false); setComposeFor(null); }}
          className="p-1 rounded hover:bg-white/15 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2 space-y-1">
        {online.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum usuário online</p>
        ) : (
          online.map((u) => {
            const initials = (u.full_name || "?")
              .split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
            const isComposing = composeFor?.user_id === u.user_id;
            const isSelf = u.user_id === user?.id;
            return (
              <div key={u.user_id} className="rounded-lg hover:bg-secondary/60 transition-colors">
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatar_url || undefined} alt={u.full_name} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </div>
                  <span className="text-sm text-foreground truncate flex-1">
                    {u.full_name}{isSelf && <span className="text-xs text-muted-foreground ml-1">(você)</span>}
                  </span>
                  {!isSelf && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => { setComposeFor(isComposing ? null : u); setDraft(""); }}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                        title="Enviar mensagem rápida"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openChatWith(u)}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground transition-colors"
                        title="Abrir no chat interno"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {isComposing && (
                  <div className="px-2 pb-2 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-150">
                    <input
                      autoFocus
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendMessage(u);
                        if (e.key === "Escape") { setComposeFor(null); setDraft(""); }
                      }}
                      placeholder={`Mensagem para ${u.full_name.split(" ")[0]}...`}
                      className="flex-1 text-sm px-2.5 py-1.5 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      onClick={() => handleSendMessage(u)}
                      disabled={sending || !draft.trim()}
                      className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                      title="Enviar"
                    >
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OnlineUsersPopup;

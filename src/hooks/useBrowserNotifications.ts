import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function requestPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function useBrowserNotifications() {
  const { user } = useAuth();
  const shownIds = useRef(new Set<string>());

  const showNotification = useCallback(
    async (messageRow: any) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (shownIds.current.has(messageRow.id)) return;
      shownIds.current.add(messageRow.id);

      // Fetch conversation + contact info
      const { data: conv } = await supabase
        .from("conversations")
        .select("contact_id, assigned_agent_id, contacts(name, avatar_url, phone)")
        .eq("id", messageRow.conversation_id)
        .single();

      if (!conv) return;

      const contact = (conv as any).contacts;
      if (!contact) return;

      const title = contact.name || contact.phone || "Nova mensagem";
      const body =
        messageRow.content ||
        (messageRow.message_type === "image"
          ? "📷 Imagem"
          : messageRow.message_type === "audio"
          ? "🎵 Áudio"
          : messageRow.message_type === "video"
          ? "🎥 Vídeo"
          : messageRow.message_type === "document"
          ? "📄 Documento"
          : "Nova mensagem");

      const icon = contact.avatar_url || "/favicon.ico";

      const notification = new Notification(title, {
        body,
        icon,
        tag: `msg-${messageRow.conversation_id}`,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        window.location.href = "/inbox";
        notification.close();
      };

      // Auto close after 6s
      setTimeout(() => notification.close(), 6000);
    },
    []
  );

  useEffect(() => {
    requestPermission();

    if (!user) return;

    const channel = supabase
      .channel("browser-notif-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_type=eq.contact`,
        },
        (payload) => {
          showNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);
}

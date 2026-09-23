import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playChatSound } from "@/lib/notificationSound";

export interface InternalChannel {
  id: string;
  name: string | null;
  description: string | null;
  channel_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // computed
  other_user?: { full_name: string; user_id: string } | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  is_pinned?: boolean;
  is_favorite?: boolean;
}

export interface InternalMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  created_at: string;
  message_type?: string;
  media_url?: string | null;
  sender_profile?: { full_name: string } | null;
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, is_active")
        .eq("is_active", true)
        .order("full_name");
      setMembers((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { members, loading };
}

export function useInternalChannels() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<InternalChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    if (!user) return;

    // Get channels the user is a member of
    const { data: memberData } = await supabase
      .from("channel_members")
      .select("channel_id, is_pinned, is_favorite")
      .eq("user_id", user.id);

    if (!memberData || memberData.length === 0) {
      setChannels([]);
      setLoading(false);
      return;
    }

    const channelIds = memberData.map((m: any) => m.channel_id);
    const memberMap = new Map(memberData.map((m: any) => [m.channel_id, m]));

    const { data, error } = await supabase
      .from("internal_channels")
      .select("*")
      .in("id", channelIds)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Fetch channels error:", error);
      setLoading(false);
      return;
    }

    // For direct channels, get the other user's name
    const enriched = await Promise.all(
      (data || []).map(async (ch: any) => {
        if (ch.channel_type === "direct") {
          const { data: members } = await supabase
            .from("channel_members")
            .select("user_id")
            .eq("channel_id", ch.id)
            .neq("user_id", user.id)
            .limit(1);

          if (members && members[0]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, user_id")
              .eq("user_id", members[0].user_id)
              .single();
            ch.other_user = profile;
          }
        }

        // Get last message
        const { data: lastMsg } = await supabase
          .from("internal_messages")
          .select("content, created_at")
          .eq("channel_id", ch.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (lastMsg && lastMsg[0]) {
          ch.last_message = lastMsg[0].content;
          ch.last_message_at = lastMsg[0].created_at;
        }

        const mem = memberMap.get(ch.id);
        ch.is_pinned = mem?.is_pinned || false;
        ch.is_favorite = mem?.is_favorite || false;

        // Count unread messages (after last_read_at)
        const lastReadAt = mem?.last_read_at || ch.created_at;
        const { count } = await supabase
          .from("internal_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id)
          .neq("sender_id", user.id)
          .gt("created_at", lastReadAt);
        ch.unread_count = count || 0;

        return ch;
      })
    );

    setChannels(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchChannels();

    const channel = supabase
      .channel("internal-messages-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, () => {
        fetchChannels();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchChannels]);

  const createGroup = async (name: string, description: string, memberIds: string[]) => {
    if (!user) return null;

    const { data: ch, error } = await supabase
      .from("internal_channels")
      .insert({ name, description, channel_type: "group", created_by: user.id })
      .select()
      .single();

    if (error || !ch) { console.error(error); return null; }

    // Add creator + members
    const allMembers = [user.id, ...memberIds.filter((id) => id !== user.id)];
    await supabase.from("channel_members").insert(
      allMembers.map((uid, i) => ({
        channel_id: ch.id,
        user_id: uid,
        role: uid === user.id ? "admin" : "member",
      }))
    );

    await fetchChannels();
    return ch;
  };

  const startDirectMessage = async (otherUserId: string) => {
    if (!user) return null;

    const { data, error } = await supabase.rpc("get_or_create_dm_channel", {
      other_user_id: otherUserId,
    });

    if (error) { console.error(error); return null; }
    await fetchChannels();
    return data as string;
  };

  const togglePin = async (channelId: string, current: boolean) => {
    if (!user) return;
    await supabase
      .from("channel_members")
      .update({ is_pinned: !current })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, is_pinned: !current } : ch))
    );
  };

  const toggleFavorite = async (channelId: string, current: boolean) => {
    if (!user) return;
    await supabase
      .from("channel_members")
      .update({ is_favorite: !current })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, is_favorite: !current } : ch))
    );
  };

  return { channels, loading, refetch: fetchChannels, createGroup, startDirectMessage, togglePin, toggleFavorite };
}

export function useInternalMessages(channelId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!channelId) { setMessages([]); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from("internal_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);

    // Enrich with sender profiles
    const msgs = data || [];
    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", senderIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const enriched = msgs.map((m: any) => ({
      ...m,
      sender_profile: profileMap.get(m.sender_id) || null,
    }));

    setMessages(enriched);
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
    if (!channelId) return;

    // Mark as read when opening channel
    if (user) {
      supabase
        .from("channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.id)
        .then();
    }

    const channel = supabase
      .channel(`internal-msg-${channelId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "internal_messages",
        filter: `channel_id=eq.${channelId}`,
      }, async (payload) => {
        const newMsg = payload.new as InternalMessage;
        // Get sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", newMsg.sender_id)
          .single();
        // Play sound for messages from others
        if (newMsg.sender_id !== user?.id) {
          playChatSound();
        }
        setMessages((prev) => [...prev, { ...newMsg, sender_profile: profile }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId, fetchMessages]);

  const sendMessage = async (content: string, senderId: string, messageType = "text", mediaUrl: string | null = null) => {
    if (!channelId) return;
    if (messageType === "text" && !content.trim()) return;
    await supabase.from("internal_messages").insert({
      channel_id: channelId,
      sender_id: senderId,
      content: content.trim() || (messageType === "audio" ? "🎤 Áudio" : ""),
      message_type: messageType,
      media_url: mediaUrl,
    });
  };

  return { messages, loading, sendMessage };
}

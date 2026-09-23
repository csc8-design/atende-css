import { useEffect, useState, useCallback, useRef } from "react";
import { Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { playMessageSound } from "@/lib/notificationSound";

export interface ConversationWithContact {
  id: string;
  contact_id: string;
  assigned_agent_id: string | null;
  department_id: string | null;
  channel: string;
  status: string;
  subject: string | null;
  priority: number;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  lead_score: string | null;
  sentiment: string | null;
  last_message?: {
    content: string | null;
    message_type: string;
    sender_type: string;
    created_at: string;
  } | null;
  contacts: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    tags: string[];
    whatsapp_id: string | null;
    chatbot_name?: string | null;
    company_name?: string | null;
    cnpj?: string | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    notes?: string | null;
    assigned_agent_id?: string | null;
    interest_type?: string | null;
    desired_equipment?: string | null;
    is_reseller?: boolean | null;
    segment?: string | null;
    part_of_interest?: string | null;
    zip_code?: string | null;
    address?: string | null;
  };
  departments?: { name: string } | null;
  assigned_profile?: {
    full_name: string;
  } | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string | null;
  message_type: string;
  media_url: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
  sender_profile?: { full_name: string } | null;
  _conversation_closed_at?: string | null;
  _conversation_closing_reason?: string | null;
  _is_history?: boolean;
}

// Debounce helper
function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}

export function useConversations() {
  const { user, isManager, isAdmin } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchConversations = useCallback(async (): Promise<ConversationWithContact[]> => {
    if (!user) return [];

    const selectFields = "id, contact_id, assigned_agent_id, department_id, channel, status, subject, priority, unread_count, last_message_at, created_at, lead_score, sentiment, contacts(id, name, phone, email, avatar_url, tags, whatsapp_id, chatbot_name, company_name, cnpj, city, state, category, assigned_agent_id, notes, interest_type, desired_equipment, is_reseller, segment, part_of_interest, zip_code, address), departments(name)";

    let query = supabase
      .from("conversations")
      .select(selectFields)
      .order("last_message_at", { ascending: false })
      .limit(100);

    // RLS already restricts to: own conversations + conversations of agent's departments.
    // No client-side filter needed — agents can see and claim any conversation in their dept.

    const { data, error } = await query;
    if (error) {
      console.error("Fetch conversations error:", error);
      if (isMountedRef.current) setLoading(false);
      return [];
    }

    let result = (data as any[]) || [];

    // Also include resolved/closed conversations from the carteira.
    // - Agent: contacts assigned to himself.
    // - Supervisor (manager, not admin): contacts assigned to any agent in his departments.
    // - Admin: RLS already exposes everything, no extra fetch needed.
    try {
      let carteiraAgentIds: string[] = [];
      if (isAdmin) {
        carteiraAgentIds = [];
      } else if (isManager) {
        const { data: myDepts } = await supabase
          .from("agent_departments")
          .select("department_id")
          .eq("agent_id", user.id);
        const deptIds = (myDepts || []).map((d: any) => d.department_id);
        if (deptIds.length > 0) {
          const { data: peers } = await supabase
            .from("agent_departments")
            .select("agent_id")
            .in("department_id", deptIds);
          carteiraAgentIds = Array.from(new Set<string>((peers || []).map((p: any) => p.agent_id)));
        }
        if (!carteiraAgentIds.includes(user.id)) carteiraAgentIds.push(user.id);
      } else {
        carteiraAgentIds = [user.id];
      }

      if (carteiraAgentIds.length > 0) {
        const { data: myContacts } = await supabase
          .from("contacts")
          .select("id")
          .in("assigned_agent_id", carteiraAgentIds)
          .limit(10000);
        const myContactIds = (myContacts || []).map((c: any) => c.id);
        if (myContactIds.length > 0) {
          const existingIds = new Set(result.map((c) => c.id));
          const CHUNK = 200;
          for (let i = 0; i < myContactIds.length; i += CHUNK) {
            const slice = myContactIds.slice(i, i + CHUNK);
            const { data: extra } = await supabase
              .from("conversations")
              .select(selectFields)
              .in("contact_id", slice)
              .in("status", ["resolved", "closed"])
              .order("last_message_at", { ascending: false })
              .limit(1000);
            (extra as any[] | null)?.forEach((c) => {
              if (!existingIds.has(c.id)) {
                existingIds.add(c.id);
                result.push(c);
              }
            });
          }
        }
      }
    } catch (e) {
      console.error("Fetch carteira resolved error:", e);
    }

    // Fetch latest message per conversation
    if (result.length > 0) {
      const convIds = result.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, content, message_type, sender_type, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(500);

      const lastByConv: Record<string, any> = {};
      (msgs || []).forEach((m: any) => {
        if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
      });

      // Fetch assigned agents profiles
      const agentIds = Array.from(new Set(result.map((c) => c.assigned_agent_id).filter(Boolean)));
      const profileMap: Record<string, { full_name: string }> = {};
      if (agentIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", agentIds as string[]);
        (profs || []).forEach((p: any) => { profileMap[p.user_id] = { full_name: p.full_name }; });
      }

      result = result.map((c) => ({
        ...c,
        last_message: lastByConv[c.id] || null,
        assigned_profile: c.assigned_agent_id ? profileMap[c.assigned_agent_id] || null : null,
      }));
    }

    if (isMountedRef.current) {
      setConversations(result);
      setLoading(false);
    }
    return result;
  }, [user, isManager, isAdmin]);

  // Debounced version for realtime updates (300ms) to avoid rapid re-fetches
  const debouncedFetch = useDebouncedCallback(() => {
    fetchConversations();
  }, 300);

  useEffect(() => {
    isMountedRef.current = true;
    fetchConversations();

    // Realtime subscription with debounced refetch
    const channel = supabase
      .channel(`conversations-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          debouncedFetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const msg = payload.new as any;
          if (payload.eventType === "INSERT" && msg?.sender_type === "contact") {
            playMessageSound();
          }
          debouncedFetch();
        }
      )
      .subscribe();

    // Fallback: refetch when tab regains focus and on a slow interval
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchConversations();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fetchConversations();
    }, 20000);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, debouncedFetch]);


  return { conversations, loading, refetch: fetchConversations };
}

export function useMessages(conversationId: string | null, contactId?: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const historyLoadedRef = useRef(false);
  const historyMessagesRef = useRef<MessageRow[]>([]);
  const initialFetchCompletedRef = useRef(false);

  const appendOptimisticMessage = useCallback((message: MessageRow) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const replaceMessage = useCallback((temporaryId: string, nextMessage: MessageRow) => {
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== temporaryId);
      const alreadyExists = filtered.findIndex((m) => m.id === nextMessage.id);

      if (alreadyExists >= 0) {
        return filtered.map((m) => (m.id === nextMessage.id ? { ...m, ...nextMessage } : m));
      }

      const tempIndex = prev.findIndex((m) => m.id === temporaryId);

      if (tempIndex === -1) {
        return [...filtered, nextMessage];
      }

      const updated = [...filtered];
      updated[tempIndex] = nextMessage;
      return updated;
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const isInitialFetch = !initialFetchCompletedRef.current;
    if (isInitialFetch) setLoading(true);

    const { data: currentMsgs, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_type, sender_id, content, message_type, media_url, metadata, is_read, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch messages error:", error);
      if (isMountedRef.current) {
        if (isInitialFetch) {
          setMessages([]);
          setLoading(false);
          initialFetchCompletedRef.current = true;
        }
      }
      return;
    }

    if (isMountedRef.current) {
      const current = (currentMsgs as any[]) || [];
      setMessages(historyLoadedRef.current ? [...historyMessagesRef.current, ...current] : current);
      if (isInitialFetch) {
        setLoading(false);
        initialFetchCompletedRef.current = true;
      }
    }
  }, [conversationId]);

  // Load history on demand
  const loadHistory = useCallback(async () => {
    if (!conversationId || !contactId || historyLoadedRef.current) return;

    const { data: otherConvos } = await supabase
      .from("conversations")
      .select("id, closed_at, closing_reason")
      .eq("contact_id", contactId)
      .neq("id", conversationId)
      .in("status", ["closed", "resolved"])
      .order("closed_at", { ascending: true })
      .limit(30);

    if (!otherConvos || otherConvos.length === 0) {
      historyLoadedRef.current = true;
      return;
    }

    const otherIds = otherConvos.map(c => c.id);
    const convoMap: Record<string, { closed_at: string | null; closing_reason: string | null }> = {};
    otherConvos.forEach(c => { convoMap[c.id] = { closed_at: c.closed_at, closing_reason: c.closing_reason }; });

    const { data: histMsgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_type, sender_id, content, message_type, media_url, metadata, is_read, created_at")
      .in("conversation_id", otherIds)
      .order("created_at", { ascending: true })
      .limit(500);

    if (histMsgs && histMsgs.length > 0) {
      const enrichedHist = (histMsgs as any[]).map(m => ({
        ...m,
        _is_history: true,
        _conversation_closed_at: convoMap[m.conversation_id]?.closed_at,
        _conversation_closing_reason: convoMap[m.conversation_id]?.closing_reason,
      }));
      historyMessagesRef.current = enrichedHist;
      if (isMountedRef.current) {
        setMessages(prev => {
          const currentOnly = prev.filter(m => !(m as any)._is_history);
          return [...enrichedHist, ...currentOnly];
        });
      }
    }

    historyLoadedRef.current = true;
  }, [conversationId, contactId]);

  // Reset + fetch + subscribe when conversation changes
  useEffect(() => {
    isMountedRef.current = true;
    historyLoadedRef.current = false;
    historyMessagesRef.current = [];
    initialFetchCompletedRef.current = false;

    if (!conversationId) {
      setMessages([]);
      return;
    }

    fetchMessages();

    const histTimer = contactId
      ? setTimeout(() => loadHistory(), 200)
      : null;

    const channel = supabase
      .channel(`messages-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newMsg = payload.new as MessageRow;
          if (!newMsg?.id) return;
          if (payload.eventType === "INSERT" && newMsg.sender_type === "contact") {
            playMessageSound();
          }
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === newMsg.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...newMsg };
              return updated;
            }
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (histTimer) clearTimeout(histTimer);
      supabase.removeChannel(channel);
    };
  }, [conversationId, contactId, fetchMessages, loadHistory]);


  return {
    messages,
    loading,
    refetch: fetchMessages,
    loadHistory,
    appendOptimisticMessage,
    replaceMessage,
    removeMessage,
  };
}

export function useSendMessage() {
  const [sending, setSending] = useState(false);

  const sendMessage = async (conversationId: string, message: string, metadata?: Record<string, any>) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { conversationId, message, metadata },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error("Send message error:", error);
      return { data: null, error };
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (conversationId: string, file: File, caption?: string, metadata?: Record<string, any>) => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const maxSize = 100 * 1024 * 1024; // 100MB (limite da API do WhatsApp para documentos)
      if (file.size > maxSize) {
        throw new Error("O arquivo deve ter no máximo 100MB");
      }

      // Upload file to Supabase Storage using TUS resumable upload for large files
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const uniqueName = `${crypto.randomUUID()}.${ext}`;
      const mimeType = file.type || "application/octet-stream";

      const storageUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session: uploadSession } } = await supabase.auth.getSession();

      // Use TUS resumable upload for reliability with large files
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: `${storageUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${uploadSession?.access_token}`,
            "x-upsert": "true",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "whatsapp-media",
            objectName: uniqueName,
            contentType: mimeType,
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024, // 6MB chunks
          onError: (error: Error) => {
            console.error("TUS upload error:", error);
            reject(new Error("Falha ao enviar arquivo para o storage"));
          },
          onSuccess: () => {
            resolve();
          },
        });
        upload.findPreviousUploads().then((previousUploads) => {
          if (previousUploads.length) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        }).catch(reject);
      });

      const mediaUrl = `${storageUrl}/storage/v1/object/public/whatsapp-media/${uniqueName}`;

      // Determine message type
      let messageType = "document";
      if (mimeType.startsWith("image/")) messageType = "image";
      else if (mimeType.startsWith("video/")) messageType = "video";
      else if (mimeType.startsWith("audio/")) messageType = "audio";

      // Send via edge function with media URL (no file in body)
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            message: caption || "",
            messageType,
            mediaUrl,
            fileName: file.name,
            metadata,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send file");
      return { data: result, error: null };
    } catch (error: any) {
      console.error("Send file error:", error);
      return { data: null, error };
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, sendFile, sending };
}

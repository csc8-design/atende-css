import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ConversationList from "@/components/inbox/ConversationList";
import ChatArea from "@/components/inbox/ChatArea";
import ContactPanel from "@/components/inbox/ContactPanel";
import NewConversationModal from "@/components/inbox/NewConversationModal";
import { useConversations, ConversationWithContact } from "@/hooks/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

type ConversationPatch = Partial<ConversationWithContact> & { id: string };

const Inbox = () => {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<ConversationWithContact | null>(null);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [conversationPatches, setConversationPatches] = useState<Record<string, Partial<ConversationWithContact>>>({});
  const { conversations, loading, refetch } = useConversations();

  const mergedConversations = useMemo(() => conversations.map((conversation) => ({
    ...conversation,
    ...(conversationPatches[conversation.id] || {}),
  })), [conversations, conversationPatches]);

  const handleSelect = useCallback(async (conversation: ConversationWithContact) => {
    setSelected({
      ...conversation,
      unread_count: isAdmin ? conversation.unread_count : 0,
    });
    if (!isAdmin) {
      setConversationPatches((prev) => ({
        ...prev,
        [conversation.id]: {
          ...(prev[conversation.id] || {}),
          unread_count: 0,
        },
      }));
    }
    if (!isAdmin && conversation.unread_count > 0) {
      await supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation.id);
    }
  }, [isAdmin]);

  // Keep `selected` in sync when realtime updates the conversations list
  useEffect(() => {
    if (!selected) return;
    const fresh = mergedConversations.find(c => c.id === selected.id);
    if (fresh && fresh !== selected) {
      setSelected(fresh);
    }
  }, [mergedConversations, selected]);

  // Auto-select conversation from URL ?conversation=<id>
  useEffect(() => {
    const convId = searchParams.get("conversation");
    if (!convId || loading) return;
    const conv = mergedConversations.find(c => c.id === convId);
    if (conv && (!selected || selected.id !== convId)) {
      handleSelect(conv);
      searchParams.delete("conversation");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, mergedConversations, loading, selected, handleSelect, setSearchParams]);

  const handleConversationUpdate = async () => {
    const fresh = await refetch();
    setConversationPatches((prev) => {
      const next = { ...prev };
      fresh.forEach((conversation) => {
        delete next[conversation.id];
      });
      return next;
    });
    setSelected(prev => {
      if (!prev) return null;
      const updated = fresh.find(c => c.id === prev.id);
      return updated || null;
    });
  };

  const handleConversationPatch = useCallback((patch: ConversationPatch) => {
    setConversationPatches((prev) => ({
      ...prev,
      [patch.id]: {
        ...(prev[patch.id] || {}),
        ...patch,
      },
    }));
    setSelected((prev) => {
      if (!prev || prev.id !== patch.id) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const handleBack = () => {
    setSelected(null);
    setShowContactPanel(false);
  };

  const hideBottomNav = isMobile && (!!selected);

  // Mobile: single-panel navigation
  if (isMobile) {
    return (
      <AppLayout hideBottomNav={hideBottomNav}>
        <div className={`flex flex-col ${hideBottomNav ? 'h-[100dvh]' : 'h-[calc(100dvh-56px)]'}`}>
          {!selected ? (
            <ConversationList
              conversations={mergedConversations}
              loading={loading}
              selectedId={selected?.id}
              onSelect={handleSelect}
              onNewConversation={() => setNewConvOpen(true)}
              isMobile
            />
          ) : showContactPanel ? (
            <ContactPanel
              conversation={selected}
              onConversationUpdate={handleConversationUpdate}
              onConversationPatch={handleConversationPatch}
              isMobile
              onBack={() => setShowContactPanel(false)}
            />
          ) : (
            <ChatArea
              conversation={selected}
              onConversationPatch={handleConversationPatch}
              isMobile
              onBack={handleBack}
              onShowContact={() => setShowContactPanel(true)}
            />
          )}
        </div>

        <NewConversationModal
          open={newConvOpen}
          onClose={() => setNewConvOpen(false)}
          onConversationCreated={async (id) => {
            const fresh = await refetch();
            const conv = fresh.find(c => c.id === id);
            if (conv) setSelected(conv);
          }}
        />
      </AppLayout>
    );
  }

  // Desktop: multi-panel
  return (
    <AppLayout>
      <div className="flex h-screen overflow-hidden">
        <ConversationList
          conversations={mergedConversations}
          loading={loading}
          selectedId={selected?.id}
          onSelect={handleSelect}
          onNewConversation={() => setNewConvOpen(true)}
        />
        <ChatArea conversation={selected} onConversationPatch={handleConversationPatch} />
        <ContactPanel
          conversation={selected}
          onConversationUpdate={handleConversationUpdate}
          onConversationPatch={handleConversationPatch}
        />
      </div>

      <NewConversationModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onConversationCreated={async (id) => {
          const fresh = await refetch();
          const conv = fresh.find(c => c.id === id);
          if (conv) setSelected(conv);
        }}
      />
    </AppLayout>
  );
};

export default Inbox;

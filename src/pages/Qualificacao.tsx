import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import QualConversationList from "@/components/qualification/QualConversationList";
import QualChatArea from "@/components/qualification/QualChatArea";
import QualAIPanel from "@/components/qualification/QualAIPanel";
import { useQualConversations, useQualMessages, useQualQualification, useQualificationsMap } from "@/hooks/useQualification";
import { useAuth } from "@/contexts/AuthContext";
import { EVOLUTION_ENABLED } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";


export default function Qualificacao() {
  const { user, isAdmin, isManager, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!EVOLUTION_ENABLED) { setAllowed(false); return; }
    if (isAdmin || isManager) { setAllowed(true); return; }
    setAllowed(false);
  }, [user, isAdmin, isManager]);

  const { items } = useQualConversations();
  const qualifications = useQualificationsMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);


  // Auto-select first conversation
  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selected = items.find((c) => c.id === selectedId) || null;
  const { items: messages } = useQualMessages(selectedId);
  const { data: qualification, analyzing, triggerAnalysis, scheduleAnalysis, setDisqualified, setCriterionManual } = useQualQualification(selectedId);

  // Debounce 10s after new messages
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (!selectedId) return;
    if (messages.length === 0) return;
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      scheduleAnalysis();
    }
  }, [messages.length, selectedId, scheduleAnalysis]);

  if (authLoading || allowed === null) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando...</div>
      </AppLayout>
    );
  }
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        <div className="w-[300px] flex-shrink-0">
          <QualConversationList items={items} qualifications={qualifications} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        {showHistory && isAdmin && (
          <QualChatArea conversation={selected} messages={messages} />
        )}
        <QualAIPanel
          conversation={selected}
          qualification={qualification}
          analyzing={analyzing}
          onReanalyze={() => triggerAnalysis(true)}
          onSetDisqualified={setDisqualified}
          onSetCriterionManual={setCriterionManual}
          expanded={!showHistory}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((v) => !v)}
        />
      </div>
    </AppLayout>
  );
}

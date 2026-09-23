import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { Send, Paperclip, Smile, MoreVertical, Phone, Video, FileText, Download, X, Pencil, Trash2, Check, Mic, Square, Zap, Reply, CornerDownRight, Flame, Thermometer, Snowflake, TrendingUp, Loader2, ArrowLeft, UserCircle, ArrowRightLeft, Building2, ChevronDown, BriefcaseBusiness, BookmarkPlus, BookmarkCheck } from "lucide-react";
import chatBg from "@/assets/chat-bg.jpg";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDepartmentIcon } from "@/lib/departmentIcon";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ConversationWithContact, useMessages, useSendMessage, MessageRow } from "@/hooks/useConversations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChannelBadge from "@/components/shared/ChannelBadge";
import { maskPhone } from "@/lib/maskPhone";

import { toast } from "sonner";

interface QuickReplyItem {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
}

const MediaContent = ({ msg }: { msg: any }) => {
  const { message_type, media_url, content } = msg;

  if (!media_url) return <p>{content}</p>;

  switch (message_type) {
    case "image":
      return (
        <div>
          <img
            src={media_url}
            alt="Imagem"
            className="max-w-full rounded-lg cursor-pointer"
            onClick={() => window.open(media_url, "_blank")}
          />
          {content && <p className="mt-1">{content}</p>}
        </div>
      );
    case "video":
      return (
        <div>
          <video controls className="max-w-full rounded-lg">
            <source src={media_url} />
          </video>
          {content && <p className="mt-1">{content}</p>}
        </div>
      );
    case "audio": {
      const transcript = (msg.metadata as any)?.audio_transcript;
      return (
        <div>
          <audio controls className="w-full min-w-[200px]">
            <source src={media_url} />
          </audio>
          {transcript && (
            <div className="mt-1.5 px-2 py-1.5 bg-background/50 rounded-md border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground mb-0.5 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Transcrição
              </p>
              <p className="text-xs text-foreground leading-relaxed">{transcript}</p>
            </div>
          )}
          {!transcript && content && <p className="mt-1 text-xs italic text-muted-foreground">{content}</p>}
        </div>
      );
    }
    case "document":
      return (
        <a
          href={media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
        >
          <FileText className="w-8 h-8 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{content || "Documento"}</p>
          </div>
          <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </a>
      );
    case "sticker":
      return (
        <img
          src={media_url}
          alt="Sticker"
          className="w-32 h-32 object-contain"
        />
      );
    default:
      return <p>{content}</p>;
  }
};

interface ChatAreaProps {
  conversation: ConversationWithContact | null;
  isMobile?: boolean;
  onBack?: () => void;
  onShowContact?: () => void;
  onConversationPatch?: (patch: Partial<ConversationWithContact> & { id: string }) => void;
}

const ChatArea = ({ conversation, isMobile, onBack, onShowContact, onConversationPatch }: ChatAreaProps) => {
  const { user, profile, isManager, isAdmin } = useAuth();
  const { analysis, analyzing, suggestions, markSuggestionUsed } = useAIAnalysis(conversation?.id || null);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [editText, setEditText] = useState("");
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    messages,
    loading,
    refetch,
    appendOptimisticMessage,
    replaceMessage,
    removeMessage,
  } = useMessages(conversation?.id || null, conversation?.contact_id || null);
  const { sendMessage, sendFile, sending } = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const pendingInitialScrollRef = useRef<string | null>(null);
  const initialScrollInProgressRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");
  const [selectedQRIndex, setSelectedQRIndex] = useState(0);
  const [phoneWarningOpen, setPhoneWarningOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [sensitiveType, setSensitiveType] = useState<"phone" | "email" | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);
  const [transferringDept, setTransferringDept] = useState(false);
  const [pickAgentForDept, setPickAgentForDept] = useState<{ id: string; name: string } | null>(null);
  const [deptAgents, setDeptAgents] = useState<{ user_id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [loadingDeptAgents, setLoadingDeptAgents] = useState(false);
  const [claimingPortfolio, setClaimingPortfolio] = useState(false);
  const [contactOwnerId, setContactOwnerId] = useState<string | null>(null);
  const [contactOwnerName, setContactOwnerName] = useState<string | null>(null);

  useEffect(() => {
    setContactOwnerId(((conversation?.contacts as any)?.assigned_agent_id) ?? null);
  }, [conversation?.id, (conversation?.contacts as any)?.assigned_agent_id]);

  useEffect(() => {
    if (!contactOwnerId) { setContactOwnerName(null); return; }
    if (contactOwnerId === user?.id) { setContactOwnerName(null); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", contactOwnerId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setContactOwnerName((data as any)?.full_name ?? null); });
    return () => { cancelled = true; };
  }, [contactOwnerId, user?.id]);


  const handleClaimPortfolio = async () => {
    if (!conversation || !user) return;
    setClaimingPortfolio(true);
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: user.id })
      .eq("id", conversation.contact_id)
      .is("assigned_agent_id", null);
    setClaimingPortfolio(false);
    if (error) {
      toast.error(`Não foi possível adicionar à carteira: ${error.message}`);
    } else {
      setContactOwnerId(user.id);
      toast.success("Cliente adicionado à sua carteira");
    }
  };

  const handleRemoveFromPortfolio = async () => {
    if (!conversation || !user) return;
    if (!confirm("Remover este cliente da sua carteira?")) return;
    setClaimingPortfolio(true);
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: null })
      .eq("id", conversation.contact_id)
      .eq("assigned_agent_id", user.id);
    setClaimingPortfolio(false);
    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
    } else {
      setContactOwnerId(null);
      toast.success("Cliente removido da sua carteira");
    }
  };

  const handleTakeOverPortfolio = async () => {
    if (!conversation || !user) return;
    if (!confirm("Este cliente está na carteira de outro agente. Deseja movê-lo para a sua?")) return;
    setClaimingPortfolio(true);
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: user.id })
      .eq("id", conversation.contact_id);
    setClaimingPortfolio(false);
    if (error) {
      toast.error(`Não foi possível assumir: ${error.message}`);
    } else {
      setContactOwnerId(user.id);
      toast.success("Cliente movido para sua carteira");
    }
  };

  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false);
  const [portfolioView, setPortfolioView] = useState<"menu" | "transfer">("menu");
  const [portfolioAgents, setPortfolioAgents] = useState<{ user_id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [portfolioAgentSearch, setPortfolioAgentSearch] = useState("");
  const [loadingPortfolioAgents, setLoadingPortfolioAgents] = useState(false);

  const openPortfolioTransfer = async () => {
    setPortfolioView("transfer");
    if (portfolioAgents.length === 0) {
      setLoadingPortfolioAgents(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, is_active")
        .eq("is_active", true)
        .order("full_name");
      setPortfolioAgents(((data || []) as any[])
        .filter((p) => p.user_id !== user?.id)
        .map((p) => ({ user_id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url })));
      setLoadingPortfolioAgents(false);
    }
  };

  const handleTransferPortfolio = async (agentId: string) => {
    if (!conversation) return;
    setClaimingPortfolio(true);
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: agentId })
      .eq("id", conversation.contact_id);
    setClaimingPortfolio(false);
    if (error) {
      toast.error(`Erro ao transferir: ${error.message}`);
    } else {
      setContactOwnerId(agentId);
      toast.success("Cliente transferido de carteira");
      setPortfolioMenuOpen(false);
      setPortfolioView("menu");
    }
  };


  // Fetch departments for header dept switcher
  useEffect(() => {
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => { if (data) setDepartments(data); });
  }, []);

  const handleQuickTransferDept = async (deptId: string, deptName: string) => {
    if (!conversation || deptId === conversation.department_id) {
      setDeptPopoverOpen(false);
      return;
    }
    // Load agents linked to this department
    setLoadingDeptAgents(true);
    setPickAgentForDept({ id: deptId, name: deptName });
    setDeptPopoverOpen(false);
    const { data: links } = await supabase
      .from("agent_departments")
      .select("agent_id")
      .eq("department_id", deptId);
    const ids = (links || []).map((l: any) => l.agent_id);
    if (ids.length === 0) {
      setDeptAgents([]);
      setLoadingDeptAgents(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, is_active")
      .in("user_id", ids)
      .eq("is_active", true)
      .order("full_name");
    setDeptAgents(((profs || []) as any).map((p: any) => ({
      user_id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url,
    })));
    setLoadingDeptAgents(false);
  };

  const performTransfer = async (deptId: string, agentId: string | null) => {
    if (!conversation) return;
    const previousDeptId = conversation.department_id;
    const deptName = departments.find((d) => d.id === deptId)?.name || pickAgentForDept?.name;
    setTransferringDept(true);

    // Send auto-message BEFORE transfer so signature uses current agent's setor
    if (deptName && deptId !== previousDeptId) {
      try {
        await supabase.functions.invoke("send-whatsapp", {
          body: {
            conversationId: conversation.id,
            message: `_Você está sendo direcionado para o setor ${deptName}, por favor aguarde que um atendente entrará em contato em breve. Aguarde um momento!_ 🙋`,
          },
        });
      } catch (err) {
        console.error("Auto transfer message error:", err);
      }
    }

    const { error } = await supabase.rpc("transfer_conversation", {
      _conversation_id: conversation.id,
      _department_id: deptId,
      _agent_id: agentId,
      _status: null,
    });
    setTransferringDept(false);
    setPickAgentForDept(null);
    setDeptAgents([]);
    if (error) {
      toast.error(`Erro ao transferir: ${error.message}`);
    } else {
      toast.success(agentId ? "Transferido para o atendente" : "Departamento alterado");
    }
  };

  // Build a map of message id -> message for quick lookup (for quoted replies)
  const messagesMap = useMemo(() => {
    const map: Record<string, MessageRow> = {};
    messages.forEach(m => { map[m.id] = m; });
    return map;
  }, [messages]);

  // Whether the conversation is assigned to the current user
  const isAssignedToMe = !!conversation && !!user && conversation.assigned_agent_id === user.id;
  const hasAssignedAgent = !!conversation?.assigned_agent_id;
  // Envio só permitido se o usuário estiver atribuído à conversa (vale inclusive para admin/manager)
  const canSend = isAssignedToMe;

  // 24h window check (WhatsApp): last inbound message from contact must be < 24h
  const lastContactMsgAt = useMemo(() => {
    let latest: number | null = null;
    for (const m of messages) {
      if (m.sender_type === "contact") {
        const t = new Date(m.created_at).getTime();
        if (latest === null || t > latest) latest = t;
      }
    }
    return latest;
  }, [messages]);
  const isOutside24h = lastContactMsgAt !== null && (Date.now() - lastContactMsgAt) > 24 * 60 * 60 * 1000;

  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Registry of Meta-approved templates available for out-of-24h reengagement.
  // Add new entries here as more templates are approved.
  const contactFirstName = (conversation?.contacts?.name || "Cliente").split(/\s+/)[0];
  const agentFullName = (profile?.full_name || "Atendente").trim();
  const agentShort = (() => {
    const parts = agentFullName.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
  })();

  const REENGAGE_TEMPLATES = useMemo(() => ([
    {
      id: "padrao_inicial",
      label: "Padrão Inicial",
      category: "Abertura",
      language: "pt_BR",
      body: `Olá, aqui é o ${agentShort}. Em que posso ajuda-lo?`,
      params: [agentShort],
    },
    {
      id: "follow_up",
      label: "Follow-up",
      category: "Reengajamento",
      language: "pt_BR",
      body:
        `Olá, ${contactFirstName}. Aqui é o ${agentShort} da CBmaq.\n\n` +
        `Vi que faz um tempo que não nos falamos. Podemos ajudar em algo?`,
      params: [contactFirstName, agentShort],
    },
  ]), [contactFirstName, agentShort]);

  const handleSendTemplate = async (tpl: typeof REENGAGE_TEMPLATES[number]) => {
    if (!conversation) return;
    setSendingTemplate(tpl.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          conversationId: conversation.id,
          templateName: tpl.id,
          templateLanguage: tpl.language,
          message: tpl.body,
          templateComponents: [
            {
              type: "body",
              parameters: tpl.params.map((p) => ({ type: "text", text: p })),
            },
          ],
        },
      });
      if (error) throw error;

      // Replace the "[Template: xxx] ..." saved content with the clean rendered body
      const savedId = (data as any)?.message?.id;
      if (savedId) {
        await supabase
          .from("messages")
          .update({ content: tpl.body })
          .eq("id", savedId);
      }

      toast.success(`Template "${tpl.label}" enviado`);
      setTemplateModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(`Erro ao enviar template: ${err?.message || err}`);
    } finally {
      setSendingTemplate(null);
    }
  };

  // Clear replyingTo when conversation changes
  useEffect(() => {
    setReplyingTo(null);
    setMessage("");
  }, [conversation?.id]);


  // Fetch quick replies once
  useEffect(() => {
    const fetchQR = async () => {
      const { data } = await supabase
        .from("quick_replies")
        .select("id, title, content, shortcut")
        .order("title");
      if (data) setQuickReplies(data as QuickReplyItem[]);
    };
    fetchQR();
  }, []);

  const filteredQuickReplies = useMemo(() => {
    if (!quickReplyFilter) return quickReplies;
    const q = quickReplyFilter.toLowerCase();
    return quickReplies.filter(r =>
      (r.shortcut || "").toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q)
    );
  }, [quickReplies, quickReplyFilter]);

  const [agentProfiles, setAgentProfiles] = useState<Record<string, { full_name: string; avatar_url: string | null }>>({});

  const pushConversationPreview = useCallback((payload: {
    content: string;
    messageType: string;
    createdAt: string;
    assignedAgentId?: string | null;
    assignedProfileName?: string | null;
    status?: string;
  }) => {
    if (!conversation) return;

    onConversationPatch?.({
      id: conversation.id,
      last_message_at: payload.createdAt,
      unread_count: 0,
      status: payload.status || conversation.status,
      assigned_agent_id: payload.assignedAgentId ?? conversation.assigned_agent_id,
      assigned_profile: payload.assignedProfileName
        ? { full_name: payload.assignedProfileName }
        : conversation.assigned_profile || null,
      last_message: {
        content: payload.content,
        message_type: payload.messageType,
        sender_type: "agent",
        created_at: payload.createdAt,
      },
    });
  }, [conversation, onConversationPatch]);

  const buildOptimisticMessage = useCallback((payload: {
    content: string;
    messageType: string;
    metadata?: Record<string, any>;
  }): MessageRow | null => {
    if (!conversation || !user) return null;

    return {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conversation.id,
      sender_type: "agent",
      sender_id: user.id,
      content: payload.content,
      message_type: payload.messageType,
      media_url: null,
      metadata: payload.metadata || null,
      is_read: true,
      created_at: new Date().toISOString(),
      sender_profile: profile ? { full_name: profile.full_name } : null,
    };
  }, [conversation, user, profile]);

  // Fetch agent profiles for all agent messages
  useEffect(() => {
    const agentIds = [...new Set(
      messages
        .filter(m => m.sender_type === "agent" && m.sender_id)
        .map(m => m.sender_id!)
    )];
    if (agentIds.length === 0) return;

    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", agentIds);
      if (data) {
        const map: Record<string, { full_name: string; avatar_url: string | null }> = {};
        data.forEach(p => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
        setAgentProfiles(map);
      }
    };
    fetchProfiles();
  }, [messages]);

  const handleEditSave = async () => {
    if (!editingMsgId || !editText.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: editText.trim() })
      .eq("id", editingMsgId);
    if (error) {
      toast.error("Erro ao editar mensagem");
      console.error(error);
    } else {
      toast.success("Mensagem editada");
      refetch();
    }
    setEditingMsgId(null);
    setEditText("");
  };

  const notifyDeletion = async (type: "message" | "conversation", content: string) => {
    if (!user || !conversation) return;
    try {
      const { data: supervisorRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "manager"]);
      if (!supervisorRoles || supervisorRoles.length === 0) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const agentName = profile?.full_name || "Usuário";
      const contactName = conversation.contacts.name;
      const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;

      const notifications = supervisorRoles
        .filter(r => r.user_id !== user.id)
        .map(r => ({
          user_id: r.user_id,
          type: "deletion_alert",
          title: type === "message" ? "🗑️ Mensagem excluída" : "🗑️ Atendimento excluído",
          body: type === "message"
            ? `${agentName} excluiu uma mensagem na conversa com "${contactName}". Conteúdo: "${preview}"`
            : `${agentName} excluiu o atendimento completo com "${contactName}".`,
          reference_id: conversation.id,
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }
    } catch (err) {
      console.error("Error notifying deletion:", err);
    }
  };

  const handleDelete = async (msgId: string) => {
    setDeletingMsg(true);
    const msgToDelete = messages.find(m => m.id === msgId);
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", msgId);
    if (error) {
      toast.error("Erro ao excluir mensagem");
      console.error(error);
    } else {
      await notifyDeletion("message", msgToDelete?.content || "(mídia)");
      toast.success("Mensagem excluída");
      refetch();
    }
    setDeleteMsgId(null);
    setDeletingMsg(false);
    setMenuMsgId(null);
  };

  // Mantém o fim apenas enquanto o usuário já estiver no fim da conversa.
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || initialScrollInProgressRef.current) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }, []);

  // Ao trocar de conversa, aguarda as mensagens carregarem para posicionar uma única vez.
  useEffect(() => {
    if (!conversation?.id) return;
    stickToBottomRef.current = true;
    initialScrollInProgressRef.current = true;
    pendingInitialScrollRef.current = conversation.id;
  }, [conversation?.id]);

  // Posiciona antes da pintura e acompanha apenas o carregamento inicial do histórico/mídias.
  useLayoutEffect(() => {
    if (loading || !conversation?.id || pendingInitialScrollRef.current !== conversation.id) return;
    const convId = conversation.id;
    const container = scrollContainerRef.current;
    if (!container) return;

    const keepAtBottom = () => {
      if (conversation.id === convId) scrollToBottom();
    };

    keepAtBottom();
    const frame = window.requestAnimationFrame(keepAtBottom);
    const observer = new ResizeObserver(keepAtBottom);
    observer.observe(container);
    if (container.firstElementChild) observer.observe(container.firstElementChild);

    const finish = window.setTimeout(() => {
      keepAtBottom();
      observer.disconnect();
      pendingInitialScrollRef.current = null;
      initialScrollInProgressRef.current = false;
      stickToBottomRef.current = true;
    }, 1000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(finish);
      observer.disconnect();
      if (pendingInitialScrollRef.current === convId) {
        initialScrollInProgressRef.current = false;
      }
    };
  }, [conversation?.id, loading, messages.length, scrollToBottom]);


  // Realtime adiciona a mensagem sem mover quem está consultando o histórico.
  useEffect(() => {
    if (messages.length === 0) return;
    if (stickToBottomRef.current) scrollToBottom(true);
  }, [messages.length, scrollToBottom]);


  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: "audio/webm" });
        if (conversation) {
          await sendFile(conversation.id, file);
        }
        setRecordingTime(0);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  }, [conversation, sendFile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current!.stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Keywords that indicate phone or email request
  const PHONE_REQUEST_KEYWORDS = [
    "telefone", "número", "numero", "celular", "whatsapp", "zap",
    "contato", "fone", "ligar", "ligação", "me passa o número",
    "qual o telefone", "qual o número", "qual seu telefone",
    "qual seu número", "me manda o telefone", "me envia o telefone",
    "pode me passar", "me informa o telefone", "me dá o telefone",
  ];

  const EMAIL_REQUEST_KEYWORDS = [
    "email", "e-mail", "correio", "endereço de email",
    "qual o email", "qual seu email", "me passa o email",
    "me envia o email", "me manda o email", "me informa o email",
    "me dá o email", "qual e-mail", "me passa o e-mail",
  ];

  const containsSensitiveRequest = (text: string): "phone" | "email" | null => {
    const lower = text.toLowerCase();
    if (PHONE_REQUEST_KEYWORDS.some(kw => lower.includes(kw))) return "phone";
    if (EMAIL_REQUEST_KEYWORDS.some(kw => lower.includes(kw))) return "email";
    return null;
  };

  const notifyAdminsAboutSensitiveRequest = async (type: "phone" | "email") => {
    if (!user || !conversation) return;
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (!adminRoles || adminRoles.length === 0) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const agentName = profile?.full_name || "Agente";
    const contactName = conversation.contacts.name;
    const label = type === "phone" ? "telefone" : "email";

    const notifications = adminRoles.map(r => ({
      user_id: r.user_id,
      type: `${type}_request_alert`,
      title: `⚠️ Solicitação de ${label}`,
      body: `O agente ${agentName} solicitou o ${label} do contato "${contactName}" durante o atendimento.`,
      reference_id: conversation.id,
    }));

    await supabase.from("notifications").insert(notifications);
  };



  const handleSend = async () => {
    if (sending || !conversation) return;
    if (!canSend) {
      toast.error("Você precisa estar atribuído a este atendimento para enviar mensagens.");
      return;
    }

    // Check if agent (not admin/manager) is requesting sensitive info
    if (!isAdmin && !isManager && message.trim()) {
      const detected = containsSensitiveRequest(message.trim());
      if (detected) {
        setPendingMessage(message.trim());
        setSensitiveType(detected);
        setPhoneWarningOpen(true);
        return;
      }
    }

    await executeSend();
  };

  const handleConfirmPhoneRequest = async () => {
    setPhoneWarningOpen(false);
    // Notify admins
    await notifyAdminsAboutSensitiveRequest(sensitiveType || "phone");
    setSensitiveType(null);
    // Proceed with send using the pending message
    const textToSend = pendingMessage || "";
    setPendingMessage(null);
    if (!conversation || !textToSend) return;
    await executeSend(textToSend);
  };

  const handleCancelPhoneRequest = () => {
    setPhoneWarningOpen(false);
    setPendingMessage(null);
  };

  const executeSend = async (overrideText?: string) => {
    if (!conversation || !user) return;

    // Build metadata with reply info
    const activeReply = replyingTo;
    const metadata: Record<string, any> = activeReply ? {
      reply_to_id: activeReply.id,
      reply_to_content: (activeReply.content || "").slice(0, 200),
      reply_to_sender_type: activeReply.sender_type,
      reply_to_sender_name: activeReply.sender_type === "agent" && activeReply.sender_id
        ? agentProfiles[activeReply.sender_id]?.full_name || "Agente"
        : conversation.contacts.name,
    } : {};

    const draftText = overrideText ?? message;
    const trimmedText = draftText.trim();

    if (selectedFile) {
      const fileToSend = selectedFile;
      const optimisticType = fileToSend.type.startsWith("image/")
        ? "image"
        : fileToSend.type.startsWith("video/")
        ? "video"
        : fileToSend.type.startsWith("audio/")
        ? "audio"
        : "document";
      const optimisticContent = trimmedText || fileToSend.name;
      const optimisticMessage = buildOptimisticMessage({
        content: optimisticContent,
        messageType: optimisticType,
        metadata,
      });

      if (optimisticMessage) {
        appendOptimisticMessage(optimisticMessage);
        pushConversationPreview({
          content: optimisticContent,
          messageType: optimisticType,
          createdAt: optimisticMessage.created_at,
        });
      }

      setSelectedFile(null);
      setFilePreview(null);
      setMessage("");
      setReplyingTo(null);

      const { data, error } = await sendFile(conversation.id, fileToSend, trimmedText || undefined, metadata);
      if (error || !data?.message) {
        if (optimisticMessage) removeMessage(optimisticMessage.id);
        toast.error(error?.message || "Erro ao enviar arquivo");
        await refetch();
        return;
      }

      if (optimisticMessage) {
        replaceMessage(optimisticMessage.id, data.message as MessageRow);
      }
      pushConversationPreview({
        content: (data.message?.content as string) || optimisticContent,
        messageType: (data.message?.message_type as string) || optimisticType,
        createdAt: (data.message?.created_at as string) || optimisticMessage?.created_at || new Date().toISOString(),
      });
      return;
    }

    if (!trimmedText) return;
    const optimisticMessage = buildOptimisticMessage({
      content: trimmedText,
      messageType: "text",
      metadata,
    });

    setMessage("");
    setReplyingTo(null);

    if (optimisticMessage) {
      appendOptimisticMessage(optimisticMessage);
      pushConversationPreview({
        content: trimmedText,
        messageType: "text",
        createdAt: optimisticMessage.created_at,
      });
    }

    const { data, error } = await sendMessage(conversation.id, trimmedText, metadata);
    if (error || !data?.message) {
      if (optimisticMessage) removeMessage(optimisticMessage.id);
      setMessage(draftText);
      if (activeReply) setReplyingTo(activeReply);
      toast.error(error?.message || "Erro ao enviar mensagem");
      await refetch();
      return;
    }

    if (optimisticMessage) {
      replaceMessage(optimisticMessage.id, data.message as MessageRow);
    }
    pushConversationPreview({
      content: (data.message?.content as string) || trimmedText,
      messageType: (data.message?.message_type as string) || "text",
      createdAt: (data.message?.created_at as string) || optimisticMessage?.created_at || new Date().toISOString(),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 100 * 1024 * 1024; // 100MB (limite da API do WhatsApp)
    if (file.size > maxSize) {
      toast.error("O arquivo deve ter no máximo 100MB");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
    e.target.value = "";
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
  };

  const handleReply = (msg: MessageRow) => {
    setReplyingTo(msg);
    textareaRef.current?.focus();
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
    }
  };

  // Get reply info from message metadata
  const getReplyInfo = (msg: MessageRow) => {
    const meta = msg.metadata as any;
    if (!meta?.reply_to_id) return null;
    return {
      id: meta.reply_to_id,
      content: meta.reply_to_content || "",
      senderType: meta.reply_to_sender_type || "contact",
      senderName: meta.reply_to_sender_name || "Contato",
    };
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-secondary/30">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Selecione uma conversa</h3>
          <p className="text-sm text-muted-foreground">Escolha uma conversa para começar a atender</p>
        </div>
      </div>
    );
  }

  const handleMessageChange = (val: string) => {
    setMessage(val);
    if (val.startsWith("/")) {
      setShowQuickReplies(true);
      setQuickReplyFilter(val.slice(1));
      setSelectedQRIndex(0);
    } else {
      setShowQuickReplies(false);
    }
  };

  const selectQuickReply = (reply: QuickReplyItem) => {
    setMessage(reply.content);
    setShowQuickReplies(false);
    setQuickReplyFilter("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showQuickReplies && filteredQuickReplies.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedQRIndex(i => Math.min(i + 1, filteredQuickReplies.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedQRIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectQuickReply(filteredQuickReplies[selectedQRIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowQuickReplies(false);
        return;
      }
    }
    if (e.key === "Escape" && replyingTo) {
      setReplyingTo(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = conversation.contacts.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className={`flex-1 flex flex-col bg-background min-w-0 ${isMobile ? 'h-full overflow-hidden' : 'overflow-hidden'}`}>
      {/* Chat Header */}
      <div className={`${isMobile ? "h-14 sticky top-0 z-20" : "h-16"} border-b border-border flex items-center justify-between px-3 md:px-5 bg-card flex-shrink-0`}>
        <div className="flex items-center gap-2 md:gap-3">
          {isMobile && onBack && (
            <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-secondary text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="relative">
            <Avatar className="w-9 h-9">
              <AvatarImage src={conversation.contacts.avatar_url || undefined} alt={conversation.contacts.name} />
              <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5">
              <ChannelBadge channel={conversation.channel as any} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground truncate">{conversation.contacts.name}</h3>
              {(conversation.contacts as any).chatbot_name &&
                (conversation.contacts as any).chatbot_name !== conversation.contacts.name && (
                <span className="text-xs text-muted-foreground truncate">
                  · Nome do Cliente: <span className="text-foreground font-medium">{(conversation.contacts as any).chatbot_name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="truncate">{conversation.contacts.phone}</span>
              <span className="opacity-50">·</span>
              <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    title="Clique para trocar de departamento"
                    className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border transition-all hover:shadow-sm ${
                      conversation.departments?.name
                        ? 'text-primary border-primary/30 bg-primary/5 hover:bg-primary/10'
                        : 'italic text-muted-foreground border-dashed border-muted-foreground/40 hover:bg-secondary'
                    }`}
                  >
                    {(() => { const Ic = getDepartmentIcon(conversation.departments?.name); return <Ic className="w-3.5 h-3.5" />; })()}
                    <span className="truncate max-w-[140px]">
                      {conversation.departments?.name || 'Atribuir departamento'}
                    </span>
                    {transferringDept ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-transform group-data-[state=open]:rotate-180" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 border-b">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Transferir departamento
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {departments.map((d) => {
                      const isCurrent = d.id === conversation.department_id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleQuickTransferDept(d.id, d.name)}
                          disabled={isCurrent || transferringDept}
                          className={`group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm rounded-md text-left transition-colors ${
                            isCurrent
                              ? 'bg-primary/10 text-primary cursor-default'
                              : 'hover:bg-secondary text-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {(() => { const Ic = getDepartmentIcon(d.name); return <Ic className="w-4 h-4 flex-shrink-0" />; })()}
                            <span className="truncate font-medium">{d.name}</span>
                          </span>
                          {isCurrent ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase">
                              <Check className="w-3.5 h-3.5" /> Atual
                            </span>
                          ) : (
                            <ArrowRightLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {conversation.departments?.name === "Comercial" && conversation.contacts.phone && (
            <a
              href={`https://web.whatsapp.com/send?phone=${conversation.contacts.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no WhatsApp Web"
              className="p-2 rounded-lg hover:bg-secondary text-channel-whatsapp transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.94 11.94 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.89c0 2.1.55 4.14 1.6 5.94L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.17-3.44-8.43zM12.07 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.76.98 1-3.67-.24-.38a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.46-4.44 9.91-9.87 9.91zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/>
              </svg>
            </a>
          )}
          {/* Portfolio / Carteira menu */}
          <Popover
            open={portfolioMenuOpen}
            onOpenChange={(o) => { setPortfolioMenuOpen(o); if (!o) { setPortfolioView("menu"); setPortfolioAgentSearch(""); } }}
          >
            <PopoverTrigger asChild>
              <button
                disabled={claimingPortfolio}
                title="Gerenciar carteira"
                className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 mr-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 ${
                  contactOwnerId === null
                    ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                    : contactOwnerId === user?.id
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                    : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                {claimingPortfolio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : contactOwnerId === null ? (
                  <BookmarkPlus className="w-3.5 h-3.5" />
                ) : contactOwnerId === user?.id ? (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                ) : (
                  <BriefcaseBusiness className="w-3.5 h-3.5" />
                )}
                <span>
                  {contactOwnerId === null
                    ? "Adicionar à minha carteira"
                    : contactOwnerId === user?.id
                    ? "Na minha carteira"
                    : `Em carteira${contactOwnerName ? ` de ${contactOwnerName}` : ""}`}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              {portfolioView === "menu" ? (
                <div className="flex flex-col">
                  <button
                    disabled={claimingPortfolio || contactOwnerId === user?.id}
                    onClick={async () => {
                      if (contactOwnerId === null) {
                        await handleClaimPortfolio();
                      } else if (contactOwnerId !== user?.id) {
                        await handleTakeOverPortfolio();
                      }
                      setPortfolioMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BookmarkPlus className="w-4 h-4 text-primary" />
                    <span>Atribuir à minha carteira</span>
                  </button>
                  <button
                    disabled={claimingPortfolio}
                    onClick={openPortfolioTransfer}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary text-left"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                    <span>Transferir de carteira</span>
                  </button>
                  <button
                    disabled={claimingPortfolio || contactOwnerId === null}
                    onClick={async () => {
                      if (!conversation) return;
                      setClaimingPortfolio(true);
                      const { error } = await supabase
                        .from("contacts")
                        .update({ assigned_agent_id: null })
                        .eq("id", conversation.contact_id);
                      setClaimingPortfolio(false);
                      if (error) {
                        toast.error(`Erro ao remover: ${error.message}`);
                      } else {
                        setContactOwnerId(null);
                        toast.success("Cliente removido da carteira");
                        setPortfolioMenuOpen(false);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-destructive/10 text-destructive text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir da carteira</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
                    <button
                      onClick={() => setPortfolioView("menu")}
                      className="p-1 rounded hover:bg-secondary"
                      title="Voltar"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <input
                      autoFocus
                      value={portfolioAgentSearch}
                      onChange={(e) => setPortfolioAgentSearch(e.target.value)}
                      placeholder="Buscar agente..."
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {loadingPortfolioAgents ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : portfolioAgents.filter((a) => a.full_name?.toLowerCase().includes(portfolioAgentSearch.toLowerCase())).length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-3">Nenhum agente</div>
                    ) : (
                      portfolioAgents
                        .filter((a) => a.full_name?.toLowerCase().includes(portfolioAgentSearch.toLowerCase()))
                        .map((a) => (
                          <button
                            key={a.user_id}
                            disabled={claimingPortfolio || a.user_id === contactOwnerId}
                            onClick={() => handleTransferPortfolio(a.user_id)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary text-left disabled:opacity-50"
                          >
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={a.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">{a.full_name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{a.full_name}</span>
                            {a.user_id === contactOwnerId && (
                              <span className="ml-auto text-[10px] text-muted-foreground">atual</span>
                            )}
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {!isMobile && (
            <>
              <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <Phone className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          {isMobile && onShowContact && (
            <button onClick={onShowContact} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <UserCircle className="w-5 h-5" />
            </button>
          )}
          <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-time Negotiation Indicator */}
      {conversation && !isMobile && (
        <div className="px-5 py-2 border-b border-border bg-card flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Negociação:</span>
            {analyzing ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analisando...
              </div>
            ) : analysis?.lead_score ? (
              <>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-[200px]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      analysis.lead_score === 'quente'
                        ? 'bg-green-500 w-full'
                        : analysis.lead_score === 'morno'
                        ? 'bg-orange-400 w-2/3'
                        : 'bg-muted-foreground/40 w-1/4'
                    }`}
                  />
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    analysis.lead_score === 'quente'
                      ? 'bg-green-500/15 text-green-600'
                      : analysis.lead_score === 'morno'
                      ? 'bg-orange-500/15 text-orange-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {analysis.lead_score === 'quente' ? (
                    <><Flame className="w-3 h-3" /> Alta chance</>
                  ) : analysis.lead_score === 'morno' ? (
                    <><Thermometer className="w-3 h-3" /> Moderada</>
                  ) : (
                    <><Snowflake className="w-3 h-3" /> Baixa</>
                  )}
                </span>
                {analysis.sentiment && (
                  <span className="text-[11px] text-muted-foreground">
                    • Humor: {
                      analysis.sentiment === 'positivo' ? '😊' :
                      analysis.sentiment === 'satisfeito' ? '😄' :
                      analysis.sentiment === 'neutro' ? '😐' :
                      analysis.sentiment === 'negativo' ? '😟' : '😡'
                    }
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Aguardando mensagens para análise...</span>
            )}
          </div>
        </div>
      )}

      {/* Claim banner: unassigned OR assigned to someone else (same dept via RLS) */}
      {!isAssignedToMe && (
        <div className="px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {hasAssignedAgent
              ? `Este atendimento está com ${conversation.assigned_profile?.full_name || "outro agente"}. Você pode assumi-lo.`
              : "Este atendimento ainda não foi assumido por nenhum agente."}
          </p>
          <button
            onClick={async () => {
              if (!user) return;
              onConversationPatch?.({
                id: conversation.id,
                assigned_agent_id: user.id,
                assigned_profile: profile ? { full_name: profile.full_name } : conversation.assigned_profile || null,
                status: "open",
              });

              const { error } = await supabase
                .from("conversations")
                .update({ assigned_agent_id: user?.id, status: "open" })
                .eq("id", conversation.id);
              if (error) {
                await refetch();
                toast.error("Erro ao assumir atendimento");
              } else {
                toast.success("Atendimento assumido com sucesso!");
              }
            }}
            className="ml-3 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {hasAssignedAgent ? "Pegar atendimento" : "Assumir atendimento"}
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMessagesScroll}
        className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-5'} space-y-3 scrollbar-thin`}
        style={{ backgroundImage: `url(${chatBg})`, backgroundRepeat: 'repeat', backgroundSize: '400px' }}
      >
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg, index) => {
            const isOwnAgent = msg.sender_type === "agent" && msg.sender_id === user?.id;
            const isEditing = editingMsgId === msg.id;
            const agentProfile = msg.sender_type === "agent" && msg.sender_id ? agentProfiles[msg.sender_id] : null;
            const agentInitials = agentProfile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "";
            const replyInfo = getReplyInfo(msg);

            // Conversation boundary separator
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showConversationSeparator = prevMsg && prevMsg.conversation_id !== msg.conversation_id;
            const isFromHistory = !!(msg as any)._is_history;

            // Date separator logic
            const msgDate = new Date(msg.created_at);
            const prevDate = prevMsg ? new Date(prevMsg.created_at) : null;
            const showDateSeparator = !prevDate ||
              msgDate.toDateString() !== prevDate.toDateString();

            const formatDateLabel = (date: Date) => {
              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);
              if (date.toDateString() === today.toDateString()) return "Hoje";
              if (date.toDateString() === yesterday.toDateString()) return "Ontem";
              return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
            };

            // Build closing reason label for separator
            const closingSeparatorLabel = (() => {
              if (!showConversationSeparator) return "";
              const prevMsgTyped = prevMsg as MessageRow;
              const closedAt = (prevMsgTyped as any)?._conversation_closed_at;
              const reason = (prevMsgTyped as any)?._conversation_closing_reason;
              const datePart = closedAt ? new Date(closedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
              return `Conversa encerrada${reason ? ` — ${reason}` : ""}${datePart ? ` • ${datePart}` : ""}`;
            })();

            return (
              <React.Fragment key={msg.id}>
                {showConversationSeparator && (
                  <div className="flex items-center gap-3 py-3 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-secondary/80 border border-border rounded-full whitespace-nowrap">
                      {closingSeparatorLabel || "Conversa anterior"}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {showDateSeparator && (
                  <div className="flex items-center justify-center py-2">
                    <span className="px-3 py-1 text-[11px] font-medium text-muted-foreground bg-card border border-border rounded-lg shadow-sm">
                      {formatDateLabel(msgDate)}
                    </span>
                  </div>
                )}
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group flex items-end gap-2 transition-all duration-300 rounded-xl ${msg.sender_type === "agent" ? "justify-end" : "justify-start"}`}
              >
                {/* Contact avatar */}
                {msg.sender_type === "contact" && (
                  <Avatar className="w-7 h-7 flex-shrink-0 mb-1">
                    <AvatarImage src={conversation.contacts.avatar_url || undefined} alt={conversation.contacts.name} />
                    <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                )}

                {/* Action buttons - before bubble for agent messages */}
                {msg.sender_type === "agent" && !isEditing && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    <button
                      onClick={() => handleReply(msg)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground"
                      title="Responder"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {isOwnAgent && (
                      <>
                        <button
                          onClick={() => { setEditingMsgId(msg.id); setEditText(msg.content || ""); setMenuMsgId(null); }}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteMsgId(msg.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div
                  className={`${isMobile ? "max-w-[85%]" : "max-w-[70%]"} px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    msg.sender_type === "agent"
                      ? "bg-[#DCF8C6] text-gray-900 rounded-br-md"
                      : msg.sender_type === "system"
                      ? "bg-muted text-muted-foreground rounded-md text-center text-xs italic"
                      : "bg-white text-gray-900 border border-border rounded-bl-md"
                  }`}
                >
                  {/* Quoted reply */}
                  {replyInfo && (
                    <button
                      onClick={() => scrollToMessage(replyInfo.id)}
                      className={`w-full text-left mb-2 p-2 rounded-lg border-l-2 text-xs ${
                        msg.sender_type === "agent"
                          ? "bg-black/5 border-green-700/40"
                          : "bg-muted/50 border-primary/40"
                      }`}
                    >
                      <p className={`font-semibold text-[10px] ${
                        msg.sender_type === "agent" ? "text-green-800" : "text-primary"
                      }`}>
                        {replyInfo.senderName}
                      </p>
                      <p className={`truncate ${
                        msg.sender_type === "agent" ? "text-gray-700" : "text-muted-foreground"
                      }`}>
                        {replyInfo.content || "📎 Mídia"}
                      </p>
                    </button>
                  )}

                  {/* Agent name */}
                  {msg.sender_type === "agent" && agentProfile && (
                    <p className="text-xs font-bold mb-1 text-green-800">
                      {agentProfile.full_name}:
                    </p>
                  )}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") { setEditingMsgId(null); setEditText(""); } }}
                        className="bg-black/5 text-gray-900 rounded px-2 py-1 text-sm flex-1 outline-none"
                        autoFocus
                      />
                      <button onClick={handleEditSave} className="p-1 hover:bg-black/10 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingMsgId(null); setEditText(""); }} className="p-1 hover:bg-black/10 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <MediaContent msg={msg} />
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.sender_type === "agent" ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Agent avatar */}
                {msg.sender_type === "agent" && agentProfile && (
                  <Avatar className="w-7 h-7 flex-shrink-0 mb-1">
                    <AvatarImage src={agentProfile.avatar_url || undefined} alt={agentProfile.full_name} />
                    <AvatarFallback className="text-[10px] font-semibold">{agentInitials}</AvatarFallback>
                  </Avatar>
                )}

                {/* Reply button for contact messages - after bubble */}
                {msg.sender_type === "contact" && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    <button
                      onClick={() => handleReply(msg)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground"
                      title="Responder"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="px-4 pt-3 border-t border-border">
          <div className="flex items-center gap-3 bg-secondary rounded-lg p-3">
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
            ) : (
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={clearFile} className="p-1 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}


      {/* Reply preview bar */}
      {replyingTo && (
        <div className="px-4 pt-3 border-t border-border">
          <div className="flex items-center gap-3 bg-primary/5 border-l-2 border-primary rounded-lg p-3">
            <CornerDownRight className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">
                Respondendo a {replyingTo.sender_type === "agent" && replyingTo.sender_id
                  ? agentProfiles[replyingTo.sender_id]?.full_name || "Agente"
                  : conversation.contacts.name}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {replyingTo.content || (replyingTo.media_url ? "📎 Mídia" : "")}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className={`${isMobile ? 'p-2' : 'p-4'} border-t border-border relative flex-shrink-0 bg-card`}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={handleFileSelect}
        />

        {/* Quick Replies Popup */}
        {showQuickReplies && filteredQuickReplies.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
            <div className="p-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                <Zap className="w-3 h-3 inline mr-1" />
                Respostas Rápidas
              </p>
              {filteredQuickReplies.map((reply, idx) => (
                <button
                  key={reply.id}
                  onClick={() => selectQuickReply(reply)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    idx === selectedQRIndex ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {reply.shortcut && (
                      <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{reply.shortcut}</code>
                    )}
                    <span className="font-medium">{reply.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{reply.content}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 bg-destructive/10 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-destructive flex-1">
              Gravando... {formatRecordingTime(recordingTime)}
            </span>
            <button
              onClick={cancelRecording}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              title="Enviar áudio"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : !canSend ? (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <UserCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                {hasAssignedAgent ? "Conversa atribuída a outro atendente" : "Sem atendente atribuído"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Você precisa estar atribuído a este atendimento para enviar mensagens.
              </p>
            </div>
          </div>
        ) : isOutside24h ? (
          <div className="flex flex-col gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <div className="flex items-start gap-3">
              <UserCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Prazo máximo de envio de mensagens excedido
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envio de mensagens somente com templates aprovados pela Meta. Escolha uma das opções abaixo ou procure o Administrador de TI.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTemplateModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Escolher template para envio
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-2 bg-secondary rounded-xl px-4 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Anexar arquivo"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  handleMessageChange(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedFile
                    ? "Legenda (opcional)..."
                    : "Digite sua mensagem... (use / para respostas rápidas)"
                }
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground py-1.5 max-h-[120px]"
              />
              <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Smile className="w-5 h-5" />
              </button>
              {message.trim() || selectedFile ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Gravar áudio"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sensitive Info Request Warning Dialog */}
      <AlertDialog open={phoneWarningOpen} onOpenChange={setPhoneWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Atenção — Solicitação de {sensitiveType === "email" ? "email" : "telefone"}</AlertDialogTitle>
            <AlertDialogDescription>
              Você está solicitando informações de {sensitiveType === "email" ? "email" : "telefone"} do contato. O <strong>administrador do sistema será notificado</strong> sobre esta ação.
              <br /><br />
              Tem certeza de que deseja enviar esta mensagem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPhoneRequest}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPhoneRequest}>
              Sim, enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Message Confirmation Dialog */}
      <AlertDialog open={!!deleteMsgId} onOpenChange={(open) => { if (!open) setDeleteMsgId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Excluir mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>⚠️ Atenção:</strong> O histórico desta exclusão será enviado automaticamente ao supervisor/administrador do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMsg}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMsgId && handleDelete(deleteMsgId)}
              disabled={deletingMsg}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMsg ? "Excluindo..." : "Sim, excluir mensagem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pick Agent for Department Transfer */}
      <AlertDialog open={!!pickAgentForDept} onOpenChange={(open) => { if (!open) { setPickAgentForDept(null); setDeptAgents([]); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir para {pickAgentForDept?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o atendente do departamento, ou deixe na fila do setor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1 my-2">
            {loadingDeptAgents ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando atendentes...
              </div>
            ) : deptAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum atendente vinculado a este departamento.
              </p>
            ) : (
              deptAgents.map((a) => (
                <button
                  key={a.user_id}
                  onClick={() => pickAgentForDept && performTransfer(pickAgentForDept.id, a.user_id)}
                  disabled={transferringDept}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary text-left transition-colors disabled:opacity-50"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={a.avatar_url || undefined} alt={a.full_name} />
                    <AvatarFallback className="text-xs">
                      {(a.full_name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate flex-1">{a.full_name}</span>
                </button>
              ))
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferringDept}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pickAgentForDept && performTransfer(pickAgentForDept.id, null)}
              disabled={transferringDept}
            >
              {transferringDept ? "Transferindo..." : "Apenas mudar de setor (sem atendente)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Selection Modal (24h window) */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escolher template Meta</DialogTitle>
            <DialogDescription>
              Selecione a mensagem que deseja enviar. As variáveis já estão preenchidas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {REENGAGE_TEMPLATES.map((tpl) => (
              <div key={tpl.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tpl.label}</p>
                    <p className="text-[11px] text-muted-foreground">{tpl.category} · {tpl.id}</p>
                  </div>
                  <button
                    onClick={() => handleSendTemplate(tpl)}
                    disabled={sendingTemplate !== null}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {sendingTemplate === tpl.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Enviar
                  </button>
                </div>
                <div className="bg-secondary rounded-md p-3 text-xs text-foreground whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatArea;

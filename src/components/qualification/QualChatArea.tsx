import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QualConversation, QualMessage } from "@/hooks/useQualification";

interface Props {
  conversation: QualConversation | null;
  messages: QualMessage[];
  onSent?: () => void;
}

export default function QualChatArea({ conversation, messages, onSent }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [savingInstance, setSavingInstance] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!conversation || !text.trim() || sending) return;
    setSending(true);
    const value = text.trim();
    setText("");
    try {
      const { error } = await supabase.functions.invoke("qual-send-message", {
        body: { conversationId: conversation.id, text: value },
      });
      if (error) throw error;
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
      setText(value);
    } finally {
      setSending(false);
    }
  };

  const changeInstance = async (next: string) => {
    if (!conversation) return;
    setSavingInstance(true);
    try {
      const { error } = await supabase
        .from("qual_conversations")
        .update({ evolution_instance: next })
        .eq("id", conversation.id);
      if (error) throw error;
      (conversation as any).evolution_instance = next;
      toast.success(`Chip alterado para ${next}`);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao trocar chip");
    } finally {
      setSavingInstance(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Selecione uma conversa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
      <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <div>
          <h3 className="text-sm font-semibold">{conversation.contact_name || conversation.phone}</h3>
          <p className="text-xs text-muted-foreground">{conversation.phone}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-2 max-w-3xl mx-auto">
          {messages.map((m) => {
            const out = m.direction === "outbound";
            return (
              <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[70%] px-4 py-2 rounded-2xl text-sm",
                    out
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm",
                  )}
                >
                  {(() => {
                    const transcription = (m as any).metadata?.transcription as string | undefined;
                    const cleanContent = m.content && transcription
                      ? m.content.replace(/^🎤\s*/, "")
                      : m.content;
                    if (m.media_type === "audio") {
                      return (
                        <div className="space-y-1">
                          {m.media_url && (
                            <audio controls src={m.media_url} className="max-w-[260px] h-9" />
                          )}
                          {transcription ? (
                            <p className="whitespace-pre-wrap break-words text-sm">
                              <span className="mr-1">🎤</span>{transcription}
                            </p>
                          ) : (
                            <p className="text-xs opacity-70 italic">🎤 Transcrevendo áudio...</p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <>
                        {cleanContent && <p className="whitespace-pre-wrap break-words">{cleanContent}</p>}
                        {m.media_type && m.media_type !== "audio" && (
                          <p className="text-xs opacity-70 italic">[{m.media_type}]</p>
                        )}
                      </>
                    );
                  })()}
                  <p className={cn("text-[10px] mt-1", out ? "opacity-70" : "text-muted-foreground")}>
                    {new Date(m.sent_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card p-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite uma mensagem..."
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
          />
          <Button onClick={send} disabled={!text.trim() || sending} size="icon" className="h-11 w-11 flex-shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

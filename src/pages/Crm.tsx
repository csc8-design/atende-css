import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { useCrmDeals, CrmDeal, CrmStage, CrmTask } from "@/hooks/useCrmDeals";
import {
  Star, MessageCircle, Pencil, RefreshCw, TrendingUp, Plus, CheckSquare, Square,
  Building2, User, Phone, DollarSign, Calendar, Filter, X, Snowflake, Flame,
  Thermometer, ListTodo, Clock, Settings, Trash2, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COMERCIAL_DEPT = "11111111-0001-4000-8000-000000000001";

const TEMP_CONFIG: Record<string, { label: string; cls: string; icon: any; bar: string }> = {
  hot: { label: "Quente", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: Flame, bar: "bg-red-500" },
  quente: { label: "Quente", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: Flame, bar: "bg-red-500" },
  warm: { label: "Morno", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Thermometer, bar: "bg-amber-500" },
  morno: { label: "Morno", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Thermometer, bar: "bg-amber-500" },
  cold: { label: "Frio", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", icon: Snowflake, bar: "bg-sky-500" },
  frio: { label: "Frio", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", icon: Snowflake, bar: "bg-sky-500" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  em_andamento: { label: "Em andamento", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  perdida: { label: "Perdida", cls: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800", dot: "bg-red-500" },
  vendida: { label: "Vendida", cls: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800", dot: "bg-green-500" },
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(n: number | null | undefined): string {
  if (!n) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function getCoolingColor(days: number): string {
  if (days >= 30) return "bg-red-500/10 text-red-600 border-red-300 dark:border-red-800";
  if (days >= 14) return "bg-orange-500/10 text-orange-600 border-orange-300 dark:border-orange-800";
  if (days >= 7) return "bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800";
  return "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800";
}

function DealCard({ deal, onEdit, onOpenChat, onAddTask, onSendWhatsAppWeb, onSendAtende }: {
  deal: CrmDeal; onEdit: () => void; onOpenChat: () => void; onAddTask: () => void;
  onSendWhatsAppWeb: () => void; onSendAtende: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  const cooling = daysSince(deal.last_interaction_at);
  const tempKey = deal.temperature?.toLowerCase() || "";
  const temp = TEMP_CONFIG[tempKey];
  const status = STATUS_CONFIG[deal.status] || STATUS_CONFIG.em_andamento;
  const TempIcon = temp?.icon;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group bg-card border border-border rounded-xl mb-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-primary/40 transition-all overflow-hidden ${
        isDragging ? "opacity-40 scale-95" : ""
      }`}
    >
      {/* Top accent bar by temperature */}
      <div className={`h-1 w-full ${temp?.bar || "bg-muted"}`} />

      <div className="p-3">
        {/* Header: status + temperature */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${status.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          {temp && (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${temp.cls}`}>
              <TempIcon className="w-2.5 h-2.5" /> {temp.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm text-foreground mb-1 line-clamp-2 leading-snug">
          {deal.title}
        </h4>

        {/* Company */}
        {deal.company_name && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{deal.company_name}</span>
          </div>
        )}

        {/* Contact */}
        {deal.contact_name && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{deal.contact_name}</span>
          </div>
        )}

        {/* Value + priority */}
        <div className="flex items-center justify-between mb-2 pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3 h-3 ${s <= deal.priority ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-foreground">{formatCurrency(deal.estimated_value)}</span>
        </div>

        {/* Cooling badge */}
        <div className={`text-[10px] px-2 py-1 rounded-md border font-medium flex items-center gap-1 mb-2 ${getCoolingColor(cooling)}`}>
          <Clock className="w-2.5 h-2.5" />
          {cooling === 0 ? "Atualizado hoje" : `Esfriando há ${cooling} dia${cooling > 1 ? "s" : ""}`}
        </div>

        {/* Tasks indicator */}
        {(deal.open_tasks || 0) > 0 && (
          <div className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium flex items-center gap-1 mb-2">
            <ListTodo className="w-2.5 h-2.5" />
            {deal.open_tasks} tarefa{deal.open_tasks! > 1 ? "s" : ""} pendente{deal.open_tasks! > 1 ? "s" : ""}
          </div>
        )}

        {/* Send actions — clear, intuitive labels */}
        <div className="grid grid-cols-2 gap-1 pt-2 border-t border-border">
          <Button
            size="sm"
            className="h-7 text-[10px] px-1 bg-[#25D366] hover:bg-[#20bd5a] text-white"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onSendWhatsAppWeb}
            title="Abre o WhatsApp Web no seu navegador (envio pessoal, NÃO registra no AtendeCBMaq)"
          >
            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp Web
          </Button>
          <Button
            size="sm"
            className="h-7 text-[10px] px-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onSendAtende}
            title="Atende pelo AtendeCBMaq — registra no histórico oficial e na conversa"
          >
            <MessageCircle className="w-3 h-3 mr-1" /> AtendeCBMaq
          </Button>
        </div>

        {/* Secondary actions */}
        <div className="flex items-center gap-1 pt-1.5">
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-[11px] px-1" onPointerDown={(e) => e.stopPropagation()} onClick={onOpenChat} title="Ver histórico completo de conversas">
            <MessageCircle className="w-3 h-3 mr-1" /> Histórico
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-[11px] px-1" onPointerDown={(e) => e.stopPropagation()} onClick={onAddTask}>
            <Plus className="w-3 h-3 mr-1" /> Tarefa
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-[11px] px-1" onPointerDown={(e) => e.stopPropagation()} onClick={onEdit}>
            <Pencil className="w-3 h-3 mr-1" /> Editar
          </Button>
        </div>
      </div>
    </div>
  );
}

function StageColumn({ stage, deals, onEdit, onOpenChat, onAddTask, onSendWhatsAppWeb, onSendAtende }: {
  stage: CrmStage; deals: CrmDeal[];
  onEdit: (d: CrmDeal) => void; onOpenChat: (d: CrmDeal) => void; onAddTask: (d: CrmDeal) => void;
  onSendWhatsAppWeb: (d: CrmDeal) => void; onSendAtende: (d: CrmDeal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0);

  return (
    <div className="w-[300px] flex-shrink-0 flex flex-col bg-muted/40 rounded-xl border border-border/50">
      <div className="p-3 border-b border-border" style={{ borderTopColor: stage.color, borderTopWidth: 3, borderTopLeftRadius: 11, borderTopRightRadius: 11 }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
            {stage.name}
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-background text-muted-foreground font-medium">
            {deals.length}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 font-medium">{formatCurrency(total)}</p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 min-h-[200px] transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            onEdit={() => onEdit(d)}
            onOpenChat={() => onOpenChat(d)}
            onAddTask={() => onAddTask(d)}
            onSendWhatsAppWeb={() => onSendWhatsAppWeb(d)}
            onSendAtende={() => onSendAtende(d)}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-12">
            <div className="opacity-40">Solte aqui</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditDealModal({ deal, open, onOpenChange, onSave, fetchTasks, toggleTask }: {
  deal: CrmDeal | null; open: boolean; onOpenChange: (v: boolean) => void;
  onSave: (id: string, patch: Partial<CrmDeal>) => Promise<void>;
  fetchTasks: (id: string) => Promise<CrmTask[]>;
  toggleTask: (id: string, completed: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<CrmDeal>>({});
  const [tasks, setTasks] = useState<CrmTask[]>([]);

  useEffect(() => {
    if (deal) {
      setForm(deal);
      fetchTasks(deal.id).then(setTasks);
    }
  }, [deal, fetchTasks]);

  if (!deal) return null;

  const handleSave = async () => {
    await onSave(deal.id, {
      title: form.title,
      company_name: form.company_name,
      contact_name: form.contact_name,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      priority: form.priority,
      status: form.status,
      temperature: form.temperature,
      notes: form.notes,
      next_contact_at: form.next_contact_at,
    });
    toast.success("Card atualizado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Negociação</DialogTitle>
          <DialogDescription>Atualize as informações do card</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas ({tasks.filter((t) => !t.completed).length})</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 pt-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Empresa</Label>
                <Input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <Label>Contato</Label>
                <Input value={form.contact_name || ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor estimado (R$)</Label>
                <Input type="number" value={form.estimated_value || ""} onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Prioridade (1-5)</Label>
                <Input type="number" min={1} max={5} value={form.priority || 1} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="perdida">Perdida</SelectItem>
                    <SelectItem value="vendida">Vendida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperatura</Label>
                <Select value={form.temperature || ""} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quente">🔥 Quente</SelectItem>
                    <SelectItem value="morno">🌡️ Morno</SelectItem>
                    <SelectItem value="frio">❄️ Frio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Próximo contato</Label>
              <Input
                type="datetime-local"
                value={form.next_contact_at ? form.next_contact_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, next_contact_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </TabsContent>
          <TabsContent value="tasks" className="pt-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa criada</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <button onClick={() => toggleTask(t.id, !t.completed)}>
                      {t.completed ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      {t.due_at && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(t.due_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskModal({ deal, open, onOpenChange, onCreate }: {
  deal: CrmDeal | null; open: boolean; onOpenChange: (v: boolean) => void;
  onCreate: (dealId: string, title: string, dueAt: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (open) { setTitle(""); setDueAt(""); }
  }, [open]);

  if (!deal) return null;

  const submit = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    await onCreate(deal.id, title.trim(), dueAt ? new Date(dueAt).toISOString() : null);
    toast.success("Tarefa criada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>{deal.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar proposta" autoFocus />
          </div>
          <div>
            <Label>Prazo (opcional)</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChatMessage {
  id: string;
  content: string | null;
  sender_type: string;
  message_type: string;
  media_url: string | null;
  created_at: string;
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function ChatHistoryModal({ deal, open, onOpenChange }: {
  deal: CrmDeal | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!deal || !open) return;
    setLoadingMsgs(true);
    supabase
      .from("messages")
      .select("id, content, sender_type, message_type, media_url, created_at, conversation_id, conversations!inner(contact_id)")
      .eq("conversations.contact_id", deal.contact_id)
      .order("created_at", { ascending: true })
      .limit(2000)
      .then(({ data }) => {
        setMessages((data as any) || []);
        setLoadingMsgs(false);
      });
  }, [deal, open]);

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Histórico de conversa
          </DialogTitle>
          <DialogDescription>
            {deal.contact_name || deal.title}
            {deal.contact_phone && <span className="text-xs text-muted-foreground ml-2">· {deal.contact_phone}</span>}
            <span className="block text-[11px] text-muted-foreground mt-1">
              Histórico completo do contato (todas as conversas)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/30 rounded-lg p-3 space-y-2 min-h-[300px]">
          {loadingMsgs ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando mensagens...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem encontrada</p>
          ) : (
            messages.map((m) => {
              const isContact = m.sender_type === "contact";
              return (
                <div key={m.id} className={`flex ${isContact ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    isContact ? "bg-white dark:bg-card text-foreground border border-border" : "bg-[#DCF8C6] text-gray-900"
                  }`}>
                    {m.message_type !== "text" && m.media_url && (
                      <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs underline block mb-1">
                        📎 {m.message_type}
                      </a>
                    )}
                    {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                    <p className={`text-[10px] mt-1 ${isContact ? "text-muted-foreground" : "text-gray-600"}`}>
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageStagesModal({ open, onOpenChange, stages, onChanged }: {
  open: boolean; onOpenChange: (v: boolean) => void; stages: CrmStage[]; onChanged: () => void;
}) {
  const [items, setItems] = useState<CrmStage[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setItems([...stages].sort((a, b) => a.position - b.position)); }, [open, stages]);

  const updateField = (id: string, patch: Partial<CrmStage>) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const remove = async (id: string) => {
    const { count } = await supabase.from("crm_deals" as any).select("id", { count: "exact", head: true }).eq("stage_id", id);
    if ((count || 0) > 0) {
      toast.error(`Existem ${count} negociações nesta etapa. Mova-as antes de excluir.`);
      return;
    }
    if (!confirm("Excluir esta etapa?")) return;
    const { error } = await supabase.from("crm_stages" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Etapa excluída");
    onChanged();
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const addStage = async () => {
    if (!newName.trim()) return toast.error("Informe o nome");
    const pos = items.length > 0 ? Math.max(...items.map((s) => s.position)) + 1 : 1;
    const { error } = await supabase.from("crm_stages" as any).insert({ name: newName.trim(), color: newColor, position: pos });
    if (error) return toast.error(error.message);
    toast.success("Etapa adicionada");
    setNewName(""); setNewColor("#6366f1");
    onChanged();
  };

  const save = async () => {
    setSaving(true);
    const updates = items.map((s, idx) => supabase.from("crm_stages" as any).update({ name: s.name, color: s.color, position: idx + 1 }).eq("id", s.id));
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    setSaving(false);
    if (err?.error) return toast.error(err.error.message);
    toast.success("Etapas atualizadas");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar etapas do funil</DialogTitle>
          <DialogDescription>Edite, reordene, adicione ou exclua etapas do CRM.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {items.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <div className="flex flex-col">
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => move(idx, -1)}>▲</button>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => move(idx, 1)}>▼</button>
              </div>
              <input
                type="color"
                value={s.color}
                onChange={(e) => updateField(s.id, { color: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <Input
                value={s.name}
                onChange={(e) => updateField(s.id, { name: e.target.value })}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <Label className="text-xs">Adicionar nova etapa</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" />
            <Input placeholder="Nome da etapa" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 h-8 text-sm" />
            <Button size="sm" onClick={addStage}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Crm = () => {
  const { roles, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const { stages, deals, loading, updateDeal, refetch, createTask, fetchTasks, toggleTask } = useCrmDeals();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrmDeal | null>(null);
  const [taskDeal, setTaskDeal] = useState<CrmDeal | null>(null);
  const [chatDeal, setChatDeal] = useState<CrmDeal | null>(null);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTemp, setFilterTemp] = useState<string>("all");
  const [filterCooling, setFilterCooling] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>("");

  const hasFilters = filterDept !== "all" || filterStatus !== "all" || filterTemp !== "all" || filterCooling !== "all" || filterClient || filterCompany;

  const clearFilters = () => {
    setFilterDept("all"); setFilterStatus("all"); setFilterTemp("all");
    setFilterCooling("all"); setFilterClient(""); setFilterCompany("");
  };

  useEffect(() => {
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepartments((data as any) || []));
  }, []);

  // Check Comercial dept membership
  useEffect(() => {
    if (!user) return;
    if (roles.includes("admin") || roles.includes("manager")) {
      setHasAccess(true);
      return;
    }
    supabase
      .from("agent_departments")
      .select("id")
      .eq("agent_id", user.id)
      .eq("department_id", COMERCIAL_DEPT)
      .maybeSingle()
      .then(({ data }) => setHasAccess(!!data));
  }, [user, roles]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Apply filters
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (filterDept !== "all" && d.department_id !== filterDept) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterTemp !== "all") {
        const t = (d.temperature || "").toLowerCase();
        const map: Record<string, string[]> = {
          quente: ["quente", "hot"], morno: ["morno", "warm"], frio: ["frio", "cold"],
        };
        if (!map[filterTemp]?.includes(t)) return false;
      }
      if (filterCooling !== "all") {
        const days = daysSince(d.last_interaction_at);
        if (filterCooling === "0-7" && days > 7) return false;
        if (filterCooling === "8-14" && (days < 8 || days > 14)) return false;
        if (filterCooling === "15-30" && (days < 15 || days > 30)) return false;
        if (filterCooling === "30+" && days <= 30) return false;
      }
      if (filterClient && !(d.contact_name || "").toLowerCase().includes(filterClient.toLowerCase())) return false;
      if (filterCompany && !(d.company_name || "").toLowerCase().includes(filterCompany.toLowerCase())) return false;
      return true;
    });
  }, [deals, filterDept, filterStatus, filterTemp, filterCooling, filterClient, filterCompany]);

  const LOST_COLUMN_ID = "__lost__";

  const dealsByStage = useMemo(() => {
    const m: Record<string, CrmDeal[]> = {};
    stages.forEach((s) => (m[s.id] = []));
    m[LOST_COLUMN_ID] = [];
    filteredDeals.forEach((d) => {
      if (d.status === "perdida") {
        m[LOST_COLUMN_ID].push(d);
      } else if (m[d.stage_id]) {
        m[d.stage_id].push(d);
      }
    });
    return m;
  }, [stages, filteredDeals]);

  const lostStage: CrmStage = {
    id: LOST_COLUMN_ID,
    name: "Perdido",
    position: 999,
    color: "#ef4444",
  };

  const totalValue = filteredDeals.reduce((s, d) => s + (Number(d.estimated_value) || 0), 0);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const dealId = String(active.id);
    const newStageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    if (newStageId === LOST_COLUMN_ID) {
      if (deal.status === "perdida") return;
      updateDeal(dealId, { status: "perdida" });
      return;
    }

    const patch: Partial<CrmDeal> = {};
    if (deal.stage_id !== newStageId) patch.stage_id = newStageId;
    if (deal.status === "perdida") patch.status = "em_andamento";
    if (Object.keys(patch).length === 0) return;
    updateDeal(dealId, patch);
  };

  if (authLoading || hasAccess === null) {
    return <AppLayout><div className="p-8 text-muted-foreground">Carregando...</div></AppLayout>;
  }
  if (!hasAccess) return <Navigate to="/inbox" replace />;

  const activeDeal = deals.find((d) => d.id === activeId);

  return (
    <AppLayout>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" /> CRM — Funil Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredDeals.length} de {deals.length} negociações · {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(roles.includes("admin") || roles.includes("manager")) && (
              <Button variant="outline" size="sm" onClick={() => setManageStagesOpen(true)}>
                <Settings className="w-4 h-4 mr-2" /> Gerenciar etapas
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os deptos</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="perdida">Perdida</SelectItem>
              <SelectItem value="vendida">Vendida</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterTemp} onValueChange={setFilterTemp}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Temperatura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temperaturas</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
              <SelectItem value="morno">🌡️ Morno</SelectItem>
              <SelectItem value="frio">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCooling} onValueChange={setFilterCooling}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="Esfriando há..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer tempo</SelectItem>
              <SelectItem value="0-7">Até 7 dias</SelectItem>
              <SelectItem value="8-14">8-14 dias</SelectItem>
              <SelectItem value="15-30">15-30 dias</SelectItem>
              <SelectItem value="30+">Mais de 30 dias</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Cliente..."
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="w-[140px] h-8 text-xs"
          />

          <Input
            placeholder="Empresa..."
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-[140px] h-8 text-xs"
          />

          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {/* Kanban */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando...</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 p-4 h-full">
                {[lostStage, ...stages].map((stage) => (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    deals={dealsByStage[stage.id] || []}
                    onEdit={(d) => setEditing(d)}
                    onAddTask={(d) => setTaskDeal(d)}
                    onOpenChat={(d) => setChatDeal(d)}
                    onSendWhatsAppWeb={(d) => {
                      const phone = (d.contact_phone || "").replace(/\D/g, "");
                      if (!phone) { toast.error("Contato sem telefone cadastrado"); return; }
                      window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
                    }}
                    onSendAtende={(d) => navigate(`/inbox?conversation=${d.conversation_id}`)}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeDeal && (
                <div className="bg-card border-2 border-primary rounded-xl p-3 shadow-2xl w-[280px] rotate-2">
                  <h4 className="font-semibold text-sm">{activeDeal.title}</h4>
                  <p className="text-xs text-muted-foreground">{formatCurrency(activeDeal.estimated_value)}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        <EditDealModal
          deal={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={updateDeal}
          fetchTasks={fetchTasks}
          toggleTask={toggleTask}
        />
        <CreateTaskModal
          deal={taskDeal}
          open={!!taskDeal}
          onOpenChange={(v) => !v && setTaskDeal(null)}
          onCreate={createTask}
        />
        <ChatHistoryModal
          deal={chatDeal}
          open={!!chatDeal}
          onOpenChange={(v) => !v && setChatDeal(null)}
        />
        <ManageStagesModal
          open={manageStagesOpen}
          onOpenChange={setManageStagesOpen}
          stages={stages}
          onChanged={refetch}
        />
      </div>
    </AppLayout>
  );
};

export default Crm;

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  User,
  Phone,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useSchedules, Schedule } from "@/hooks/useSchedules";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isPast, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SCHEDULE_TYPES = [
  { value: "meeting", label: "Reunião", color: "bg-blue-500/10 text-blue-600" },
  { value: "demo", label: "Demonstração", color: "bg-purple-500/10 text-purple-600" },
  { value: "followup", label: "Follow-up", color: "bg-amber-500/10 text-amber-600" },
  { value: "call", label: "Ligação", color: "bg-green-500/10 text-green-600" },
  { value: "visit", label: "Visita", color: "bg-rose-500/10 text-rose-600" },
  { value: "other", label: "Outro", color: "bg-muted text-muted-foreground" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendado", icon: Clock, color: "text-blue-500" },
  { value: "completed", label: "Concluído", icon: CheckCircle2, color: "text-green-500" },
  { value: "cancelled", label: "Cancelado", icon: XCircle, color: "text-destructive" },
  { value: "missed", label: "Perdido", icon: AlertCircle, color: "text-amber-500" },
];

const Schedules = () => {
  const { user } = useAuth();
  const { schedules, loading, createSchedule, updateSchedule, deleteSchedule } = useSchedules();
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const filtered = schedules.filter((s) => {
    const matchSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.agent_profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || s.schedule_type === filterType;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchDate = !selectedDate || startOfDay(new Date(s.scheduled_at)).getTime() === startOfDay(selectedDate).getTime();
    return matchSearch && matchType && matchStatus && matchDate;
  });

  const todaySchedules = filtered.filter((s) => isToday(new Date(s.scheduled_at)));
  const tomorrowSchedules = filtered.filter((s) => isTomorrow(new Date(s.scheduled_at)));
  const upcomingSchedules = filtered.filter((s) => {
    const d = new Date(s.scheduled_at);
    return !isToday(d) && !isTomorrow(d) && !isPast(d);
  });
  const pastSchedules = filtered.filter((s) => {
    const d = new Date(s.scheduled_at);
    return isPast(d) && !isToday(d);
  });

  const getTypeConfig = (type: string) =>
    SCHEDULE_TYPES.find((t) => t.value === type) || SCHEDULE_TYPES[5];

  const getStatusConfig = (status: string) =>
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSchedule(id);
    if (ok) toast.success("Agendamento removido");
    else toast.error("Erro ao remover");
  };

  const handleStatusChange = async (id: string, status: string) => {
    const ok = await updateSchedule(id, { status });
    if (ok) toast.success("Status atualizado");
  };

  const renderScheduleCard = (s: Schedule) => {
    const typeConfig = getTypeConfig(s.schedule_type);
    const statusConfig = getStatusConfig(s.status);
    const date = new Date(s.scheduled_at);
    const StatusIcon = statusConfig.icon;

    return (
      <div
        key={s.id}
        className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-shadow group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">
                {format(date, "dd")}
              </span>
              <span className="text-[10px] text-primary uppercase">
                {format(date, "MMM", { locale: ptBR })}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-foreground truncate">{s.title}</h3>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(date, "HH:mm")} • {s.duration_minutes}min
                </span>
                {s.contact && (
                  <span className="flex items-center gap-1 truncate">
                    <Phone className="w-3 h-3" />
                    {s.contact.name}
                  </span>
                )}
                {s.agent_profile && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3" />
                    {s.agent_profile.full_name}
                  </span>
                )}
              </div>
              {s.description && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{s.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
            <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
              {s.status === "scheduled" && (
                <button
                  onClick={() => handleStatusChange(s.id, "completed")}
                  className="p-1 rounded hover:bg-secondary text-green-500"
                  title="Marcar concluído"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => handleEdit(s)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1 rounded hover:bg-secondary text-destructive"
                title="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: Schedule[], emptyText?: string) => {
    if (items.length === 0 && !emptyText) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          {title} ({items.length})
        </h3>
        {items.length === 0 && emptyText ? (
          <p className="text-sm text-muted-foreground px-1">{emptyText}</p>
        ) : (
          <div className="space-y-2">{items.map(renderScheduleCard)}</div>
        )}
      </div>
    );
  };

  // Calendar view: get dates with schedules
  const scheduleDates = schedules.map((s) => startOfDay(new Date(s.scheduled_at)));

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {schedules.filter((s) => s.status === "scheduled").length} agendamentos pendentes
            </p>
          </div>
          <button
            onClick={() => { setEditingSchedule(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar agendamentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none text-foreground"
          >
            <option value="all">Todos os tipos</option>
            {SCHEDULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none text-foreground"
          >
            <option value="all">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition-colors",
                selectedDate ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}>
                <CalendarIcon className="w-4 h-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Data"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className={cn("p-3 pointer-events-auto")}
              />
              {selectedDate && (
                <div className="p-2 border-t border-border">
                  <button
                    onClick={() => setSelectedDate(undefined)}
                    className="text-xs text-destructive hover:underline w-full text-center"
                  >
                    Limpar filtro
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-2 text-sm ${viewMode === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Calendário
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : viewMode === "list" ? (
          <div className="space-y-6">
            {renderSection("Hoje", todaySchedules, "Nenhum agendamento para hoje")}
            {renderSection("Amanhã", tomorrowSchedules)}
            {renderSection("Próximos", upcomingSchedules)}
            {renderSection("Passados", pastSchedules)}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhum agendamento</h3>
                <p className="text-sm text-muted-foreground">Crie seu primeiro agendamento clicando no botão acima</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className={cn("p-0 pointer-events-auto")}
                modifiers={{ hasSchedule: scheduleDates }}
                modifiersClassNames={{ hasSchedule: "bg-primary/20 font-bold" }}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {selectedDate
                  ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "Selecione uma data"}
              </h3>
              {selectedDate ? (
                filtered.length > 0 ? (
                  <div className="space-y-2">{filtered.map(renderScheduleCard)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">Nenhum agendamento nesta data</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground py-4">Clique em uma data no calendário para ver os agendamentos</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ScheduleFormModal
          schedule={editingSchedule}
          userId={user?.id || ""}
          onClose={() => { setShowForm(false); setEditingSchedule(null); }}
          onSave={async (data) => {
            if (editingSchedule) {
              const ok = await updateSchedule(editingSchedule.id, data);
              if (ok) toast.success("Agendamento atualizado");
              else toast.error("Erro ao atualizar");
            } else {
              const result = await createSchedule(data as any);
              if (result) toast.success("Agendamento criado");
              else toast.error("Erro ao criar");
            }
            setShowForm(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </AppLayout>
  );
};

// Form Modal Component
const ScheduleFormModal = ({
  schedule,
  userId,
  onClose,
  onSave,
}: {
  schedule: Schedule | null;
  userId: string;
  onClose: () => void;
  onSave: (data: any) => void;
}) => {
  const [title, setTitle] = useState(schedule?.title || "");
  const [description, setDescription] = useState(schedule?.description || "");
  const [scheduleType, setScheduleType] = useState(schedule?.schedule_type || "meeting");
  const [date, setDate] = useState(
    schedule ? format(new Date(schedule.scheduled_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [time, setTime] = useState(
    schedule ? format(new Date(schedule.scheduled_at), "HH:mm") : "09:00"
  );
  const [duration, setDuration] = useState(schedule?.duration_minutes || 30);
  const [notes, setNotes] = useState(schedule?.notes || "");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState(schedule?.contact_id || "");
  const [agents, setAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(schedule?.agent_id || userId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("contacts").select("id, name").order("name").then(({ data }) => {
      setContacts((data as any[]) || []);
    });
    supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name").then(({ data }) => {
      setAgents((data as any[]) || []);
    });
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Informe o título");
      return;
    }
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    await onSave({
      title,
      description: description || null,
      schedule_type: scheduleType,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes || null,
      contact_id: selectedContact || null,
      agent_id: selectedAgent,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card rounded-t-xl">
          <h3 className="font-semibold text-foreground">
            {schedule ? "Editar Agendamento" : "Novo Agendamento"}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              placeholder="Ex: Reunião com cliente"
            />
          </div>

          {/* Type + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Tipo</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground"
              >
                {SCHEDULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Duração (min)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground"
              >
                {[15, 30, 45, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>{d} minutos</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Data *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Horário *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Contato</label>
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground"
            >
              <option value="">Nenhum contato</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Agent */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Agente responsável</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground"
            >
              {agents.map((a) => (
                <option key={a.user_id} value={a.user_id}>{a.full_name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
              placeholder="Detalhes do agendamento"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
              placeholder="Notas internas"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Salvando..." : schedule ? "Salvar" : "Criar Agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Schedules;

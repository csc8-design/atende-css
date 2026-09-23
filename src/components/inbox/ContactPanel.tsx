import { useState, useEffect, useRef } from "react";
import { Mail, Phone, Tag, Calendar, StickyNote, ArrowRightLeft, UserPlus, X, XCircle, Check, Loader2, Trash2, Camera, Crown, ArrowLeft, Building2, FileText, MapPin, User as UserIcon } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ConversationWithContact } from "@/hooks/useConversations";
import ChannelBadge from "@/components/shared/ChannelBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone, maskEmail } from "@/lib/maskPhone";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ContactPanelProps {
  conversation: ConversationWithContact | null;
  onConversationUpdate?: () => void;
  onConversationPatch?: (patch: Partial<ConversationWithContact> & { id: string }) => void;
  isMobile?: boolean;
  onBack?: () => void;
}

/** Bloco de informações do contato editável inline por qualquer usuário. */
function EditableInfo({
  contact,
  conversationCreatedAt,
  onSaved,
}: {
  contact: any;
  conversationCreatedAt: string;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: contact.name || "",
    company_name: contact.company_name || "",
    cnpj: contact.cnpj || "",
    phone: contact.phone || "",
    email: contact.email || "",
    city: contact.city || "",
    state: contact.state || "",
    interest_type: contact.interest_type || "",
    desired_equipment: contact.desired_equipment || "",
    is_reseller: contact.is_reseller === true ? "sim" : contact.is_reseller === false ? "nao" : "none",
    segment: contact.segment || "",
    part_of_interest: (contact as any).part_of_interest || "",
    zip_code: (contact as any).zip_code || "",
    address: (contact as any).address || "",
  });

  useEffect(() => {
    setForm({
      name: contact.name || "",
      company_name: contact.company_name || "",
      cnpj: contact.cnpj || "",
      phone: contact.phone || "",
      email: contact.email || "",
      city: contact.city || "",
      state: contact.state || "",
      interest_type: contact.interest_type || "",
      desired_equipment: contact.desired_equipment || "",
      is_reseller: contact.is_reseller === true ? "sim" : contact.is_reseller === false ? "nao" : "none",
      segment: contact.segment || "",
      part_of_interest: (contact as any).part_of_interest || "",
      zip_code: (contact as any).zip_code || "",
      address: (contact as any).address || "",
    });
    setEditing(false);
  }, [contact.id]);


  const formatCnpjCpf = (v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length <= 11) {
      const s = d.slice(0, 11);
      return s
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    }
    const s = d.slice(0, 14);
    return s
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-contact-interest", {
        body: { contactId: contact.id, force: true },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (r?.error) throw new Error(r.error);
      if (r?.skipped) {
        toast.info("Sem mensagens suficientes para analisar este lead");
      } else {
        toast.success("Lead analisado pela IA");
      }
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao analisar lead");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {

    const name = form.name.trim();
    if (!name) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (name.length > 100) {
      toast.error("Nome muito longo (máx. 100)");
      return;
    }
    if (form.company_name.length > 150) {
      toast.error("Empresa muito longa (máx. 150)");
      return;
    }
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 11 && cnpjDigits.length !== 14) {
      toast.error("CNPJ/CPF inválido");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("E-mail inválido");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        name,
        company_name: form.company_name.trim() || null,
        cnpj: cnpjDigits ? formatCnpjCpf(cnpjDigits) : null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        interest_type: form.interest_type.trim() || null,
        desired_equipment: form.desired_equipment.trim() || null,
        is_reseller: form.is_reseller === "sim" ? true : form.is_reseller === "nao" ? false : null,
        segment: form.segment.trim() || null,
        part_of_interest: form.part_of_interest.trim() || null,
        zip_code: form.zip_code.trim() || null,
        address: form.address.trim() || null,

      })
      .eq("id", contact.id);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Informações atualizadas");
    setEditing(false);
    onSaved?.();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Informações
        </h4>
        {!editing ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Analisar Lead
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Editar
            </button>
          </div>
        ) : (

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setForm({
                  name: contact.name || "",
                  company_name: contact.company_name || "",
                  cnpj: contact.cnpj || "",
                  phone: contact.phone || "",
                  email: contact.email || "",
                  city: contact.city || "",
                  state: contact.state || "",
                  interest_type: contact.interest_type || "",
                  desired_equipment: contact.desired_equipment || "",
                  is_reseller: contact.is_reseller === true ? "sim" : contact.is_reseller === false ? "nao" : "none",
                  segment: contact.segment || "",
                  part_of_interest: (contact as any).part_of_interest || "",
                  zip_code: (contact as any).zip_code || "",
                  address: (contact as any).address || "",
                });

                setEditing(false);
              }}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Salvar
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome do contato"
              maxLength={100}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Empresa
            </label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Razão social / empresa"
              maxLength={150}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              CNPJ / CPF
            </label>
            <Input
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: formatCnpjCpf(e.target.value) }))}
              placeholder="CPF ou CNPJ"
              maxLength={18}
              inputMode="numeric"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Telefone
            </label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(00) 00000-0000"
              maxLength={30}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              E-mail
            </label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@empresa.com"
              maxLength={255}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cidade
              </label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Cidade"
                maxLength={100}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="w-16">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                UF
              </label>
              <Input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                placeholder="UF"
                maxLength={2}
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tipo de interesse
            </label>
            <Input
              value={form.interest_type}
              onChange={(e) => setForm((f) => ({ ...f, interest_type: e.target.value }))}
              placeholder="Ex: Máquina, Peças, Serviço"
              maxLength={100}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Equipamento/Aplicação pretendida
            </label>
            <Input
              value={form.desired_equipment}
              onChange={(e) => setForm((f) => ({ ...f, desired_equipment: e.target.value }))}
              placeholder="Ex: Trator Lovol 50cv para lavoura"
              maxLength={200}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              É revendedor?
            </label>
            <Select
              value={form.is_reseller}
              onValueChange={(v) => setForm((f) => ({ ...f, is_reseller: v }))}
            >
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="none">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Segmento
            </label>
            <Input
              value={form.segment}
              onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
              placeholder="Ex: Agronegócio, Construção civil"
              maxLength={120}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Peça de interesse
            </label>
            <Input
              value={form.part_of_interest}
              onChange={(e) => setForm((f) => ({ ...f, part_of_interest: e.target.value }))}
              placeholder="Ex: Filtro de óleo Mahindra 2025"
              maxLength={200}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              CEP
            </label>
            <Input
              value={form.zip_code}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                setForm((f) => ({ ...f, zip_code: d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }));
              }}
              placeholder="00000-000"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Endereço
            </label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rua, número, bairro"
              maxLength={200}
              className="h-8 text-sm mt-1"
            />
          </div>

        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <UserIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</p>
              <p className="text-foreground truncate">{contact.name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresa</p>
              <p className="text-foreground truncate">{contact.company_name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CNPJ / CPF</p>
              <p className="text-foreground truncate">{contact.cnpj || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Telefone</p>
              <p className="text-foreground truncate">{contact.phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">E-mail</p>
              <p className="text-foreground truncate">{contact.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cidade/UF</p>
              <p className="text-foreground truncate">{contact.city && contact.state ? `${contact.city} / ${contact.state}` : contact.city || contact.state || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de interesse</p>
              <p className="text-foreground truncate">{contact.interest_type || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Equipamento/Aplicação pretendida</p>
              <p className="text-foreground break-words">{contact.desired_equipment || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">É revendedor?</p>
              <p className="text-foreground truncate">{contact.is_reseller === true ? "Sim" : contact.is_reseller === false ? "Não" : "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Segmento</p>
              <p className="text-foreground truncate">{contact.segment || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peça de interesse</p>
              <p className="text-foreground break-words">{(contact as any).part_of_interest || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CEP</p>
              <p className="text-foreground truncate">{(contact as any).zip_code || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Endereço</p>
              <p className="text-foreground break-words">{(contact as any).address || "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</p>
              <p className="text-foreground">{new Date(conversationCreatedAt).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const ContactPanel = ({ conversation, onConversationUpdate, onConversationPatch, isMobile, onBack }: ContactPanelProps) => {
  const { user, profile, isManager, isAdmin } = useAuth();

  // Dialog states
  const [noteOpen, setNoteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [claimingContact, setClaimingContact] = useState(false);

  // Form states
  const [noteText, setNoteText] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [newTag, setNewTag] = useState("");
  const [closingReason, setClosingReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closingReasons, setClosingReasons] = useState<{ id: string; name: string; description: string | null }[]>([]);

  // Data
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [conversationTags, setConversationTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [notes, setNotes] = useState<{ id: string; content: string; created_at: string; author_id: string }[]>([]);

  useEffect(() => {
    if (!conversation) return;
    fetchConversationTags();
    fetchNotes();
  }, [conversation?.id]);

  const fetchConversationTags = async () => {
    if (!conversation) return;
    const { data } = await supabase
      .from("conversation_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("conversation_id", conversation.id);
    if (data) {
      setConversationTags(data.map((d: any) => d.tags));
    }
  };

  const fetchNotes = async () => {
    if (!conversation) return;
    const { data } = await supabase
      .from("conversation_notes")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false });
    if (data) setNotes(data);
  };

  const loadDepartments = async () => {
    const { data } = await supabase.from("departments").select("id, name").eq("is_active", true).order("name");
    if (data) setDepartments(data);
  };

  const loadAgentsByDepartment = async (deptId: string) => {
    // Get agent IDs for this department
    const { data: deptAgents } = await supabase
      .from("agent_departments")
      .select("agent_id")
      .eq("department_id", deptId);
    if (!deptAgents || deptAgents.length === 0) { setAgents([]); return; }
    const agentIds = deptAgents.map(d => d.agent_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", agentIds)
      .eq("is_active", true)
      .order("full_name");
    if (profiles) {
      setAgents(profiles.filter(a => a.user_id !== conversation?.assigned_agent_id));
    } else {
      setAgents([]);
    }
  };

  const loadTags = async () => {
    const { data } = await supabase.from("tags").select("id, name, color").order("name");
    if (data) setTags(data);
  };

  const loadClosingReasons = async () => {
    const { data } = await supabase
      .from("closing_reasons")
      .select("id, name, description")
      .eq("is_active", true)
      .order("name");
    if (data) setClosingReasons(data);
  };

  // Actions
  const handleAddNote = async () => {
    if (!noteText.trim() || !conversation || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("conversation_notes").insert({
      conversation_id: conversation.id,
      author_id: user.id,
      content: noteText.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao adicionar nota");
    } else {
      toast.success("Nota adicionada");
      setNoteText("");
      setNoteOpen(false);
      fetchNotes();
    }
  };

  const handleTransfer = async () => {
    if (!selectedDept || !conversation) return;
    const selectedAgentProfile = agents.find((agent) => agent.user_id === selectedAgent);
    const selectedDeptName = departments.find((d) => d.id === selectedDept)?.name;
    const previousDeptId = conversation.department_id;
    setSubmitting(true);

    // Send auto-message BEFORE transfer so the signature shows the current agent's setor
    if (selectedDeptName && selectedDept !== previousDeptId) {
      try {
        await supabase.functions.invoke("send-whatsapp", {
          body: {
            conversationId: conversation.id,
            message: `_Você está sendo direcionado para o setor ${selectedDeptName}, por favor aguarde que um atendente entrará em contato em breve. Aguarde um momento!_ 🙋`,
          },
        });
      } catch (err) {
        console.error("Auto transfer message error:", err);
      }
    }

    onConversationPatch?.({
      id: conversation.id,
      department_id: selectedDept,
      assigned_agent_id: selectedAgent || null,
      assigned_profile: selectedAgentProfile ? { full_name: selectedAgentProfile.full_name } : null,
      status: selectedAgent ? "open" : conversation.status,
    });

    const { error } = await supabase.rpc("transfer_conversation", {
      _conversation_id: conversation.id,
      _department_id: selectedDept,
      _agent_id: selectedAgent || null,
      _status: selectedAgent ? "open" : null,
    });
    setSubmitting(false);
    if (error) {
      console.error("Transfer error:", error);
      onConversationUpdate?.();
      toast.error(`Erro ao transferir conversa: ${error.message}`);
    } else {
      toast.success(selectedAgent ? "Conversa transferida e atribuída" : "Conversa transferida");
      setTransferOpen(false);
      setSelectedDept("");
      setSelectedAgent("");
      onConversationUpdate?.();
    }
  };

  const handleAssign = async () => {
    if (!selectedAgent || !conversation) return;
    const selectedAgentProfile = agents.find((agent) => agent.user_id === selectedAgent);
    setSubmitting(true);
    onConversationPatch?.({
      id: conversation.id,
      assigned_agent_id: selectedAgent,
      assigned_profile: selectedAgentProfile ? { full_name: selectedAgentProfile.full_name } : null,
      status: "open",
    });

    const { error } = await supabase
      .from("conversations")
      .update({ assigned_agent_id: selectedAgent, status: "open" })
      .eq("id", conversation.id);
    setSubmitting(false);
    if (error) {
      onConversationUpdate?.();
      toast.error("Erro ao atribuir agente");
    } else {
      toast.success("Agente atribuído");
      setAssignOpen(false);
      setSelectedAgent("");
      onConversationUpdate?.();
    }
  };

  const handleAddTag = async () => {
    if (!newTag || !conversation) return;
    setSubmitting(true);

    // Check if tag exists or create it
    let tagId = newTag;
    const existingTag = tags.find(t => t.id === newTag);
    if (!existingTag) {
      // It's a new tag name
      const { data: createdTag, error: tagError } = await supabase
        .from("tags")
        .insert({ name: newTag, color: "#3b82f6" })
        .select()
        .single();
      if (tagError) {
        toast.error("Erro ao criar tag");
        setSubmitting(false);
        return;
      }
      tagId = createdTag.id;
    }

    const { error } = await supabase.from("conversation_tags").insert({
      conversation_id: conversation.id,
      tag_id: tagId,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("Tag já adicionada");
      } else {
        toast.error("Erro ao adicionar tag");
      }
    } else {
      toast.success("Tag adicionada");
      fetchConversationTags();
    }
    setNewTag("");
    setTagOpen(false);
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!conversation) return;
    await supabase
      .from("conversation_tags")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("tag_id", tagId);
    fetchConversationTags();
    toast.success("Tag removida");
  };

  const handleClose = async () => {
    if (!conversation || !closingReason) return;
    setSubmitting(true);

    try {
      // 1. Close the conversation and unassign agent + department
      // so the next incoming message starts the chatbot menu again.
      const { error } = await supabase.rpc("close_conversation" as any, {
        _conversation_id: conversation.id,
        _closing_reason: closingReason,
      });

      if (error) {
        console.error("Close conversation error:", error);
        toast.error(`Erro ao encerrar conversa: ${error.message}`);
        setSubmitting(false);
        return;
      }

      // 2. Increment usage_count on the chosen reason
      const chosenReason = closingReasons.find(r => r.name === closingReason);
      if (chosenReason) {
        await supabase
          .from("closing_reasons" as any)
          .update({ usage_count: (chosenReason as any).usage_count ? (chosenReason as any).usage_count + 1 : 1 } as any)
          .eq("id", chosenReason.id);
      }

      // 3. Trigger satisfaction survey via edge function
      try {
        await supabase.functions.invoke("satisfaction-rating", {
          body: { action: "send-survey", conversationId: conversation.id, agentId: conversation.assigned_agent_id || user?.id },
        });
      } catch (e) {
        console.error("Error sending satisfaction survey:", e);
      }

      toast.success("Conversa encerrada e pesquisa de satisfação enviada");
      setCloseOpen(false);
      setClosingReason("");
      onConversationUpdate?.();
    } catch (err: any) {
      console.error("Close error:", err);
      toast.error("Erro ao encerrar conversa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimContact = async () => {
    if (!conversation || !user) return;
    setClaimingContact(true);
    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", conversation.contacts.id);
    setClaimingContact(false);
    if (error) {
      toast.error("Erro ao vincular contato");
      console.error(error);
    } else {
      toast.success("Contato vinculado a você com sucesso");
      onConversationUpdate?.();
    }
  };

  const notifyDeletionToSupervisors = async () => {
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

      const notifications = supervisorRoles
        .filter(r => r.user_id !== user.id)
        .map(r => ({
          user_id: r.user_id,
          type: "deletion_alert",
          title: "🗑️ Atendimento excluído",
          body: `${agentName} excluiu o atendimento completo com "${contactName}" (${conversation.channel}).`,
          reference_id: conversation.id,
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }
    } catch (err) {
      console.error("Error notifying deletion:", err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    setSubmitting(true);
    await supabase.from("messages").delete().eq("conversation_id", conversation.id);
    await supabase.from("conversation_notes").delete().eq("conversation_id", conversation.id);
    await supabase.from("conversation_tags").delete().eq("conversation_id", conversation.id);
    await supabase.from("chatbot_logs").delete().eq("conversation_id", conversation.id);
    await supabase.from("satisfaction_ratings").delete().eq("conversation_id", conversation.id);
    
    const { error } = await supabase.from("conversations").delete().eq("id", conversation.id);
    if (error) {
      toast.error("Erro ao excluir atendimento");
      console.error(error);
    } else {
      await notifyDeletionToSupervisors();
      toast.success("Atendimento excluído");
      setDeleteOpen(false);
      onConversationUpdate?.();
    }
    setSubmitting(false);
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [contactAvatarUrl, setContactAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (conversation) {
      setContactAvatarUrl(conversation.contacts.avatar_url);
    }
  }, [conversation?.id, conversation?.contacts.avatar_url]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `contacts/${conversation.contacts.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrlWithCache = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("contacts")
        .update({ avatar_url: avatarUrlWithCache })
        .eq("id", conversation.contacts.id);

      if (updateError) throw updateError;

      setContactAvatarUrl(avatarUrlWithCache);
      toast.success("Foto atualizada");
      onConversationUpdate?.();
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Generate unique color from contact name
  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 55%, 45%)`;
  };

  if (!conversation) return null;

  const contact = conversation.contacts;
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const avatarBgColor = getAvatarColor(contact.name);

  return (
    <div className={`${isMobile ? "w-full flex-1" : "w-[280px]"} border-l border-border bg-card overflow-y-auto scrollbar-thin`}>
      {/* Mobile back header */}
      {isMobile && onBack && (
        <div className="sticky top-0 z-10 bg-card border-b border-border flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-secondary text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="font-semibold text-foreground">Detalhes do Contato</h3>
        </div>
      )}
      <div className="p-5">
      {/* Profile */}
      <div className="text-center mb-6">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
        <div
          className="relative mx-auto mb-3 w-20 h-20 cursor-pointer group"
          onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
        >
          <Avatar className="w-20 h-20">
            <AvatarImage src={contactAvatarUrl || undefined} alt={contact.name} />
            <AvatarFallback
              className="text-xl font-bold text-white"
              style={{ backgroundColor: avatarBgColor }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploadingAvatar ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
        </div>
        <h3 className="font-semibold text-foreground">{contact.name}</h3>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <ChannelBadge channel={conversation.channel as any} size="md" />
          <span className="text-xs text-muted-foreground capitalize">{conversation.channel}</span>
        </div>
      </div>

      {/* Info (editável por qualquer usuário) */}
      <div className="space-y-4">
        <EditableInfo
          contact={contact}
          conversationCreatedAt={conversation.created_at}
          onSaved={onConversationUpdate}
        />



        {/* Tags */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {conversationTags.map((tag) => (
              <span
                key={tag.id}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary flex items-center gap-1"
              >
                {tag.name}
                <button onClick={() => handleRemoveTag(tag.id)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {conversationTags.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma tag</span>
            )}
          </div>
        </div>

        {/* Notes preview */}
        {notes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notas</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {notes.slice(0, 3).map((note) => (
                <div key={note.id} className="text-xs text-muted-foreground bg-secondary p-2 rounded-lg">
                  <p className="text-foreground">{note.content}</p>
                  <p className="mt-1 text-[10px]">{new Date(note.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis removida do Inbox — qualificação acontece apenas na aba Qualificação IA */}

        {/* Status */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status</h4>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            conversation.status === "open"
              ? "bg-primary/10 text-primary"
              : conversation.status === "pending"
              ? "bg-yellow-500/10 text-yellow-600"
              : conversation.status === "closed"
              ? "bg-muted text-muted-foreground"
              : "bg-green-500/10 text-green-600"
          }`}>
            {conversation.status === "open" ? "Aberta" : conversation.status === "pending" ? "Pendente" : conversation.status === "closed" ? "Encerrada" : "Resolvida"}
          </span>
        </div>

        {/* Quick actions */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações rápidas</h4>
          <div className="space-y-1.5">
            <button
              onClick={() => setNoteOpen(true)}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
            >
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              Adicionar nota
            </button>
            <button
              onClick={() => { loadDepartments(); setSelectedDept(""); setSelectedAgent(""); setTransferOpen(true); }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
              Transferir conversa
            </button>
            <button
              onClick={() => { loadTags(); setTagOpen(true); }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
            >
              <Tag className="w-4 h-4 text-muted-foreground" />
              Adicionar tag
            </button>
            {/* Manual claim contact button - show when contact has no assigned agent or is assigned to someone else */}
            {conversation.contacts && (
              <button
                onClick={handleClaimContact}
                disabled={claimingContact}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
              >
                {claimingContact ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <UserPlus className="w-4 h-4 text-muted-foreground" />}
                Vincular contato a mim
              </button>
            )}
            {conversation.status !== "closed" && (
              <button
                onClick={() => { loadClosingReasons(); setCloseOpen(true); }}
                className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Encerrar conversa
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir atendimento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Nota</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Digite sua nota..."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddNote} disabled={submitting || !noteText.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="ml-1">Salvar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Departamento</label>
              <Select value={selectedDept} onValueChange={(val) => { setSelectedDept(val); setSelectedAgent(""); loadAgentsByDepartment(val); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDept && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Agente (opcional)</label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem atribuição (fila do departamento)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedAgent && (
                  <p className="text-xs text-muted-foreground mt-1">A conversa ficará na fila do departamento</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransfer} disabled={submitting || !selectedDept}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              <span className="ml-1">Transferir</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Tag Dialog */}
      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Tag</DialogTitle>
          </DialogHeader>
          {tags.length > 0 ? (
            <Select value={newTag} onValueChange={setNewTag}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.filter(t => !conversationTags.find(ct => ct.id === t.id)).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nome da nova tag..."
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTagOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTag} disabled={submitting || !newTag}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              <span className="ml-1">Adicionar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Conversation Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Encerrar Conversa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione o motivo do encerramento. Uma pesquisa de satisfação será enviada ao cliente automaticamente.
          </p>
          <div className="space-y-2 overflow-y-auto max-h-[40vh] pr-1">
            {closingReasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setClosingReason(reason.name)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  closingReason === reason.name
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                <p className="text-sm font-medium">{reason.name}</p>
                {reason.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCloseOpen(false); setClosingReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClose} disabled={submitting || !closingReason}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              <span className="ml-1">Encerrar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Atendimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este atendimento? Todas as mensagens, notas e tags serão removidas permanentemente. Esta ação não pode ser desfeita.
          </p>
          <p className="text-sm font-medium text-destructive mt-2">
            ⚠️ O histórico desta exclusão será enviado automaticamente ao supervisor/administrador do sistema.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConversation} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="ml-1">Excluir</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default ContactPanel;

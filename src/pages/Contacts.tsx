import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Phone, Mail, MoreHorizontal, ChevronLeft, ChevronRight, Upload, X, Edit, Trash2, Download } from "lucide-react";
import ImportContacts from "@/components/contacts/ImportContacts";
import ContactCategorySelect from "@/components/shared/ContactCategorySelect";
import AppLayout from "@/components/layout/AppLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { maskPhone, maskEmail } from "@/lib/maskPhone";
import { toast } from "sonner";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 25;

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  tags: string[] | null;
  whatsapp_id: string | null;
  is_active: boolean;
  created_at: string;
  assigned_agent_id: string | null;
}

const AGENT_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

const emptyForm = { name: "", phone: "", email: "", tags: "", assigned_agent_id: "" };

const Contacts = () => {
  const { user, isManager, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("name");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [agentMap, setAgentMap] = useState<Record<string, { name: string; color: string }>>({});

  // Fetch agent profiles for color mapping
  useEffect(() => {
    if (!isManager && !isAdmin) return;
    const fetchAgents = async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      if (data) {
        const map: Record<string, { name: string; color: string }> = {};
        data.forEach((p, i) => {
          map[p.user_id] = { name: p.full_name, color: AGENT_COLORS[i % AGENT_COLORS.length] };
        });
        setAgentMap(map);
      }
    };
    fetchAgents();
  }, [isManager, isAdmin]);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Count query (same filters, no pagination)
    let countQuery = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true });

    if (!isManager && !isAdmin) {
      countQuery = countQuery.eq("assigned_agent_id", user.id);
    } else if (filterAgentId && filterAgentId !== "all") {
      countQuery = countQuery.eq("assigned_agent_id", filterAgentId);
    }
    if (search) {
      if (searchField === "name") countQuery = countQuery.ilike("name", `%${search}%`);
      else if (searchField === "phone") countQuery = countQuery.ilike("phone", `%${search}%`);
      else if (searchField === "email") countQuery = countQuery.ilike("email", `%${search}%`);
    }
    if (activeLetter) countQuery = countQuery.ilike("name", `${activeLetter}%`);

    // Data query
    let query = supabase
      .from("contacts")
      .select("*")
      .order("name", { ascending: true });

    if (!isManager && !isAdmin) {
      query = query.eq("assigned_agent_id", user.id);
    } else if (filterAgentId && filterAgentId !== "all") {
      query = query.eq("assigned_agent_id", filterAgentId);
    }
    if (search) {
      if (searchField === "name") query = query.ilike("name", `%${search}%`);
      else if (searchField === "phone") query = query.ilike("phone", `%${search}%`);
      else if (searchField === "email") query = query.ilike("email", `%${search}%`);
    }
    if (activeLetter) query = query.ilike("name", `${activeLetter}%`);
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const [{ count }, { data, error }] = await Promise.all([countQuery, query]);

    if (error) console.error("Fetch contacts error:", error);
    setTotalCount(count ?? 0);
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [search, searchField, activeLetter, page, user, isManager, isAdmin, filterAgentId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { setPage(0); }, [search, activeLetter, filterAgentId]);

  // Build agents list - managers see only their department agents, admins see all
  const [allAgents, setAllAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  useEffect(() => {
    const fetchAllAgents = async () => {
      if (isAdmin) {
        const { data } = await supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name");
        if (data) setAllAgents(data);
      } else if (isManager && user) {
        // Get manager's departments first
        const { data: depts } = await supabase.from("agent_departments").select("department_id").eq("agent_id", user.id);
        if (depts && depts.length > 0) {
          const deptIds = depts.map(d => d.department_id);
          const { data: deptAgents } = await supabase.from("agent_departments").select("agent_id").in("department_id", deptIds);
          if (deptAgents) {
            const uniqueIds = [...new Set(deptAgents.map(a => a.agent_id))];
            const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uniqueIds).eq("is_active", true).order("full_name");
            if (profiles) setAllAgents(profiles);
          }
        } else {
          setAllAgents([]);
        }
      } else {
        const { data } = await supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name");
        if (data) setAllAgents(data);
      }
    };
    fetchAllAgents();
  }, [isAdmin, isManager, user]);

  const openNew = () => {
    setEditingContact(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      tags: (contact.tags || []).join(", "),
      assigned_agent_id: contact.assigned_agent_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    const phone = form.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Telefone inválido. Use o formato com DDD.");
      return;
    }

    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: any = {
      name: form.name.trim(),
      phone,
      email: form.email.trim() || null,
      whatsapp_id: phone,
      tags: tags.length > 0 ? tags : [],
      assigned_agent_id: (isManager || isAdmin)
        ? ((form.assigned_agent_id && form.assigned_agent_id !== "none") ? form.assigned_agent_id : null)
        : (editingContact ? editingContact.assigned_agent_id : user?.id || null),
    };

    if (editingContact) {
      const { error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", editingContact.id);
      if (error) {
        toast.error("Erro ao atualizar contato");
        console.error(error);
      } else {
        toast.success("Contato atualizado!");
      }
    } else {
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um contato com esse telefone");
        } else {
          toast.error("Erro ao criar contato");
          console.error(error);
        }
      } else {
        toast.success("Contato cadastrado!");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchContacts();
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Deseja realmente excluir o contato "${contact.name}"?`)) return;
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    if (error) {
      toast.error("Erro ao excluir contato");
      console.error(error);
    } else {
      toast.success("Contato excluído");
      fetchContacts();
    }
  };

  const isSuperAdmin = isAdmin;

  const handleExportCSV = async () => {
    toast.info("Exportando contatos...");
    let allData: Contact[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        toast.error("Erro ao exportar contatos");
        console.error(error);
        return;
      }
      if (data && data.length > 0) {
        allData = [...allData, ...(data as Contact[])];
        from += batchSize;
        if (data.length < batchSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }

    const headers = ["Nome", "Telefone", "Email", "Tags", "WhatsApp ID", "Ativo", "Criado em"];
    const rows = allData.map((c) => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.phone || "",
      c.email || "",
      `"${(c.tags || []).join(", ")}"`,
      c.whatsapp_id || "",
      c.is_active ? "Sim" : "Não",
      c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${allData.length} contatos exportados!`);
  };

  return (
    <AppLayout>
      <div className={`${isMobile ? 'px-4 py-4' : 'p-6 lg:p-8'} max-w-7xl mx-auto space-y-4`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>Contatos</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {totalCount.toLocaleString("pt-BR")} contato(s) encontrado(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={handleExportCSV}
                className={`flex items-center gap-2 bg-secondary text-foreground ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} rounded-lg font-medium hover:opacity-90 transition-opacity border border-border`}
              >
                <Download className="w-4 h-4" />
                {isMobile ? "CSV" : "Exportar CSV"}
              </button>
            )}
            <button
              onClick={openNew}
              className={`flex items-center gap-2 bg-primary text-primary-foreground ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'} rounded-lg font-medium hover:opacity-90 transition-opacity`}
            >
              <Plus className="w-4 h-4" />
              {isMobile ? "Novo" : "Novo Contato"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">Lista de contatos</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3 mt-3">
            {/* Search bar */}
            <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger className={isMobile ? 'w-full' : 'w-48'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Pesquisar contato</SelectItem>
                  <SelectItem value="phone">Pesquisar telefone</SelectItem>
                  <SelectItem value="email">Pesquisar email</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar contato..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {(isManager || isAdmin) && (
                <Select value={filterAgentId} onValueChange={setFilterAgentId}>
                  <SelectTrigger className={isMobile ? 'w-full' : 'w-52'}>
                    <SelectValue placeholder="Filtrar por responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os responsáveis</SelectItem>
                    {allAgents.map((agent) => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Alphabet filter */}
            <div className="flex flex-wrap gap-1">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                  className={`${isMobile ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'} rounded font-semibold transition-colors ${
                    activeLetter === letter
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Mobile: Card layout */}
            {isMobile ? (
              <div className="space-y-2">
                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
                ) : contacts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Nenhum contato encontrado</div>
                ) : (
                  contacts.map((contact) => (
                    <div key={contact.id} className="bg-card rounded-xl border border-border p-3.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
                          {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {maskPhone(contact.phone, !isManager && !isAdmin)}
                          </p>
                        </div>
                        {(isAdmin || isManager) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(contact)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(contact)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {contact.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 pl-12">
                          <Mail className="w-3 h-3" />
                          {maskEmail(contact.email, !isManager && !isAdmin)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pl-12 flex-wrap">
                        {(contact.tags || []).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                            {tag}
                          </span>
                        ))}
                        {(isManager || isAdmin) && contact.assigned_agent_id && agentMap[contact.assigned_agent_id] && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agentMap[contact.assigned_agent_id].color }} />
                            {agentMap[contact.assigned_agent_id].name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Desktop: Table layout */
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                      {(isManager || isAdmin) && (
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsável</th>
                      )}
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={(isManager || isAdmin) ? 7 : 6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                          Carregando...
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={(isManager || isAdmin) ? 7 : 6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                          Nenhum contato encontrado
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr key={contact.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </div>
                              <span className="text-sm font-medium text-foreground">{contact.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {maskPhone(contact.phone, !isManager && !isAdmin)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {contact.email ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                {maskEmail(contact.email, !isManager && !isAdmin)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex gap-1 flex-wrap">
                              {(contact.tags || []).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <ContactCategorySelect
                              contactId={contact.id}
                              currentCategory={(contact as any).category}
                              onUpdate={fetchContacts}
                              compact
                            />
                          </td>
                          {(isManager || isAdmin) && (
                            <td className="px-5 py-3.5">
                              {contact.assigned_agent_id && agentMap[contact.assigned_agent_id] ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: agentMap[contact.assigned_agent_id].color }}
                                  />
                                  <span className="text-sm font-medium text-foreground">
                                    {agentMap[contact.assigned_agent_id].name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem responsável</span>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {(isAdmin || isManager) && (
                                <>
                                  <button
                                    onClick={() => openEdit(contact)}
                                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                    title="Editar contato"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(contact)}
                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Excluir contato"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 pb-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-primary disabled:text-muted-foreground"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs text-muted-foreground">
                {(page * PAGE_SIZE + 1).toLocaleString("pt-BR")}–{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString("pt-BR")} de {totalCount.toLocaleString("pt-BR")}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                className="text-primary disabled:text-muted-foreground"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ImportContacts onImportComplete={fetchContacts} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de cadastro / edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo"
                maxLength={100}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Telefone (WhatsApp) *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="5511999999999"
                maxLength={20}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Formato: código do país + DDD + número</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
                maxLength={255}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="cliente, vip, fornecedor"
                maxLength={200}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Separe as tags por vírgula</p>
            </div>
            {(isManager || isAdmin) && (
              <div>
                <label className="text-sm font-medium text-foreground">Responsável</label>
                <Select value={form.assigned_agent_id} onValueChange={(val) => setForm({ ...form, assigned_agent_id: val })}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {allAgents.map((agent) => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingContact ? "Atualizar" : "Cadastrar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Contacts;
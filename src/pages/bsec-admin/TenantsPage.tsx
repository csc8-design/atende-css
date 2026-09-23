import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Power, PowerOff, Loader2, Search } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  max_users: number;
  max_conversations: number;
  is_active: boolean;
  custom_domain: string | null;
  created_at: string;
}

const EMPTY: Partial<Tenant> = {
  name: "", slug: "", document: "", email: "", phone: "",
  plan: "basic", max_users: 5, max_conversations: 500, custom_domain: "",
};

const TenantsPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Tenant> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTenants = async () => {
    const { data } = await supabaseAdmin.from("tenants").select("*").order("name");
    setTenants((data || []) as Tenant[]);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const openNew = () => { setEditing({ ...EMPTY }); setModalOpen(true); };
  const openEdit = (t: Tenant) => { setEditing({ ...t }); setModalOpen(true); };

  const handleSave = async () => {
    if (!editing?.name || !editing?.slug) {
      toast({ title: "Nome e slug são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing.id) {
      const { error } = await supabaseAdmin.from("tenants").update({
        name: editing.name, slug: editing.slug, document: editing.document,
        email: editing.email, phone: editing.phone, plan: editing.plan,
        max_users: editing.max_users, max_conversations: editing.max_conversations,
        custom_domain: editing.custom_domain,
      }).eq("id", editing.id);
      if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      else toast({ title: "Empresa atualizada!" });
    } else {
      const { error } = await supabaseAdmin.from("tenants").insert({
        name: editing.name, slug: editing.slug, document: editing.document,
        email: editing.email, phone: editing.phone, plan: editing.plan,
        max_users: editing.max_users, max_conversations: editing.max_conversations,
        custom_domain: editing.custom_domain,
      } as any);
      if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      else toast({ title: "Empresa criada!" });
    }
    setSaving(false);
    setModalOpen(false);
    fetchTenants();
  };

  const toggleActive = async (t: Tenant) => {
    await supabaseAdmin.from("tenants").update({ is_active: !t.is_active } as any).eq("id", t.id);
    fetchTenants();
    toast({ title: t.is_active ? "Empresa desativada" : "Empresa ativada" });
  };

  const deleteTenant = async (t: Tenant) => {
    if (!confirm(`Excluir "${t.name}"? Isso removerá todas as APIs e pagamentos vinculados.`)) return;
    await supabaseAdmin.from("tenants").delete().eq("id", t.id);
    fetchTenants();
    toast({ title: "Empresa excluída" });
  };

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Empresas
          </h1>
          <p className="text-sm text-muted-foreground">{tenants.length} empresas cadastradas</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Empresa</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-2">
        {filtered.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm truncate">{t.name}</span>
                <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                  {t.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{t.plan}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{t.slug}</span>
                {t.email && <span>{t.email}</span>}
                {t.document && <span>{t.document}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="h-8 w-8">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(t)} className="h-8 w-8">
                {t.is_active ? <PowerOff className="w-3.5 h-3.5 text-yellow-500" /> : <Power className="w-3.5 h-3.5 text-green-500" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteTenant(t)} className="h-8 w-8">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma empresa encontrada.</div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome *</Label><Input value={editing?.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label className="text-xs">Slug *</Label><Input value={editing?.slug || ""} onChange={e => setEditing(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">CNPJ</Label><Input value={editing?.document || ""} onChange={e => setEditing(p => ({ ...p, document: e.target.value }))} /></div>
              <div><Label className="text-xs">E-mail</Label><Input value={editing?.email || ""} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Telefone</Label><Input value={editing?.phone || ""} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Plano</Label><Input value={editing?.plan || "basic"} onChange={e => setEditing(p => ({ ...p, plan: e.target.value }))} /></div>
              <div><Label className="text-xs">Domínio</Label><Input value={editing?.custom_domain || ""} onChange={e => setEditing(p => ({ ...p, custom_domain: e.target.value }))} placeholder="app.empresa.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Máx. Usuários</Label><Input type="number" value={editing?.max_users || 5} onChange={e => setEditing(p => ({ ...p, max_users: Number(e.target.value) }))} /></div>
              <div><Label className="text-xs">Máx. Conversas</Label><Input type="number" value={editing?.max_conversations || 500} onChange={e => setEditing(p => ({ ...p, max_conversations: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing?.id ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantsPage;

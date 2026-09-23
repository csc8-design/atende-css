import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Tenant { id: string; name: string; }
interface ApiConfig {
  id: string; tenant_id: string; provider: string;
  config_key: string; config_value: string; is_active: boolean;
}

const PROVIDERS = ["whatsapp", "openai", "google", "instagram", "telegram", "custom"];

const ApisPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", provider: "whatsapp", config_key: "", config_value: "" });
  const [saving, setSaving] = useState(false);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    const [t, c] = await Promise.all([
      supabaseAdmin.from("tenants").select("id, name").order("name"),
      supabaseAdmin.from("tenant_api_configs").select("*").order("provider"),
    ]);
    setTenants((t.data || []) as Tenant[]);
    setConfigs((c.data || []) as ApiConfig[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = selectedTenant === "all" ? configs : configs.filter(c => c.tenant_id === selectedTenant);
  const getTenantName = (id: string) => tenants.find(t => t.id === id)?.name || "—";

  const toggleVisibility = (id: string) => {
    setVisibleValues(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const maskValue = (val: string) => val.length > 8 ? val.slice(0, 4) + "•".repeat(val.length - 8) + val.slice(-4) : "••••••••";

  const handleAdd = async () => {
    if (!form.tenant_id || !form.config_key || !form.config_value) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabaseAdmin.from("tenant_api_configs").insert(form as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Configuração adicionada!" }); setModalOpen(false); fetchAll(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta configuração?")) return;
    await supabaseAdmin.from("tenant_api_configs").delete().eq("id", id);
    fetchAll();
    toast({ title: "Configuração removida" });
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" /> Gestão de APIs
          </h1>
          <p className="text-sm text-muted-foreground">{configs.length} configurações</p>
        </div>
        <Button onClick={() => { setForm({ tenant_id: "", provider: "whatsapp", config_key: "", config_value: "" }); setModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Config
        </Button>
      </div>

      <Select value={selectedTenant} onValueChange={setSelectedTenant}>
        <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filtrar por empresa" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as empresas</SelectItem>
          {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{c.provider}</Badge>
                <span className="font-medium text-sm text-foreground">{c.config_key}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs text-muted-foreground font-mono">
                  {visibleValues.has(c.id) ? c.config_value : maskValue(c.config_value)}
                </code>
                <button onClick={() => toggleVisibility(c.id)} className="text-muted-foreground hover:text-foreground">
                  {visibleValues.has(c.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-muted-foreground">{getTenantName(c.tenant_id)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="h-8 w-8">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma configuração encontrada.</div>}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Configuração de API</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Empresa *</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm(p => ({ ...p, tenant_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Provedor *</Label>
              <Select value={form.provider} onValueChange={v => setForm(p => ({ ...p, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Chave *</Label><Input value={form.config_key} onChange={e => setForm(p => ({ ...p, config_key: e.target.value }))} placeholder="ex: access_token" /></div>
            <div><Label className="text-xs">Valor *</Label><Input value={form.config_value} onChange={e => setForm(p => ({ ...p, config_value: e.target.value }))} placeholder="Token ou valor" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApisPage;

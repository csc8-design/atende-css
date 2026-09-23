import { useEffect, useState } from "react";
import { CreditCard, Plus, Loader2, Check, Clock, AlertCircle, X } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Tenant { id: string; name: string; }
interface Payment {
  id: string; tenant_id: string; amount: number; currency: string;
  status: string; payment_method: string | null; reference_month: string | null;
  description: string | null; due_date: string | null; paid_at: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  paid: { label: "Pago", icon: Check, color: "text-green-500" },
  overdue: { label: "Atrasado", icon: AlertCircle, color: "text-red-500" },
  cancelled: { label: "Cancelado", icon: X, color: "text-muted-foreground" },
};

const PaymentsPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tenant_id: "", amount: "", status: "pending", payment_method: "pix", reference_month: "", description: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const [t, p] = await Promise.all([
      supabaseAdmin.from("tenants").select("id, name").order("name"),
      supabaseAdmin.from("tenant_payments").select("*").order("created_at", { ascending: false }),
    ]);
    setTenants((t.data || []) as Tenant[]);
    setPayments((p.data || []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getTenantName = (id: string) => tenants.find(t => t.id === id)?.name || "—";

  const filtered = payments.filter(p => {
    if (selectedTenant !== "all" && p.tenant_id !== selectedTenant) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!form.tenant_id || !form.amount) {
      toast({ title: "Empresa e valor são obrigatórios", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabaseAdmin.from("tenant_payments").insert({
      tenant_id: form.tenant_id,
      amount: parseFloat(form.amount),
      status: form.status,
      payment_method: form.payment_method || null,
      reference_month: form.reference_month || null,
      description: form.description || null,
      due_date: form.due_date || null,
    } as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Pagamento registrado!" }); setModalOpen(false); fetchAll(); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "paid") updates.paid_at = new Date().toISOString();
    await supabaseAdmin.from("tenant_payments").update(updates).eq("id", id);
    fetchAll();
    toast({ title: `Status atualizado para ${STATUS_MAP[status]?.label || status}` });
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">{payments.length} registros</p>
        </div>
        <Button onClick={() => { setForm({ tenant_id: "", amount: "", status: "pending", payment_method: "pix", reference_month: "", description: "", due_date: "" }); setModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Pagamento
        </Button>
      </div>

      <div className="flex gap-2">
        <Select value={selectedTenant} onValueChange={setSelectedTenant}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(p => {
          const st = STATUS_MAP[p.status] || STATUS_MAP.pending;
          const Icon = st.icon;
          return (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${st.color}`} />
                  <span className="font-semibold text-sm text-foreground">
                    R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{st.label}</Badge>
                  {p.payment_method && <Badge variant="secondary" className="text-[10px]">{p.payment_method}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{getTenantName(p.tenant_id)}</span>
                  {p.reference_month && <span>Ref: {p.reference_month}</span>}
                  {p.due_date && <span>Venc: {new Date(p.due_date).toLocaleDateString("pt-BR")}</span>}
                  {p.description && <span className="truncate max-w-[200px]">{p.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {p.status !== "paid" && (
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "paid")} className="text-xs h-7">
                    <Check className="w-3 h-3 mr-1" /> Pago
                  </Button>
                )}
                {p.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "overdue")} className="text-xs h-7 text-red-500">
                    Atrasar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Nenhum pagamento encontrado.</div>}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Empresa *</Label>
              <Select value={form.tenant_id} onValueChange={v => setForm(p => ({ ...p, tenant_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div>
                <Label className="text-xs">Método</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Mês Referência</Label><Input value={form.reference_month} onChange={e => setForm(p => ({ ...p, reference_month: e.target.value }))} placeholder="2026-03" /></div>
              <div><Label className="text-xs">Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Descrição</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPage;

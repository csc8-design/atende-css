import { useEffect, useState } from "react";
import { Building2, CreditCard, Key, Users, TrendingUp, AlertCircle } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface Stats {
  totalTenants: number;
  activeTenants: number;
  totalApis: number;
  pendingPayments: number;
  overduePayments: number;
  totalRevenue: number;
}

const BsecDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalTenants: 0, activeTenants: 0, totalApis: 0,
    pendingPayments: 0, overduePayments: 0, totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [tenants, apis, payments] = await Promise.all([
        supabaseAdmin.from("tenants").select("id, is_active"),
        supabaseAdmin.from("tenant_api_configs").select("id"),
        supabaseAdmin.from("tenant_payments").select("amount, status"),
      ]);

      const t = tenants.data || [];
      const p = (payments.data || []) as Array<{ amount: number; status: string }>;

      setStats({
        totalTenants: t.length,
        activeTenants: t.filter((x: any) => x.is_active).length,
        totalApis: (apis.data || []).length,
        pendingPayments: p.filter(x => x.status === "pending").length,
        overduePayments: p.filter(x => x.status === "overdue").length,
        totalRevenue: p.filter(x => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0),
      });
      setLoading(false);
    };
    fetch();
  }, []);

  const cards = [
    { icon: Building2, label: "Empresas Ativas", value: `${stats.activeTenants}/${stats.totalTenants}`, color: "text-blue-500" },
    { icon: Key, label: "APIs Configuradas", value: stats.totalApis, color: "text-green-500" },
    { icon: CreditCard, label: "Pagamentos Pendentes", value: stats.pendingPayments, color: "text-yellow-500" },
    { icon: AlertCircle, label: "Pagamentos Atrasados", value: stats.overduePayments, color: "text-red-500" },
    { icon: TrendingUp, label: "Receita Total", value: `R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-emerald-500" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel BSec</h1>
        <p className="text-sm text-muted-foreground">Visão geral da gestão de clientes e infraestrutura.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <c.icon className={`w-5 h-5 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BsecDashboard;

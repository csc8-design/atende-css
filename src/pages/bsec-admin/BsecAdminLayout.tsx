import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  Key,
  CreditCard,
  Paintbrush,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = "admin@bsec.com.br";

const navItems = [
  { icon: LayoutDashboard, label: "Visão Geral", path: "/bsec-admin" },
  { icon: Building2, label: "Empresas", path: "/bsec-admin/tenants" },
  { icon: Key, label: "APIs", path: "/bsec-admin/apis" },
  { icon: CreditCard, label: "Financeiro", path: "/bsec-admin/payments" },
  { icon: Paintbrush, label: "White-Label", path: "/bsec-admin/whitelabel" },
];

const BsecAdminLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-[240px] border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">BSec Admin</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Painel de Gestão Master</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === "/bsec-admin"
                ? location.pathname === "/bsec-admin"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar ao Sistema
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  );
};

export default BsecAdminLayout;

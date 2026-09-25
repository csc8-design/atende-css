import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3,
  History,
  HelpCircle,
  Calendar,
  Brain,
  MessagesSquare,
  Star,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronUp,
  Activity,
  Shield,
  Target,
  TrendingUp,
  Timer,
  Globe,
  ShoppingBag,
  Layers,
  ChevronDown,
  Wrench,
  ClipboardCheck,
  BriefcaseBusiness,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import brandLogo from "@/assets/logo-placeholder.svg";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COMERCIAL_DEPT_ID = "11111111-0001-4000-8000-000000000001";

const allNavItems: any[] = [
  { icon: MessageSquare, label: "Atendimento", path: "/inbox", roles: ["admin", "manager", "agent"] },
  {
    icon: BriefcaseBusiness,
    label: "Carteira de Clientes",
    path: "/carteira",
    roles: ["admin", "manager", "agent"],
    children: [
      { icon: BriefcaseBusiness, label: "Minha Carteira", path: "/minha-carteira", roles: ["admin", "manager", "agent"] },
      { icon: BarChart3, label: "Análise de Interações", path: "/carteira/analise", roles: ["admin", "manager"] },
    ],
  },
  { icon: ClipboardCheck, label: "Qualificação IA", path: "/qualificacao", roles: ["admin", "manager", "agent"], requiresQualEmail: true },
  { icon: Timer, label: "SLA - Atendimento", path: "/sla", roles: ["admin", "manager"] },
  { icon: MessagesSquare, label: "Chat Interno", path: "/chat", roles: ["admin", "manager", "agent"] },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", roles: ["admin", "manager", "agent"], requiresQualEmail: true },
  { icon: Target, label: "Prospecção", path: "/prospecting", roles: ["admin", "manager", "agent"] },
  { icon: Layers, label: "LEAD", path: "/clientes-compras", roles: ["admin", "manager"] },
  {
    icon: Wrench,
    label: "Utilitários",
    path: "/utilitarios",
    roles: ["admin", "manager", "agent"],
    children: [
      { icon: Activity, label: "Monitoramento", path: "/monitoring", roles: ["admin", "manager"] },
      { icon: Brain, label: "IA & Chatbot", path: "/chatbot", roles: ["admin", "manager"] },
      { icon: Users, label: "Contatos", path: "/contacts", roles: ["admin", "manager", "agent"] },
      { icon: BarChart3, label: "Relatórios", path: "/reports", roles: ["admin", "manager"] },
      { icon: Star, label: "Avaliações", path: "/satisfaction", roles: ["admin", "manager"] },
      { icon: TrendingUp, label: "CRM", path: "/crm", roles: ["admin", "manager", "agent"], requiresComercial: true },
    ],
  },
  { icon: Settings, label: "Configurações", path: "/settings", roles: ["admin", "manager", "agent"] },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInComercial, setIsInComercial] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { profile, user, roles, signOut } = useAuth();
  const { branding } = useBranding();

  // Check if agent is in any Comercial dept (admin/manager always see)
  useEffect(() => {
    if (!user) return;
    if (roles.includes("admin") || roles.includes("manager")) {
      setIsInComercial(true);
      return;
    }
    (async () => {
      const { data: depts } = await supabase
        .from("departments")
        .select("id")
        .ilike("name", "Comercial%");
      const ids = (depts || []).map((d: any) => d.id);
      if (ids.length === 0) { setIsInComercial(false); return; }
      const { data } = await supabase
        .from("agent_departments")
        .select("id")
        .eq("agent_id", user.id)
        .in("department_id", ids)
        .limit(1);
      setIsInComercial(!!(data && data.length));
    })();
  }, [user, roles]);

  // Fetch unread conversations count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gt("unread_count", 0)
        .in("status", ["open", "pending"]);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel("unread-conv-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);


  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleName = roles.includes("admin") ? "Administrador" : roles.includes("manager") ? "Gerente" : "Agente";

  const isAgent = !roles.includes("admin") && !roles.includes("manager");

  const hasQualEmailAccess = roles.includes("admin") || roles.includes("manager");

  const filteredNavItems = allNavItems
    .map((item: any) => {
      if (!item.children) return item;
      const kids = item.children.filter((c: any) => {
        if (!c.roles.some((r: string) => roles.includes(r as any))) return false;
        if (c.requiresComercial && !isInComercial) return false;
        if (c.requiresQualEmail && !hasQualEmailAccess) return false;
        return true;
      });
      return { ...item, children: kids };
    })
    .filter((item: any) => {
      if (!item.roles.some((r: string) => roles.includes(r as any))) return false;
      if (item.requiresComercial && !isInComercial) return false;
      if (item.requiresQualEmail && !hasQualEmailAccess) return false;
      if (item.children && item.children.length === 0) return false;
      return true;
    });

  // Track open state for grouped nav items (e.g. LEAD)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    filteredNavItems.forEach((it: any) => {
      if (it.children) {
        initial[it.path] = it.children.some((c: any) => location.pathname.startsWith(c.path));
      }
    });
    return initial;
  });

  const renderNavEntry = (item: any) => {
    // Grouped item with children
    if (item.children) {
      const anyChildActive = item.children.some((c: any) => location.pathname.startsWith(c.path));
      const isOpen = openGroups[item.path] ?? anyChildActive;

      if (collapsed) {
        // Collapsed: show parent icon as link to first child + tooltip
        const first = item.children[0];
        return (
          <Link
            key={item.path}
            to={first.path}
            title={item.label}
            className={`flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
              anyChildActive
                ? "bg-primary/15 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground"
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${anyChildActive ? "text-primary" : ""}`} />
            <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground text-xs font-medium shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {item.label}
            </span>
          </Link>
        );
      }

      return (
        <div key={item.path} className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenGroups((s) => ({ ...s, [item.path]: !isOpen }))}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              anyChildActive
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground"
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${anyChildActive ? "text-primary" : ""}`} />
            <span className="animate-fade-in flex-1 text-left tracking-wide">{item.label}</span>
            <ChevronDown
              className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
          {isOpen && (
            <div className="flex flex-col gap-1 mt-1 ml-3 pl-3 border-l border-sidebar-border">
              {item.children.map((child: any) => {
                const childActive = location.pathname.startsWith(child.path);
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      childActive
                        ? "bg-primary/15 text-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-primary-foreground"
                    }`}
                  >
                    <child.icon className={`w-4 h-4 flex-shrink-0 ${childActive ? "text-primary" : ""}`} />
                    <span className="animate-fade-in">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Regular item
    const isActive = location.pathname.startsWith(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
          isActive
            ? "bg-primary/15 text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground"
        }`}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
        {!collapsed && <span className="animate-fade-in">{item.label}</span>}
        {item.path === "/inbox" && unreadCount > 0 && (
          <span className={`${collapsed ? "absolute -top-1 -right-1" : "ml-auto"} min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {isActive && !collapsed && item.path !== "/inbox" && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
        )}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground text-xs font-medium shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  // Agent: sidebar with expand/collapse like admin
  if (isAgent) {
    return (
      <aside
        className={`h-screen sticky top-0 flex flex-col transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-[220px]"
        }`}
        style={{ background: "var(--gradient-sidebar)" }}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center h-16 border-b border-sidebar-border overflow-hidden ${collapsed ? "px-3" : "px-0"}`}>
          {collapsed ? (
            branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.platform_name} className="h-8 object-contain flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
            )
          ) : (
            <img src={brandLogo} alt="Atende CSS · ENGWE" className="w-full h-full object-cover animate-fade-in" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 pt-4 px-3 overflow-y-auto">
          {filteredNavItems.map((item) => renderNavEntry(item))}
        </nav>

        {/* Notifications */}
        <div className="px-3 pb-1">
          <NotificationBell collapsed={collapsed} />
        </div>

        {/* User profile dropdown */}
        <div className="px-3 pb-2 border-t border-sidebar-border pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground transition-colors">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {initials}
                  </div>
                )}
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0 animate-fade-in">
                      <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                      <p className="text-[10px] text-sidebar-foreground/60 truncate">{roleName}</p>
                    </div>
                    <ChevronUp className="w-4 h-4 flex-shrink-0 opacity-60" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-foreground">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
                <User className="w-4 h-4 mr-2" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                {isDark ? "Modo Claro" : "Modo Escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Collapse toggle */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    );
  }

  // Admin/Manager: full sidebar
  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-[240px]"
      }`}
      style={{ background: "var(--gradient-sidebar)" }}
    >
      {/* Logo */}
      <div className={`flex items-center justify-center h-16 border-b border-sidebar-border overflow-hidden ${collapsed ? "px-3" : "px-0"}`}>
        {collapsed ? (
          branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.platform_name} className="h-8 object-contain flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
          )
        ) : (
          <img src={brandLogo} alt="Atende CSS · ENGWE" className="w-full h-full object-cover animate-fade-in" />
        )}
      </div>

      {/* Dashboard link - only for admin/manager */}
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            location.pathname === "/"
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground"
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 flex-shrink-0 ${location.pathname === "/" ? "text-primary" : ""}`} />
          {!collapsed && <span className="animate-fade-in">Dashboard</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {filteredNavItems.map((item) => renderNavEntry(item))}
      </nav>

      {/* Notifications */}
      <div className="px-3 pb-1">
        <NotificationBell collapsed={collapsed} />
      </div>

      {/* User profile dropdown */}
      <div className="px-3 pb-2 border-t border-sidebar-border pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground transition-colors">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {initials}
                </div>
              )}
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0 animate-fade-in">
                    <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                    <p className="text-[10px] text-sidebar-foreground/60 truncate">{roleName}</p>
                  </div>
                  <ChevronUp className="w-4 h-4 flex-shrink-0 opacity-60" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {isDark ? "Modo Claro" : "Modo Escuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapse toggle */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;

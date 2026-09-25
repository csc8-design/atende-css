import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Paintbrush } from "lucide-react";
import {
  SlidersHorizontal,
  Zap,
  Building2,
  Users,
  Contact,
  Tag,
  CheckCircle2,
  Clock,
  Bot,
  Brain,
  Code2,
  CreditCard,
  User,
  Puzzle,
  Palette,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const allSettingsNav = [
  { icon: SlidersHorizontal, label: "Ajustes Gerais", path: "/settings", access: "admin" as const },
  { icon: Zap, label: "Respostas Rápidas", path: "/settings/quick-replies", access: "all" as const },
  { icon: Building2, label: "Departamentos", path: "/settings/departments", access: "admin" as const },
  { icon: Users, label: "Usuários", path: "/settings/users", access: "admin" as const },
  { icon: Contact, label: "Contatos", path: "/settings/contacts", access: "admin" as const },
  { icon: Tag, label: "Etiquetas", path: "/settings/tags", access: "admin" as const },
  { icon: CheckCircle2, label: "Motivos de Finalização", path: "/settings/closing-reasons", access: "admin" as const },
  { icon: Clock, label: "Jornada de Trabalho", path: "/settings/work-schedule", access: "admin" as const },
  { icon: Bot, label: "Chatbot", path: "/settings/chatbot", access: "admin" as const },
  { icon: Brain, label: "Inteligência Artificial", path: "/settings/ai", access: "admin" as const },
  { icon: Puzzle, label: "Widgets", path: "/settings/widgets", access: "admin" as const },
  { icon: Code2, label: "Desenvolvedor", path: "/settings/developer", access: "admin" as const },
  { icon: CreditCard, label: "Pagamento", path: "/settings/billing", access: "admin" as const },
  { icon: Paintbrush, label: "White-Label", path: "/settings/branding", access: "superadmin" as const },
  { icon: Palette, label: "Aparência", path: "/settings/appearance", access: "all" as const },
  { icon: User, label: "Meus Dados", path: "/settings/profile", access: "all" as const },
];


const SettingsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const isMobile = useIsMobile();

  const isSuperAdmin = isAdmin;

  const settingsNav = allSettingsNav.filter(
    (item) => {
      if (item.access === "superadmin") return isSuperAdmin;
      return isAdmin || item.access === "all";
    }
  );

  // On mobile, determine if we're on the root settings menu or a sub-page
  const isSettingsRoot = location.pathname === "/settings";
  const isSubPage = !isSettingsRoot && location.pathname.startsWith("/settings/");

  if (isMobile) {
    // Show the sub-page content with a back button
    if (isSubPage) {
      const currentItem = settingsNav.find(item => item.path === location.pathname);
      return (
        <AppLayout>
          <div className="flex flex-col h-[calc(100dvh-56px)]">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
              <button onClick={() => navigate("/settings")} className="p-1 text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-foreground">{currentItem?.label || "Configurações"}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Outlet />
            </div>
          </div>
        </AppLayout>
      );
    }

    // Settings root: show the general settings content OR the menu
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100dvh-56px)]">
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          </div>

          {/* Channel connection card */}
          {isAdmin && (
            <div className="mx-4 mb-3 p-3 rounded-xl border border-border bg-secondary/50">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-channel-whatsapp flex items-center justify-center text-[9px] font-bold text-white">W</div>
                <div className="w-5 h-5 rounded-full bg-channel-messenger flex items-center justify-center text-[9px] font-bold text-white">M</div>
                <div className="w-5 h-5 rounded-full bg-channel-instagram flex items-center justify-center text-[9px] font-bold text-white">I</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Conecte a plataforma à sua conta do WhatsApp, Facebook ou Instagram.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <nav className="px-2">
              {settingsNav.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground active:bg-secondary"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Also render the Outlet for the root /settings page (GeneralSettings) */}
          <div className="hidden">
            <Outlet />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Desktop layout
  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Settings sidebar */}
        <div className="w-[260px] border-r border-border bg-card overflow-y-auto scrollbar-thin p-4">
          {/* Channels connection card */}
          {isAdmin && (
            <div className="mb-6 p-4 rounded-xl border border-border bg-secondary/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-channel-whatsapp flex items-center justify-center text-[10px] font-bold text-white">W</div>
                <div className="w-6 h-6 rounded-full bg-channel-messenger flex items-center justify-center text-[10px] font-bold text-white">M</div>
                <div className="w-6 h-6 rounded-full bg-channel-instagram flex items-center justify-center text-[10px] font-bold text-white">I</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Conecte a plataforma à sua conta do WhatsApp, Facebook ou Instagram.
              </p>
            </div>
          )}

          <nav className="space-y-0.5">
            {settingsNav.map((item) => {
              const isActive = location.pathname === item.path;
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsLayout;

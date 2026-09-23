import { Link, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Users,
  LayoutDashboard,
  Settings,
  MoreHorizontal,
  MessagesSquare,
  Activity,
  Brain,
  Calendar,
  BarChart3,
  Star,
  Megaphone,
  History,
  HelpCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import NotificationBell from "./NotificationBell";

const MobileBottomNav = () => {
  const location = useLocation();
  const { roles, isAdmin, isManager } = useAuth();
  const { branding } = useBranding();
  const [unreadCount, setUnreadCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .gt("unread_count", 0)
        .in("status", ["open", "pending"]);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel("mobile-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchUnread, 500);
      })
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const primaryTabs = [
    ...(isAdmin || isManager ? [{ icon: LayoutDashboard, label: "Início", path: "/" }] : []),
    { icon: MessageSquare, label: "Atendimento", path: "/inbox", badge: unreadCount },
    { icon: MessagesSquare, label: "Chat", path: "/chat" },
    { icon: Users, label: "Contatos", path: "/contacts" },
  ];

  const moreItems = [
    ...(isAdmin || isManager ? [
      { icon: Activity, label: "Monitoramento", path: "/monitoring" },
      { icon: Brain, label: "IA & Chatbot", path: "/chatbot" },
      
      { icon: BarChart3, label: "Relatórios", path: "/reports" },
      { icon: Star, label: "Avaliações", path: "/satisfaction" },
      { icon: Megaphone, label: "Campanhas", path: "/campaigns" },
      
    ] : []),
    { icon: Settings, label: "Configurações", path: "/settings" },
    
  ];

  const isMoreActive = moreItems.some(item => isActive(item.path));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom safe-area-left safe-area-right">
        <div className="flex items-center justify-around h-14 px-1">
          {primaryTabs.map((tab) => {
            const active = tab.path === "/" ? location.pathname === "/" : isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <tab.icon className="w-5 h-5" />
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative transition-colors ${
                  isMoreActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">Mais</span>
                {isMoreActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  {branding.platform_name}
                </SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {moreItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 px-2">
                <NotificationBell collapsed={false} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      {/* Spacer to prevent content from hiding behind nav */}
      <div className="h-14 flex-shrink-0" />
    </>
  );
};

export default MobileBottomNav;

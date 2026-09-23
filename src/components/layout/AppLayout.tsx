import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import MobileBottomNav from "./MobileBottomNav";
import OnlineUsersPopup from "./OnlineUsersPopup";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
  hideBottomNav?: boolean;
}

const AppLayout = ({ children, hideBottomNav }: AppLayoutProps) => {
  useBrowserNotifications();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background safe-area-top safe-area-left safe-area-right">
        <main className="flex-1 overflow-auto">{children}</main>
        {!hideBottomNav && <MobileBottomNav />}
        <OnlineUsersPopup />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <OnlineUsersPopup />
    </div>
  );
};

export default AppLayout;


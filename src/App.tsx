import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import InternalChat from "./pages/InternalChat";
import Reports from "./pages/Reports";
import SatisfactionReports from "./pages/SatisfactionReports";



import Auth from "./pages/Auth";
import AIChatbot from "./pages/AIChatbot";
import NotFound from "./pages/NotFound";
import Monitoring from "./pages/Monitoring";
import Prospecting from "./pages/Prospecting";
import Crm from "./pages/Crm";
import SLA from "./pages/SLA";
import CbmaqSiteLeads from "./pages/CbmaqSiteLeads";
import ClientesCompras from "./pages/ClientesCompras";
import Qualificacao from "./pages/Qualificacao";
import MinhaCarteira from "./pages/MinhaCarteira";
import AnaliseInteracoes from "./pages/AnaliseInteracoes";

// BSec Admin
import BsecAdminLayout from "./pages/bsec-admin/BsecAdminLayout";
import BsecDashboard from "./pages/bsec-admin/BsecDashboard";
import TenantsPage from "./pages/bsec-admin/TenantsPage";
import ApisPage from "./pages/bsec-admin/ApisPage";
import PaymentsPage from "./pages/bsec-admin/PaymentsPage";
import WhitelabelPage from "./pages/bsec-admin/WhitelabelPage";

// Settings
import SettingsLayout from "./pages/settings/SettingsLayout";
import GeneralSettings from "./pages/settings/GeneralSettings";
import QuickReplies from "./pages/settings/QuickReplies";
import Departments from "./pages/settings/Departments";
import UsersSettings from "./pages/settings/UsersSettings";
import ContactsSettings from "./pages/settings/ContactsSettings";
import Tags from "./pages/settings/Tags";
import ClosingReasons from "./pages/settings/ClosingReasons";
import WorkSchedule from "./pages/settings/WorkSchedule";
import ChatbotSettings from "./pages/settings/ChatbotSettings";
import AISettings from "./pages/settings/AISettings";
import WidgetsSettings from "./pages/settings/WidgetsSettings";
import DeveloperSettings from "./pages/settings/DeveloperSettings";
import BillingSettings from "./pages/settings/BillingSettings";
import ProfileSettings from "./pages/settings/ProfileSettings";
import AppearanceSettings from "./pages/settings/AppearanceSettings";
import BrandingSettings from "./pages/settings/BrandingSettings";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SettingsIndex = () => {
  const { isManager, isAdmin } = useAuth();
  if (isManager || isAdmin) return <GeneralSettings />;
  return <Navigate to="/settings/appearance" replace />;
};

const DashboardRoute = () => {
  const { isManager, isAdmin } = useAuth();
  if (isManager || isAdmin) return <Dashboard />;
  return <Navigate to="/inbox" replace />;
};

const AppRoutes = () => {
  const { branding } = useBranding();

  useEffect(() => {
    if (branding.platform_name) {
      document.title = branding.platform_name;
    }
    if (branding.favicon_url) {
      const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (link) link.href = branding.favicon_url;
    }
  }, [branding.platform_name, branding.favicon_url]);

  return (
  <Routes>
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><DashboardRoute /></ProtectedRoute>} />
    <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
    <Route path="/sla" element={<ProtectedRoute><SLA /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />
    <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
    <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
    <Route path="/chatbot" element={<ProtectedRoute><AIChatbot /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/satisfaction" element={<ProtectedRoute><SatisfactionReports /></ProtectedRoute>} />
    
    
    
    <Route path="/monitoring" element={<ProtectedRoute><Monitoring /></ProtectedRoute>} />
    <Route path="/prospecting" element={<ProtectedRoute><Prospecting /></ProtectedRoute>} />
    <Route path="/crm" element={<ProtectedRoute><Crm /></ProtectedRoute>} />
    <Route path="/cbmaq-site-leads" element={<ProtectedRoute><CbmaqSiteLeads /></ProtectedRoute>} />
    <Route path="/clientes-compras" element={<ProtectedRoute><ClientesCompras /></ProtectedRoute>} />
    <Route path="/qualificacao" element={<ProtectedRoute><Qualificacao /></ProtectedRoute>} />
    <Route path="/minha-carteira" element={<ProtectedRoute><MinhaCarteira /></ProtectedRoute>} />
    <Route path="/carteira/analise" element={<ProtectedRoute><AnaliseInteracoes /></ProtectedRoute>} />

    {/* Settings */}
    <Route path="/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
      <Route index element={<SettingsIndex />} />
      <Route path="quick-replies" element={<QuickReplies />} />
      <Route path="departments" element={<Departments />} />
      <Route path="users" element={<UsersSettings />} />
      <Route path="contacts" element={<ContactsSettings />} />
      <Route path="tags" element={<Tags />} />
      <Route path="closing-reasons" element={<ClosingReasons />} />
      <Route path="work-schedule" element={<WorkSchedule />} />
      <Route path="chatbot" element={<ChatbotSettings />} />
      <Route path="ai" element={<AISettings />} />
      <Route path="widgets" element={<WidgetsSettings />} />
      <Route path="developer" element={<DeveloperSettings />} />
      <Route path="billing" element={<BillingSettings />} />
      <Route path="profile" element={<ProfileSettings />} />
      <Route path="appearance" element={<AppearanceSettings />} />
      <Route path="branding" element={<BrandingSettings />} />
    </Route>

    {/* BSec Admin - Painel Master */}
    <Route path="/bsec-admin" element={<ProtectedRoute><BsecAdminLayout /></ProtectedRoute>}>
      <Route index element={<BsecDashboard />} />
      <Route path="tenants" element={<TenantsPage />} />
      <Route path="apis" element={<ApisPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="whitelabel" element={<WhitelabelPage />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


-- Fix chatbot_logs: restrict SELECT to admins/managers/assigned agents
DROP POLICY IF EXISTS "Authenticated can view chatbot logs" ON public.chatbot_logs;
CREATE POLICY "Admins/managers can view chatbot logs"
  ON public.chatbot_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Fix chatbot_configs: restrict SELECT to admins/managers
DROP POLICY IF EXISTS "Authenticated can view chatbot configs" ON public.chatbot_configs;
CREATE POLICY "Admins/managers can view chatbot configs"
  ON public.chatbot_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Fix campaigns: restrict SELECT to admins/managers
DROP POLICY IF EXISTS "Authenticated can view campaigns" ON public.campaigns;
CREATE POLICY "Admins/managers can view campaigns"
  ON public.campaigns FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Fix campaign_contacts: restrict SELECT to admins/managers
DROP POLICY IF EXISTS "Authenticated can view campaign contacts" ON public.campaign_contacts;
CREATE POLICY "Admins/managers can view campaign contacts"
  ON public.campaign_contacts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Fix system_settings: restrict to admins/managers only (already have ALL policy, just remove public SELECT)
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.system_settings;
CREATE POLICY "Admins/managers can view settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

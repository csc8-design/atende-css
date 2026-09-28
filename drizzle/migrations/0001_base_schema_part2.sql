CREATE TABLE public.satisfaction_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID,
  department_id UUID REFERENCES public.departments(id),
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.satisfaction_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers can view all ratings" ON public.satisfaction_ratings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Agents can view own ratings" ON public.satisfaction_ratings FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Admins/managers can manage ratings" ON public.satisfaction_ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE INDEX idx_satisfaction_ratings_conversation ON public.satisfaction_ratings(conversation_id);
CREATE INDEX idx_satisfaction_ratings_agent ON public.satisfaction_ratings(agent_id);
CREATE INDEX idx_satisfaction_ratings_rating ON public.satisfaction_ratings(rating);

INSERT INTO public.departments (name, description) VALUES
  ('Comercial / Revendedores', 'Prospecção e atendimento de revendedores ENGWE'),
  ('Comercial / Vendas Online', 'Vendas pelo canal online'),
  ('Financeiro', 'Departamento financeiro'),
  ('Pós-Vendas / Garantia', 'Garantia e assistência técnica'),
  ('Pós-Vendas / Peças', 'Peças de reposição');

CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_channel_id UUID;
BEGIN
  SELECT ic.id INTO v_channel_id
  FROM internal_channels ic
  WHERE ic.channel_type = 'direct'
    AND EXISTS (SELECT 1 FROM channel_members cm1 WHERE cm1.channel_id = ic.id AND cm1.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM channel_members cm2 WHERE cm2.channel_id = ic.id AND cm2.user_id = other_user_id)
    AND (SELECT COUNT(*) FROM channel_members cm3 WHERE cm3.channel_id = ic.id) = 2
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO internal_channels (channel_type, created_by)
    VALUES ('direct', auth.uid())
    RETURNING id INTO v_channel_id;

    INSERT INTO channel_members (channel_id, user_id, role)
    VALUES (v_channel_id, auth.uid(), 'admin'), (v_channel_id, other_user_id, 'admin');
  END IF;

  RETURN v_channel_id;
END;
$function$;

DROP POLICY IF EXISTS "Managers see all conversations" ON public.conversations;
CREATE POLICY "Managers see department conversations" ON public.conversations FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND (
      department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid())
      OR department_id IS NULL
    )
  )
);
DROP POLICY IF EXISTS "Admins/managers can manage conversations" ON public.conversations;
CREATE POLICY "Admins can manage all conversations" ON public.conversations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage department conversations" ON public.conversations FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND (
    department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid())
    OR department_id IS NULL
  )
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'inactivity_alert',
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins/managers can manage settings" ON public.system_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
INSERT INTO public.system_settings (key, value) VALUES
  ('instance_name', '"Atende CSS · ENGWE"'),
  ('welcome_message', '"Olá! Bem-vindo à ENGWE Brasil."'),
  ('closing_message', '"Obrigado pelo contato com a ENGWE Brasil!"'),
  ('satisfaction_rating_enabled', 'true'),
  ('auto_distribution_enabled', 'false'),
  ('auto_distribution_interval', '5'),
  ('default_user_enabled', 'true'),
  ('default_user_message', '"Aguarde um instante que já vamos atendê-lo(a)."'),
  ('show_agent_name', 'true'),
  ('mask_phone_numbers', 'true'),
  ('hide_campaign_conversations', 'true'),
  ('auto_close_enabled', 'false'),
  ('auto_close_minutes', '60'),
  ('business_hours_enabled', 'false'),
  ('mfa_enabled', 'false'),
  ('timezone', '"America/Sao_Paulo"'),
  ('country_code', '"+55"')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.chatbot_configs ADD COLUMN menu_options jsonb DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.is_channel_admin(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id AND role = 'admin') $$;

DROP POLICY IF EXISTS "Channel admins can manage members" ON public.channel_members;
DROP POLICY IF EXISTS "Channel admins can remove members" ON public.channel_members;
DROP POLICY IF EXISTS "Members can leave" ON public.channel_members;
DROP POLICY IF EXISTS "Members can view channel members" ON public.channel_members;
CREATE POLICY "Members can view channel members" ON public.channel_members FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Channel admins can manage members" ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (
    is_channel_admin(channel_id, auth.uid())
    OR auth.uid() = (SELECT created_by FROM internal_channels WHERE id = channel_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Channel admins can remove members" ON public.channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_channel_admin(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their channels" ON public.internal_channels;
DROP POLICY IF EXISTS "Channel admins can update" ON public.internal_channels;
CREATE POLICY "Members can view their channels" ON public.internal_channels FOR SELECT TO authenticated
  USING (is_channel_member(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Channel admins can update" ON public.internal_channels FOR UPDATE TO authenticated
  USING (is_channel_admin(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members can view channel messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.internal_messages;
CREATE POLICY "Members can view channel messages" ON public.internal_messages FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()));
CREATE POLICY "Members can send messages" ON public.internal_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_channel_member(channel_id, auth.uid()));

ALTER TABLE public.channel_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
CREATE POLICY "Members can update own membership" ON public.channel_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated can view avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');

CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  schedule_type TEXT NOT NULL DEFAULT 'meeting',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers can view all schedules" ON public.schedules FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));
CREATE POLICY "Agents can view own schedules" ON public.schedules FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Authenticated users can create schedules" ON public.schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE
USING (agent_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));
CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_schedules_agent_id ON public.schedules(agent_id);
CREATE INDEX idx_schedules_scheduled_at ON public.schedules(scheduled_at);
CREATE INDEX idx_schedules_status ON public.schedules(status);

CREATE POLICY "Authenticated users can upload audio" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'internal-audio' AND auth.uid() IS NOT NULL);
ALTER TABLE public.internal_messages
ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url text;

CREATE POLICY "Admins/managers can delete contacts" ON public.contacts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins/managers can insert contacts" ON public.contacts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated can view whatsapp media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'whatsapp-media');
CREATE POLICY "Authenticated can upload whatsapp media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp-media');
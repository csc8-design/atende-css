CREATE POLICY "Agents can update own messages" ON public.messages FOR UPDATE
USING (sender_id = auth.uid() AND sender_type = 'agent')
WITH CHECK (sender_id = auth.uid() AND sender_type = 'agent');
CREATE POLICY "Agents can delete own messages" ON public.messages FOR DELETE
USING (sender_id = auth.uid() AND sender_type = 'agent');
CREATE POLICY "Admins can delete any messages" ON public.messages FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete notes" ON public.conversation_notes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any conversation tags" ON public.conversation_tags FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  template_name TEXT,
  template_language TEXT DEFAULT 'pt_BR',
  template_category TEXT DEFAULT 'MARKETING',
  template_components JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  send_rate_per_second INTEGER DEFAULT 10,
  batch_size INTEGER DEFAULT 50,
  batch_delay_seconds INTEGER DEFAULT 5,
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  whatsapp_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/managers can manage campaigns" ON public.campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins/managers can view campaigns" ON public.campaigns FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins/managers can manage campaign contacts" ON public.campaign_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins/managers can view campaign contacts" ON public.campaign_contacts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaign_contacts_campaign ON public.campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON public.campaign_contacts(campaign_id, status);
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Authenticated can view chatbot logs" ON public.chatbot_logs;
CREATE POLICY "Admins/managers can view chatbot logs" ON public.chatbot_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
DROP POLICY IF EXISTS "Authenticated can view chatbot configs" ON public.chatbot_configs;
CREATE POLICY "Admins/managers can view chatbot configs" ON public.chatbot_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.system_settings;
CREATE POLICY "Admins/managers can view settings" ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.closing_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.closing_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view closing reasons" ON public.closing_reasons FOR SELECT USING (true);
CREATE POLICY "Admins/managers can manage closing reasons" ON public.closing_reasons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
INSERT INTO public.closing_reasons (name, description) VALUES
  ('Venda Concluída', 'Cliente finalizou a compra'),
  ('Sem Interesse', 'Lead não demonstrou interesse'),
  ('Problema Resolvido', 'Suporte resolveu a demanda'),
  ('Spam', 'Mensagem indesejada ou spam'),
  ('Duplicado', 'Conversa duplicada'),
  ('Transferido', 'Transferido para outro departamento'),
  ('Sem Resposta', 'Cliente não respondeu');

CREATE POLICY "Agents see contacts from assigned conversations" ON public.contacts FOR SELECT
USING (EXISTS (SELECT 1 FROM conversations c WHERE c.contact_id = contacts.id AND c.assigned_agent_id = auth.uid()));
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Agents see contacts from unassigned dept conversations" ON public.contacts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversations c JOIN agent_departments ad ON ad.department_id = c.department_id
  WHERE c.contact_id = contacts.id AND c.assigned_agent_id IS NULL AND ad.agent_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can view messages of visible conversations" ON public.messages;
CREATE POLICY "Users can view messages of visible conversations" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (
      c.assigned_agent_id = auth.uid()
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR (c.assigned_agent_id IS NULL AND c.department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()))
    )
  ));

DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Managers can manage department conversations" ON public.conversations;
DROP POLICY IF EXISTS "Agents can update assigned conversations" ON public.conversations;
DROP POLICY IF EXISTS "Agents see assigned conversations" ON public.conversations;
DROP POLICY IF EXISTS "Managers see department conversations" ON public.conversations;
CREATE POLICY "select_admin" ON public.conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "select_manager_dept" ON public.conversations FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) AND department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()));
CREATE POLICY "select_agent_assigned" ON public.conversations FOR SELECT
USING (assigned_agent_id = auth.uid() OR (assigned_agent_id IS NULL AND department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid())));
CREATE POLICY "update_admin" ON public.conversations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (true);
CREATE POLICY "update_agent" ON public.conversations FOR UPDATE TO authenticated
USING ((assigned_agent_id = auth.uid()) OR (assigned_agent_id IS NULL AND department_id IN (SELECT department_id FROM agent_departments WHERE agent_id = auth.uid())))
WITH CHECK (true);
CREATE POLICY "update_manager_dept" ON public.conversations FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND department_id IN (SELECT department_id FROM agent_departments WHERE agent_id = auth.uid()))
WITH CHECK (true);
CREATE POLICY "insert_admin" ON public.conversations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert_manager" ON public.conversations FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "insert_authenticated" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "delete_admin" ON public.conversations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.transfer_conversation(
  _conversation_id uuid,
  _department_id uuid,
  _agent_id uuid DEFAULT NULL::uuid,
  _status text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _conv RECORD;
  _user_id uuid := auth.uid();
  _has_access boolean := false;
BEGIN
  SELECT * INTO _conv FROM conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  IF has_role(_user_id, 'admin') THEN
    _has_access := true;
  ELSIF has_role(_user_id, 'manager') AND EXISTS (
    SELECT 1 FROM agent_departments WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  ELSIF _conv.assigned_agent_id = _user_id THEN
    _has_access := true;
  ELSIF EXISTS (
    SELECT 1 FROM agent_departments WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  END IF;
  IF NOT _has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE conversations
  SET department_id = _department_id,
      assigned_agent_id = _agent_id,
      status = COALESCE(_status::conversation_status, status),
      updated_at = now()
  WHERE id = _conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_contact_to_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL AND (OLD.assigned_agent_id IS NULL OR OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id) THEN
    UPDATE contacts
    SET assigned_agent_id = NEW.assigned_agent_id, updated_at = now()
    WHERE id = NEW.contact_id AND assigned_agent_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_auto_assign_contact
AFTER UPDATE OF assigned_agent_id ON conversations
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_contact_to_agent();
UPDATE public.departments SET is_active = false;
INSERT INTO public.departments (id, name, is_active) VALUES
  ('11111111-0001-4000-8000-000000000001', 'Comercial', true),
  ('11111111-0001-4000-8000-000000000002', 'Financeiro', true),
  ('11111111-0001-4000-8000-000000000003', 'Pós-Vendas', true),
  ('11111111-0001-4000-8000-000000000004', 'Peças', true),
  ('11111111-0001-4000-8000-000000000005', 'Loja Online', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

DROP POLICY IF EXISTS "select_agent_assigned" ON public.conversations;
DROP POLICY IF EXISTS "update_agent" ON public.conversations;
CREATE POLICY "select_agent_dept" ON public.conversations FOR SELECT
USING (assigned_agent_id = auth.uid() OR department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()));
CREATE POLICY "update_agent_dept" ON public.conversations FOR UPDATE TO authenticated
USING (assigned_agent_id = auth.uid() OR department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()))
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_notif_log_agent_time ON public.agent_notification_log(agent_id, notified_at DESC);
ALTER TABLE public.agent_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view notification log" ON public.agent_notification_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.notify_dept_agents_on_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _supabase_url text;
  _should_notify boolean := false;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.department_id IS NOT NULL AND NEW.assigned_agent_id IS NULL THEN
      _should_notify := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.department_id IS NOT NULL
       AND NEW.assigned_agent_id IS NULL
       AND (OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
      _should_notify := true;
    END IF;
  END IF;

  IF NOT _should_notify THEN
    RETURN NEW;
  END IF;

  _supabase_url := 'https://pehagrzomfrmduhbciss.supabase.co';

  BEGIN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-agent-whatsapp',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('conversation_id', NEW.id, 'department_id', NEW.department_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_dept_agents_insert AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.notify_dept_agents_on_new_conversation();
CREATE TRIGGER trg_notify_dept_agents_update AFTER UPDATE OF department_id, assigned_agent_id ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.notify_dept_agents_on_new_conversation();

CREATE OR REPLACE FUNCTION public.close_conversation(_conversation_id uuid, _closing_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SET status = 'resolved'::conversation_status,
      closed_at = now(),
      closing_reason = _closing_reason,
      assigned_agent_id = NULL,
      department_id = NULL,
      updated_at = now()
  WHERE id = _conversation_id;
END;
$$;

CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position int NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.crm_stages (name, position, color) VALUES
  ('Prospecção', 1, '#94a3b8'),
  ('Qualificação Inicial', 2, '#64748b'),
  ('Negócios Prováveis', 3, '#0ea5e9'),
  ('Proposta Comercial', 4, '#f59e0b'),
  ('Negociação', 5, '#a855f7'),
  ('Fechamento', 6, '#10b981'),
  ('Pós-Vendas', 7, '#22c55e');

CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid UNIQUE NOT NULL,
  contact_id uuid NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
  title text NOT NULL,
  company_name text,
  contact_name text,
  estimated_value numeric DEFAULT 0,
  priority int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'em_andamento',
  temperature text,
  assigned_agent_id uuid,
  notes text,
  next_contact_at timestamptz,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_deals_stage ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_conversation ON public.crm_deals(conversation_id);

CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_crm_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(_user_id, 'admin'::app_role)
    OR has_role(_user_id, 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM agent_departments ad WHERE ad.agent_id = _user_id AND ad.department_id = '11111111-0001-4000-8000-000000000001'::uuid);
$$;

CREATE POLICY "CRM users view stages" ON public.crm_stages FOR SELECT TO authenticated USING (has_crm_access(auth.uid()));
CREATE POLICY "Admins manage stages" ON public.crm_stages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "CRM users view deals" ON public.crm_deals FOR SELECT TO authenticated USING (has_crm_access(auth.uid()));
CREATE POLICY "CRM users update deals" ON public.crm_deals FOR UPDATE TO authenticated USING (has_crm_access(auth.uid())) WITH CHECK (has_crm_access(auth.uid()));
CREATE POLICY "CRM users insert deals" ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (has_crm_access(auth.uid()));
CREATE POLICY "Admins delete deals" ON public.crm_deals FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "CRM users manage tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_crm_access(auth.uid())) WITH CHECK (has_crm_access(auth.uid()));
CREATE TRIGGER trg_crm_deals_updated BEFORE UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.crm_sync_deal_from_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _comercial_id uuid := '11111111-0001-4000-8000-000000000001';
  _first_stage uuid;
  _contact_name text;
BEGIN
  IF NEW.department_id IS DISTINCT FROM _comercial_id THEN
    RETURN NEW;
  END IF;
  SELECT id INTO _first_stage FROM crm_stages ORDER BY position ASC LIMIT 1;
  SELECT name INTO _contact_name FROM contacts WHERE id = NEW.contact_id;
  INSERT INTO crm_deals (conversation_id, contact_id, stage_id, title, contact_name, assigned_agent_id, temperature, last_interaction_at)
  VALUES (NEW.id, NEW.contact_id, _first_stage, COALESCE(_contact_name, 'Negociação'), _contact_name, NEW.assigned_agent_id, NEW.lead_score, COALESCE(NEW.last_message_at, now()))
  ON CONFLICT (conversation_id) DO UPDATE
    SET assigned_agent_id = EXCLUDED.assigned_agent_id,
        temperature = COALESCE(EXCLUDED.temperature, crm_deals.temperature),
        last_interaction_at = EXCLUDED.last_interaction_at,
        updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crm_sync_from_conv
AFTER INSERT OR UPDATE OF department_id, assigned_agent_id, lead_score, last_message_at
ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.crm_sync_deal_from_conversation();

CREATE OR REPLACE FUNCTION public.crm_touch_deal_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE crm_deals SET last_interaction_at = now(), updated_at = now() WHERE conversation_id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crm_touch_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.crm_touch_deal_on_message();

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS chatbot_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS cnpj text;

DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Channel members can view internal audio" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'internal-audio' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.transfer_conversation(_conversation_id uuid, _department_id uuid, _agent_id uuid DEFAULT NULL::uuid, _status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_contact_to_agent() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_dept_agents_on_new_conversation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.crm_sync_deal_from_conversation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.crm_touch_deal_on_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_messages() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_crm_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_crm_access(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_channel_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_channel_admin(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_conversation(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_conversation(uuid, uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_conversation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_conversation(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid) TO authenticated;

ALTER TABLE public.prospect_leads
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS funnel_stage text,
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS equipment_type text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS source_origin text;
CREATE INDEX IF NOT EXISTS idx_prospect_leads_state ON public.prospect_leads(state);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_loss_reason ON public.prospect_leads(loss_reason);
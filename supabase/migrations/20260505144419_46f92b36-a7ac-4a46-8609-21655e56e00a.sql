
-- ============ CRM Module ============

-- Stages (kanban columns)
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
  ('Proposta Técnica', 4, '#f59e0b'),
  ('Negociação', 5, '#a855f7'),
  ('Fechamento', 6, '#10b981'),
  ('Pós-Vendas', 7, '#22c55e');

-- Deals (one per conversation in Comercial dept)
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid UNIQUE NOT NULL,
  contact_id uuid NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
  title text NOT NULL,
  company_name text,
  contact_name text,
  estimated_value numeric DEFAULT 0,
  priority int NOT NULL DEFAULT 1, -- 1-5 stars
  status text NOT NULL DEFAULT 'em_andamento', -- em_andamento, perdida, vendida
  temperature text, -- frio, morno, quente (mirrored from conversations.lead_score)
  assigned_agent_id uuid,
  notes text,
  next_contact_at timestamptz,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_deals_stage ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_conversation ON public.crm_deals(conversation_id);

-- Tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- Helper: is user in Comercial dept (or admin/manager)
CREATE OR REPLACE FUNCTION public.has_crm_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_user_id, 'admin'::app_role)
    OR has_role(_user_id, 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM agent_departments ad
      WHERE ad.agent_id = _user_id
        AND ad.department_id = '11111111-0001-4000-8000-000000000001'::uuid
    );
$$;

-- Stages: anyone with CRM access can read; admin/manager manage
CREATE POLICY "CRM users view stages" ON public.crm_stages FOR SELECT TO authenticated USING (has_crm_access(auth.uid()));
CREATE POLICY "Admins manage stages" ON public.crm_stages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Deals
CREATE POLICY "CRM users view deals" ON public.crm_deals FOR SELECT TO authenticated USING (has_crm_access(auth.uid()));
CREATE POLICY "CRM users update deals" ON public.crm_deals FOR UPDATE TO authenticated USING (has_crm_access(auth.uid())) WITH CHECK (has_crm_access(auth.uid()));
CREATE POLICY "CRM users insert deals" ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (has_crm_access(auth.uid()));
CREATE POLICY "Admins delete deals" ON public.crm_deals FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Tasks
CREATE POLICY "CRM users manage tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_crm_access(auth.uid())) WITH CHECK (has_crm_access(auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_crm_deals_updated
BEFORE UPDATE ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create deal when conversation enters Comercial dept
CREATE OR REPLACE FUNCTION public.crm_sync_deal_from_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO crm_deals (
    conversation_id, contact_id, stage_id, title, contact_name,
    assigned_agent_id, temperature, last_interaction_at
  )
  VALUES (
    NEW.id, NEW.contact_id, _first_stage,
    COALESCE(_contact_name, 'Negociação'),
    _contact_name, NEW.assigned_agent_id,
    NEW.lead_score, COALESCE(NEW.last_message_at, now())
  )
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
ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_deal_from_conversation();

-- Update last_interaction_at on new messages
CREATE OR REPLACE FUNCTION public.crm_touch_deal_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crm_deals
  SET last_interaction_at = now(), updated_at = now()
  WHERE conversation_id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_touch_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.crm_touch_deal_on_message();

-- Backfill existing Comercial conversations
INSERT INTO public.crm_deals (conversation_id, contact_id, stage_id, title, contact_name, assigned_agent_id, temperature, last_interaction_at)
SELECT
  c.id, c.contact_id,
  (SELECT id FROM crm_stages ORDER BY position LIMIT 1),
  COALESCE(ct.name, 'Negociação'),
  ct.name, c.assigned_agent_id, c.lead_score,
  COALESCE(c.last_message_at, c.created_at)
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
WHERE c.department_id = '11111111-0001-4000-8000-000000000001'
ON CONFLICT (conversation_id) DO NOTHING;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sentiment text DEFAULT null,
  ADD COLUMN IF NOT EXISTS sentiment_score numeric DEFAULT null,
  ADD COLUMN IF NOT EXISTS lead_score text DEFAULT null,
  ADD COLUMN IF NOT EXISTS ai_summary text DEFAULT null;

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL DEFAULT 'response',
  content text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view suggestions for their conversations" ON public.ai_suggestions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM conversations c WHERE c.id = ai_suggestions.conversation_id AND (
    c.assigned_agent_id = auth.uid() OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')
    OR (c.assigned_agent_id IS NULL AND c.department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()))
  )
));
CREATE POLICY "Service can insert suggestions" ON public.ai_suggestions FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM conversations c WHERE c.id = ai_suggestions.conversation_id AND (
    c.assigned_agent_id = auth.uid() OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')
    OR (c.assigned_agent_id IS NULL AND c.department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()))
  )
));
CREATE POLICY "Users can update suggestions" ON public.ai_suggestions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM conversations c WHERE c.id = ai_suggestions.conversation_id AND (
    c.assigned_agent_id = auth.uid() OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')
    OR (c.assigned_agent_id IS NULL AND c.department_id IN (SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()))
  )
));

CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  calendar_id text DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tokens" ON public.google_calendar_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own tokens" ON public.google_calendar_tokens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own tokens" ON public.google_calendar_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own tokens" ON public.google_calendar_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS google_event_id text DEFAULT null;

DROP POLICY IF EXISTS "Managers see all contacts" ON public.contacts;
CREATE POLICY "Admins see all contacts" ON public.contacts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers see dept contacts" ON public.contacts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND (
    assigned_agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversations c JOIN agent_departments ad ON ad.department_id = c.department_id
      WHERE c.contact_id = contacts.id AND ad.agent_id = auth.uid()
    )
  )
);

CREATE TYPE public.contact_category AS ENUM ('bronze', 'prata', 'ouro', 'diamante', 'vip');
ALTER TABLE public.contacts ADD COLUMN category public.contact_category NULL;

CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages WHERE created_at < now() - interval '2 years';
END;
$$;

CREATE POLICY "Public can view branding settings" ON public.system_settings FOR SELECT TO anon, authenticated USING (key LIKE 'branding_%');

CREATE TABLE public.prospect_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_agent_id UUID NULL,
  created_by UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NULL,
  phone TEXT NOT NULL,
  email TEXT NULL,
  segment TEXT NULL,
  estimated_value NUMERIC NULL,
  message_sent_at TIMESTAMPTZ NULL,
  interaction_status TEXT NOT NULL DEFAULT 'novo',
  next_step TEXT NULL,
  observations TEXT NULL,
  last_interaction_at TIMESTAMPTZ NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospect_leads_agent ON public.prospect_leads(assigned_agent_id);
CREATE INDEX idx_prospect_leads_status ON public.prospect_leads(interaction_status);
CREATE INDEX idx_prospect_leads_contact ON public.prospect_leads(contact_id);
ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view all prospect leads" ON public.prospect_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update all prospect leads" ON public.prospect_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete all prospect leads" ON public.prospect_leads FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert prospect leads" ON public.prospect_leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE TRIGGER trg_prospect_leads_updated BEFORE UPDATE ON public.prospect_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
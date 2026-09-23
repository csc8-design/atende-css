-- Tabela de leads de prospecção (módulo Prospecção/Disparador)
CREATE TABLE public.prospect_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_agent_id UUID NULL,
  created_by UUID NOT NULL,
  -- Dados do lead
  company_name TEXT NOT NULL,
  contact_name TEXT NULL,
  phone TEXT NOT NULL,
  email TEXT NULL,
  segment TEXT NULL,
  estimated_value NUMERIC NULL,
  -- Fluxo
  message_sent_at TIMESTAMPTZ NULL,
  interaction_status TEXT NOT NULL DEFAULT 'novo', -- novo | sim | pendente | nao
  next_step TEXT NULL,
  observations TEXT NULL,
  last_interaction_at TIMESTAMPTZ NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | crm | csv
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_leads_agent ON public.prospect_leads(assigned_agent_id);
CREATE INDEX idx_prospect_leads_status ON public.prospect_leads(interaction_status);
CREATE INDEX idx_prospect_leads_contact ON public.prospect_leads(contact_id);

ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

-- Agentes veem seus próprios leads
CREATE POLICY "Agents can view own prospect leads"
ON public.prospect_leads FOR SELECT
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Qualquer autenticado pode inserir (será sempre seu próprio created_by)
CREATE POLICY "Authenticated can insert prospect leads"
ON public.prospect_leads FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Agentes podem atualizar seus leads; admins/managers todos
CREATE POLICY "Agents can update own prospect leads"
ON public.prospect_leads FOR UPDATE
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Agentes podem deletar os próprios; admins/managers todos
CREATE POLICY "Agents can delete own prospect leads"
ON public.prospect_leads FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE TRIGGER trg_prospect_leads_updated
BEFORE UPDATE ON public.prospect_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
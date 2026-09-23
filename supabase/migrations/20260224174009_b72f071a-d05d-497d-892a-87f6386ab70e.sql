
-- Tabela de avaliações de atendimento (CSAT)
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

-- Enable RLS
ALTER TABLE public.satisfaction_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins/managers can view all ratings"
ON public.satisfaction_ratings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Agents can view own ratings"
ON public.satisfaction_ratings FOR SELECT
USING (agent_id = auth.uid());

CREATE POLICY "Admins/managers can manage ratings"
ON public.satisfaction_ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Service can insert ratings"
ON public.satisfaction_ratings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update ratings"
ON public.satisfaction_ratings FOR UPDATE
USING (true);

-- Index for performance
CREATE INDEX idx_satisfaction_ratings_conversation ON public.satisfaction_ratings(conversation_id);
CREATE INDEX idx_satisfaction_ratings_agent ON public.satisfaction_ratings(agent_id);
CREATE INDEX idx_satisfaction_ratings_rating ON public.satisfaction_ratings(rating);

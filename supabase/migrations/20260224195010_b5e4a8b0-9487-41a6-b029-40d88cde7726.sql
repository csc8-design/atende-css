
-- System settings key-value table
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
ON public.system_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins/managers can manage settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Seed defaults
INSERT INTO public.system_settings (key, value) VALUES
  ('instance_name', '"CBMaq"'),
  ('welcome_message', '"Olá! Bem vindo à minha empresa."'),
  ('closing_message', '"Olá! Bem vindo à minha empresa."'),
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


-- Chatbot configurations table
CREATE TABLE public.chatbot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  system_prompt text NOT NULL DEFAULT 'Você é um assistente virtual da CBMaq. Seja educado, objetivo e ajude o cliente com suas dúvidas.',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  welcome_message text DEFAULT 'Olá! Sou o assistente virtual da CBMaq. Como posso ajudá-lo?',
  is_active boolean NOT NULL DEFAULT true,
  max_tokens integer DEFAULT 1024,
  temperature numeric(3,2) DEFAULT 0.7,
  auto_transfer_to_agent boolean NOT NULL DEFAULT true,
  transfer_keywords text[] DEFAULT ARRAY['atendente', 'humano', 'pessoa', 'agente']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view chatbot configs"
  ON public.chatbot_configs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins/managers can manage chatbot configs"
  ON public.chatbot_configs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_chatbot_configs_updated_at
  BEFORE UPDATE ON public.chatbot_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chatbot conversation logs
CREATE TABLE public.chatbot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id uuid REFERENCES public.chatbot_configs(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  transferred_to_agent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view chatbot logs"
  ON public.chatbot_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage chatbot logs"
  ON public.chatbot_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_chatbot_logs_updated_at
  BEFORE UPDATE ON public.chatbot_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default chatbot
INSERT INTO public.chatbot_configs (name, description, system_prompt, welcome_message)
VALUES (
  'Assistente CBMaq',
  'Chatbot principal de atendimento ao cliente',
  'Você é o assistente virtual da CBMaq, empresa especializada em máquinas e equipamentos. Seu papel é:
1. Receber e entender a necessidade do cliente
2. Fornecer informações sobre produtos e serviços
3. Identificar o departamento correto para encaminhar o cliente
4. Ser educado, profissional e objetivo

Departamentos disponíveis: Vendas, Suporte/Pós-Vendas, Peças, Financeiro/CSC, Engenharia Técnica, Licitação, Marketing, RH.

Se o cliente pedir para falar com um atendente humano, informe que será transferido imediatamente.',
  'Olá! 👋 Bem-vindo à CBMaq! Sou o assistente virtual. Como posso ajudá-lo hoje?'
);

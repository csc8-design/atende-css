
-- Create closing_reasons table
CREATE TABLE public.closing_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.closing_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view closing reasons"
  ON public.closing_reasons FOR SELECT
  USING (true);

CREATE POLICY "Admins/managers can manage closing reasons"
  ON public.closing_reasons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Insert default reasons
INSERT INTO public.closing_reasons (name, description) VALUES
  ('Venda Concluída', 'Cliente finalizou a compra'),
  ('Sem Interesse', 'Lead não demonstrou interesse'),
  ('Problema Resolvido', 'Suporte resolveu a demanda'),
  ('Spam', 'Mensagem indesejada ou spam'),
  ('Duplicado', 'Conversa duplicada'),
  ('Transferido', 'Transferido para outro departamento'),
  ('Sem Resposta', 'Cliente não respondeu');

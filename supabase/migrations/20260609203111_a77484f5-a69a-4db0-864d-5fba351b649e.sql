
CREATE TABLE public.leads_popagro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  popagro_id TEXT NOT NULL UNIQUE,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  mensagem TEXT,
  cidade TEXT,
  uf TEXT,
  produto_id TEXT,
  produto_nome TEXT,
  produto_marca TEXT,
  produto_modelo TEXT,
  produto_valor NUMERIC,
  produto_ano TEXT,
  produto_foto TEXT,
  produto_url TEXT,
  status TEXT,
  tipo_negociacao TEXT,
  condicao TEXT,
  qualificado BOOLEAN,
  cnpj TEXT,
  empresa TEXT,
  data_lead TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ,
  dados_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_popagro TO authenticated;
GRANT ALL ON public.leads_popagro TO service_role;

ALTER TABLE public.leads_popagro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read leads_popagro"
  ON public.leads_popagro FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert leads_popagro"
  ON public.leads_popagro FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update leads_popagro"
  ON public.leads_popagro FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete leads_popagro"
  ON public.leads_popagro FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_leads_popagro_updated_at
  BEFORE UPDATE ON public.leads_popagro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_popagro_data_lead ON public.leads_popagro(data_lead DESC);
CREATE INDEX idx_leads_popagro_status ON public.leads_popagro(status);

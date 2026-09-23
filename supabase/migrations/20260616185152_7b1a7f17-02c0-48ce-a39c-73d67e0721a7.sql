
-- =========== mass_campaigns ===========
CREATE TABLE public.mass_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL,
  message_template text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft|sending|paused|completed|cancelled
  throttle_ms integer NOT NULL DEFAULT 1500,
  total_leads integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  replied_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mass_campaigns TO authenticated;
GRANT ALL ON public.mass_campaigns TO service_role;

ALTER TABLE public.mass_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read mass_campaigns" ON public.mass_campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mass_campaigns" ON public.mass_campaigns
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update mass_campaigns" ON public.mass_campaigns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete mass_campaigns" ON public.mass_campaigns
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_mass_campaigns_updated_at
  BEFORE UPDATE ON public.mass_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== mass_campaign_leads ===========
CREATE TABLE public.mass_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.mass_campaigns(id) ON DELETE CASCADE,
  nome text,
  empresa text,
  telefone text NOT NULL,
  telefone_normalizado text,
  modelo text,
  cidade text,
  uf text,
  fonte text,
  segmento text,
  score numeric,
  prioridade text,
  email text,
  extra jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|failed|replied|optout
  sent_at timestamptz,
  replied_at timestamptz,
  error_message text,
  evolution_message_id text,
  final_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mass_campaign_leads TO authenticated;
GRANT ALL ON public.mass_campaign_leads TO service_role;

ALTER TABLE public.mass_campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read mass_leads" ON public.mass_campaign_leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mass_leads" ON public.mass_campaign_leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update mass_leads" ON public.mass_campaign_leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete mass_leads" ON public.mass_campaign_leads
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_mass_leads_campaign ON public.mass_campaign_leads(campaign_id);
CREATE INDEX idx_mass_leads_status ON public.mass_campaign_leads(campaign_id, status);
CREATE INDEX idx_mass_leads_phone ON public.mass_campaign_leads(telefone_normalizado);

CREATE TRIGGER trg_mass_leads_updated_at
  BEFORE UPDATE ON public.mass_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

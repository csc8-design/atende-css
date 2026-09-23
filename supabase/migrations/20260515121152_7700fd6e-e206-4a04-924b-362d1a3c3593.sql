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
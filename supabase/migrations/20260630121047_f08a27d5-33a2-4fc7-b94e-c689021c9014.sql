
ALTER TABLE public.mass_campaign_leads ADD COLUMN IF NOT EXISTS first_sent_at timestamptz;

-- Backfill: assume current sent_at é o primeiro envio para leads já enviados
UPDATE public.mass_campaign_leads
SET first_sent_at = sent_at
WHERE first_sent_at IS NULL AND sent_at IS NOT NULL;

-- Trigger: na primeira vez que status virar sent/replied, grava first_sent_at
CREATE OR REPLACE FUNCTION public.set_mass_lead_first_sent_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_sent_at IS NULL
     AND NEW.sent_at IS NOT NULL
     AND NEW.status IN ('sent','replied') THEN
    NEW.first_sent_at := NEW.sent_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_mass_lead_first_sent_at ON public.mass_campaign_leads;
CREATE TRIGGER trg_set_mass_lead_first_sent_at
BEFORE INSERT OR UPDATE ON public.mass_campaign_leads
FOR EACH ROW EXECUTE FUNCTION public.set_mass_lead_first_sent_at();

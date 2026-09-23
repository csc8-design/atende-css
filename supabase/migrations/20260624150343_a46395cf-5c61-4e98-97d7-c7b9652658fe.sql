
-- Função para recalcular contadores da campanha
CREATE OR REPLACE FUNCTION public.recalc_mass_campaign_counters(_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mass_campaigns mc SET
    total_leads = sub.total,
    sent_count = sub.sent,
    failed_count = sub.failed,
    replied_count = sub.replied,
    updated_at = now()
  FROM (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('sent','replied')) AS sent,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE status = 'replied') AS replied
    FROM mass_campaign_leads
    WHERE campaign_id = _campaign_id
  ) sub
  WHERE mc.id = _campaign_id;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_recalc_mass_campaign_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalc_mass_campaign_counters(OLD.campaign_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_mass_campaign_counters(NEW.campaign_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS mass_campaign_leads_recalc ON public.mass_campaign_leads;
CREATE TRIGGER mass_campaign_leads_recalc
AFTER INSERT OR UPDATE OF status OR DELETE ON public.mass_campaign_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_mass_campaign_counters();

-- Realtime para campanhas e leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_campaign_leads;

-- Sincronismo único (corrige contadores existentes)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM mass_campaigns LOOP
    PERFORM public.recalc_mass_campaign_counters(r.id);
  END LOOP;
END $$;

ALTER TABLE public.mass_campaign_leads
  ADD COLUMN IF NOT EXISTS manual_handoff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_replied boolean NOT NULL DEFAULT false;
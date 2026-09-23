
ALTER TABLE public.mass_campaigns
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS meta_template_language text DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS meta_header_media_url text;

-- Backfill existing rows explicitly
UPDATE public.mass_campaigns SET channel = 'evolution' WHERE channel IS NULL;

CREATE INDEX IF NOT EXISTS idx_mass_campaigns_channel ON public.mass_campaigns(channel);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS interest_type text,
  ADD COLUMN IF NOT EXISTS desired_equipment text,
  ADD COLUMN IF NOT EXISTS is_reseller boolean,
  ADD COLUMN IF NOT EXISTS segment text;
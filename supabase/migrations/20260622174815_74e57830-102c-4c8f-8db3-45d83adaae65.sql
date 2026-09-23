ALTER TABLE public.qual_conversations ALTER COLUMN evolution_instance SET DEFAULT 'COMERCIAL_THEO';
ALTER TABLE public.mass_campaigns ALTER COLUMN evolution_instance SET DEFAULT 'COMERCIAL_THEO';
UPDATE public.qual_conversations SET evolution_instance = 'COMERCIAL_THEO' WHERE evolution_instance = 'THEO';
UPDATE public.mass_campaigns SET evolution_instance = 'COMERCIAL_THEO' WHERE evolution_instance = 'THEO';
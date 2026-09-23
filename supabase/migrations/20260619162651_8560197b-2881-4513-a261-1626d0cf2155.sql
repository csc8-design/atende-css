ALTER TABLE public.qual_conversations ALTER COLUMN evolution_instance SET DEFAULT 'APIATENDE';
ALTER TABLE public.mass_campaigns ALTER COLUMN evolution_instance SET DEFAULT 'APIATENDE';
UPDATE public.qual_conversations SET evolution_instance = 'APIATENDE' WHERE evolution_instance = 'ENVIO_NOT';
UPDATE public.mass_campaigns SET evolution_instance = 'APIATENDE' WHERE evolution_instance = 'ENVIO_NOT' AND status IN ('draft','scheduled');
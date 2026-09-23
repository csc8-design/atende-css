ALTER TABLE public.qual_conversations ALTER COLUMN evolution_instance SET DEFAULT 'ENVIO_NOT';
ALTER TABLE public.mass_campaigns ALTER COLUMN evolution_instance SET DEFAULT 'ENVIO_NOT';
UPDATE public.qual_conversations SET evolution_instance = 'ENVIO_NOT' WHERE evolution_instance = 'APIATENDE';
UPDATE public.mass_campaigns SET evolution_instance = 'ENVIO_NOT' WHERE evolution_instance = 'APIATENDE' AND status IN ('draft','scheduled');

CREATE TABLE IF NOT EXISTS public.prospecting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view prospecting templates"
  ON public.prospecting_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert prospecting templates"
  ON public.prospecting_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update prospecting templates"
  ON public.prospecting_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete prospecting templates"
  ON public.prospecting_templates FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_prospecting_templates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_prospecting_templates ON public.prospecting_templates;
CREATE TRIGGER trg_touch_prospecting_templates
  BEFORE UPDATE ON public.prospecting_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_prospecting_templates();

ALTER PUBLICATION supabase_realtime ADD TABLE public.prospecting_templates;

INSERT INTO public.prospecting_templates (name, content)
VALUES ('Padrão', 'Olá {contato}! Tudo bem? Sou da equipe e gostaria de conversar sobre como podemos ajudar a {empresa}.');

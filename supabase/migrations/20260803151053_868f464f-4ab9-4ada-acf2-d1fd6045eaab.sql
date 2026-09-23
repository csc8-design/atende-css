CREATE TABLE public.contact_interests (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  interest text,
  interest_type text,
  brands text[] NOT NULL DEFAULT '{}',
  models text[] NOT NULL DEFAULT '{}',
  last_analyzed_at timestamp with time zone,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_interests TO authenticated;
GRANT ALL ON public.contact_interests TO service_role;

ALTER TABLE public.contact_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contact interests"
ON public.contact_interests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert contact interests"
ON public.contact_interests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update contact interests"
ON public.contact_interests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete contact interests"
ON public.contact_interests FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_contact_interests_updated_at
BEFORE UPDATE ON public.contact_interests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.department_whatsapp_groups (
  department_id uuid PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
  group_jid text NOT NULL UNIQUE,
  group_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.department_whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read dept groups"
  ON public.department_whatsapp_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_touch_dept_wa_groups
  BEFORE UPDATE ON public.department_whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

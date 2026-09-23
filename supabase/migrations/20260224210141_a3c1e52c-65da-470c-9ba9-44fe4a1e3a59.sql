CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  schedule_type TEXT NOT NULL DEFAULT 'meeting',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view all schedules"
ON public.schedules FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Agents can view own schedules"
ON public.schedules FOR SELECT
USING (agent_id = auth.uid());

CREATE POLICY "Authenticated users can create schedules"
ON public.schedules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own schedules"
ON public.schedules FOR UPDATE
USING (
  agent_id = auth.uid() OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE POLICY "Users can delete own schedules"
ON public.schedules FOR DELETE
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE TRIGGER update_schedules_updated_at
BEFORE UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_schedules_agent_id ON public.schedules(agent_id);
CREATE INDEX idx_schedules_scheduled_at ON public.schedules(scheduled_at);
CREATE INDEX idx_schedules_status ON public.schedules(status);
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Anti-spam log
CREATE TABLE IF NOT EXISTS public.agent_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_notif_log_agent_time
  ON public.agent_notification_log(agent_id, notified_at DESC);

ALTER TABLE public.agent_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification log"
  ON public.agent_notification_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: calls edge function when conversation enters a department unassigned
CREATE OR REPLACE FUNCTION public.notify_dept_agents_on_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _should_notify boolean := false;
BEGIN
  -- INSERT case: new conversation with department, no agent
  IF (TG_OP = 'INSERT') THEN
    IF NEW.department_id IS NOT NULL AND NEW.assigned_agent_id IS NULL THEN
      _should_notify := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- UPDATE case: department was just set (or changed) and no agent assigned
    IF NEW.department_id IS NOT NULL
       AND NEW.assigned_agent_id IS NULL
       AND (OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
      _should_notify := true;
    END IF;
  END IF;

  IF NOT _should_notify THEN
    RETURN NEW;
  END IF;

  _supabase_url := 'https://rivfqexositrxqtwmmpi.supabase.co';
  _service_key := current_setting('app.settings.service_role_key', true);

  -- Fire-and-forget HTTP call to edge function
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/notify-agent-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'conversation_id', NEW.id,
      'department_id', NEW.department_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dept_agents_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_notify_dept_agents_update ON public.conversations;

CREATE TRIGGER trg_notify_dept_agents_insert
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dept_agents_on_new_conversation();

CREATE TRIGGER trg_notify_dept_agents_update
  AFTER UPDATE OF department_id, assigned_agent_id ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dept_agents_on_new_conversation();
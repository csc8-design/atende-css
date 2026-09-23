
CREATE OR REPLACE FUNCTION public.transfer_conversation(_conversation_id uuid, _department_id uuid, _agent_id uuid DEFAULT NULL::uuid, _status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _conv RECORD;
  _user_id uuid := auth.uid();
  _has_access boolean := false;
  _old_department_id uuid;
  _supabase_url text := 'https://rivfqexositrxqtwmmpi.supabase.co';
BEGIN
  SELECT * INTO _conv FROM conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  _old_department_id := _conv.department_id;

  IF has_role(_user_id, 'admin') THEN
    _has_access := true;
  ELSIF has_role(_user_id, 'manager') AND EXISTS (
    SELECT 1 FROM agent_departments
    WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  ELSIF _conv.assigned_agent_id = _user_id THEN
    _has_access := true;
  ELSIF EXISTS (
    SELECT 1 FROM agent_departments
    WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  END IF;

  IF NOT _has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE conversations
  SET
    department_id = _department_id,
    assigned_agent_id = _agent_id,
    status = COALESCE(_status::conversation_status, status),
    updated_at = now()
  WHERE id = _conversation_id;

  -- Fire notification when department changed (regardless of whether an agent was directly assigned)
  IF _department_id IS NOT NULL
     AND (_old_department_id IS DISTINCT FROM _department_id OR _agent_id IS NOT NULL) THEN
    BEGIN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/notify-agent-whatsapp',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'conversation_id', _conversation_id,
          'department_id', _department_id,
          'agent_id', _agent_id,
          'reason', 'transfer'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Don't break the transfer if notification fails
      NULL;
    END;
  END IF;
END;
$function$;

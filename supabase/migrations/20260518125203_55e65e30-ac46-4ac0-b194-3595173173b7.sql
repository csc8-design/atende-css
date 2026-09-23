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
BEGIN
  SELECT * INTO _conv FROM conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

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

  -- Notification handled by trg_notify_dept_agents_update trigger (avoids duplicates)
END;
$function$;
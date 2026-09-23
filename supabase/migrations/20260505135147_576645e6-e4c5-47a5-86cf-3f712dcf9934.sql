
CREATE OR REPLACE FUNCTION public.close_conversation(
  _conversation_id uuid,
  _closing_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SET status = 'resolved'::conversation_status,
      closed_at = now(),
      closing_reason = _closing_reason,
      assigned_agent_id = NULL,
      department_id = NULL,
      updated_at = now()
  WHERE id = _conversation_id;
END;
$$;

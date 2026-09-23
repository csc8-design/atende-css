
-- Create a SECURITY DEFINER function to handle conversation transfer
-- This bypasses RLS to allow any authenticated user to transfer conversations they can see
CREATE OR REPLACE FUNCTION public.transfer_conversation(
  _conversation_id uuid,
  _department_id uuid,
  _agent_id uuid DEFAULT NULL,
  _status text DEFAULT NULL
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
  -- Check the conversation exists
  SELECT * INTO _conv FROM conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  -- Check user has access: admin, manager in dept, assigned agent, or unassigned in agent's dept
  IF has_role(_user_id, 'admin') THEN
    _has_access := true;
  ELSIF has_role(_user_id, 'manager') AND EXISTS (
    SELECT 1 FROM agent_departments WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  ELSIF _conv.assigned_agent_id = _user_id THEN
    _has_access := true;
  ELSIF _conv.assigned_agent_id IS NULL AND EXISTS (
    SELECT 1 FROM agent_departments WHERE agent_id = _user_id AND department_id = _conv.department_id
  ) THEN
    _has_access := true;
  END IF;

  IF NOT _has_access THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Perform the transfer
  UPDATE conversations
  SET 
    department_id = _department_id,
    assigned_agent_id = _agent_id,
    status = COALESCE(_status::conversation_status, status),
    updated_at = now()
  WHERE id = _conversation_id;
END;
$$;

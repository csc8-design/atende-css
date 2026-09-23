
CREATE OR REPLACE FUNCTION public.auto_assign_contact_to_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When an agent is assigned to a conversation for the first time
  IF NEW.assigned_agent_id IS NOT NULL AND (OLD.assigned_agent_id IS NULL OR OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id) THEN
    -- Auto-assign the contact to this agent if contact has no assigned agent
    UPDATE contacts
    SET assigned_agent_id = NEW.assigned_agent_id,
        updated_at = now()
    WHERE id = NEW.contact_id
      AND assigned_agent_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_contact
AFTER UPDATE OF assigned_agent_id ON conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_contact_to_agent();

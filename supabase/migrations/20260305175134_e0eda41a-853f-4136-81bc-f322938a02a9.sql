
-- Drop the old policy that lets managers see ALL contacts
DROP POLICY IF EXISTS "Managers see all contacts" ON public.contacts;

-- Admins see all contacts
CREATE POLICY "Admins see all contacts"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Managers see contacts from conversations in their departments
CREATE POLICY "Managers see dept contacts"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND (
      assigned_agent_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM conversations c
        JOIN agent_departments ad ON ad.department_id = c.department_id
        WHERE c.contact_id = contacts.id
          AND ad.agent_id = auth.uid()
      )
    )
  );

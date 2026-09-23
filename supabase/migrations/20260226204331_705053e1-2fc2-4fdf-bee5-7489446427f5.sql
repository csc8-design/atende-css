
CREATE POLICY "Agents see contacts from unassigned dept conversations"
ON public.contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN agent_departments ad ON ad.department_id = c.department_id
    WHERE c.contact_id = contacts.id
      AND c.assigned_agent_id IS NULL
      AND ad.agent_id = auth.uid()
  )
);

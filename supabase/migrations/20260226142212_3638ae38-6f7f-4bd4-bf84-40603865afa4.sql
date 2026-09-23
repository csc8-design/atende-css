
-- Allow agents to view contacts linked to their assigned conversations
CREATE POLICY "Agents see contacts from assigned conversations"
ON public.contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.contact_id = contacts.id
    AND c.assigned_agent_id = auth.uid()
  )
);

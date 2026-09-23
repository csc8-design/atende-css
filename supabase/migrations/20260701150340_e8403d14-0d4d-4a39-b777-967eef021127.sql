-- Allow agents to claim unassigned contacts (add to their portfolio)
CREATE POLICY "Agents can claim unassigned contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (assigned_agent_id IS NULL)
WITH CHECK (assigned_agent_id = auth.uid());
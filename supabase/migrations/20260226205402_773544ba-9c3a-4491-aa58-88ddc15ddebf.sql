
-- Drop and recreate the agent update policy with a proper WITH CHECK
DROP POLICY "Agents can update assigned conversations" ON public.conversations;

CREATE POLICY "Agents can update assigned conversations"
ON public.conversations
FOR UPDATE
USING (
  (assigned_agent_id = auth.uid())
  OR (
    assigned_agent_id IS NULL
    AND department_id IN (
      SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
    )
  )
)
WITH CHECK (true);

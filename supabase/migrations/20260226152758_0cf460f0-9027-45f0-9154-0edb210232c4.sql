-- Allow agents to see unassigned conversations in their departments
DROP POLICY IF EXISTS "Agents see assigned conversations" ON public.conversations;
CREATE POLICY "Agents see assigned conversations"
ON public.conversations
FOR SELECT
USING (
  assigned_agent_id = auth.uid()
  OR (
    assigned_agent_id IS NULL
    AND department_id IN (
      SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
    )
  )
);

-- Allow agents to claim unassigned conversations in their department
DROP POLICY IF EXISTS "Agents can update assigned conversations" ON public.conversations;
CREATE POLICY "Agents can update assigned conversations"
ON public.conversations
FOR UPDATE
USING (
  assigned_agent_id = auth.uid()
  OR (
    assigned_agent_id IS NULL
    AND department_id IN (
      SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
    )
  )
);
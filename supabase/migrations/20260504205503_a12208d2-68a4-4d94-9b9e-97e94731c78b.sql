
DROP POLICY IF EXISTS "select_agent_assigned" ON public.conversations;
DROP POLICY IF EXISTS "update_agent" ON public.conversations;

CREATE POLICY "select_agent_dept"
ON public.conversations
FOR SELECT
USING (
  assigned_agent_id = auth.uid()
  OR department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  )
);

CREATE POLICY "update_agent_dept"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  )
)
WITH CHECK (true);

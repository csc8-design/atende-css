
-- Drop all existing UPDATE policies on conversations
DROP POLICY IF EXISTS "update_admin" ON public.conversations;
DROP POLICY IF EXISTS "update_agent" ON public.conversations;
DROP POLICY IF EXISTS "update_manager_dept" ON public.conversations;

-- Recreate as PERMISSIVE (default) so they are OR'd together
CREATE POLICY "update_admin" ON public.conversations
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (true);

CREATE POLICY "update_agent" ON public.conversations
FOR UPDATE TO authenticated
USING (
  (assigned_agent_id = auth.uid())
  OR (
    assigned_agent_id IS NULL
    AND department_id IN (SELECT department_id FROM agent_departments WHERE agent_id = auth.uid())
  )
)
WITH CHECK (true);

CREATE POLICY "update_manager_dept" ON public.conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND department_id IN (SELECT department_id FROM agent_departments WHERE agent_id = auth.uid())
)
WITH CHECK (true);

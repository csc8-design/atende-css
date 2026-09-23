
-- Replace ALL policies with specific command policies to fix RLS conflicts

-- Drop ALL existing policies on conversations
DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Managers can manage department conversations" ON public.conversations;
DROP POLICY IF EXISTS "Agents can update assigned conversations" ON public.conversations;
DROP POLICY IF EXISTS "Agents see assigned conversations" ON public.conversations;
DROP POLICY IF EXISTS "Managers see department conversations" ON public.conversations;

-- SELECT policies
CREATE POLICY "select_admin"
ON public.conversations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "select_manager_dept"
ON public.conversations FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) AND department_id IN (
  SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
));

CREATE POLICY "select_agent_assigned"
ON public.conversations FOR SELECT
USING (
  assigned_agent_id = auth.uid()
  OR (assigned_agent_id IS NULL AND department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  ))
);

-- UPDATE policies (separate from ALL to avoid WITH CHECK conflicts)
CREATE POLICY "update_admin"
ON public.conversations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (true);

CREATE POLICY "update_manager_dept"
ON public.conversations FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) AND department_id IN (
  SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
))
WITH CHECK (true);

CREATE POLICY "update_agent"
ON public.conversations FOR UPDATE
USING (
  assigned_agent_id = auth.uid()
  OR (assigned_agent_id IS NULL AND department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  ))
)
WITH CHECK (true);

-- INSERT policies
CREATE POLICY "insert_admin"
ON public.conversations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "insert_manager"
ON public.conversations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "insert_authenticated"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE policies (admin only)
CREATE POLICY "delete_admin"
ON public.conversations FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

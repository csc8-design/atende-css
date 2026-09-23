
-- Drop and recreate ALL policies with explicit WITH CHECK (true) to fix transfer issues
DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
CREATE POLICY "Admins can manage all conversations" 
ON public.conversations FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can manage department conversations" ON public.conversations;
CREATE POLICY "Managers can manage department conversations" 
ON public.conversations FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) AND department_id IN (
  SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
))
WITH CHECK (true);

-- Recreate agent update policy to be broader - allow any authenticated user who can see the conversation to update it
DROP POLICY IF EXISTS "Agents can update assigned conversations" ON public.conversations;
CREATE POLICY "Agents can update assigned conversations" 
ON public.conversations FOR UPDATE 
USING (
  (assigned_agent_id = auth.uid()) 
  OR (assigned_agent_id IS NULL AND department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  ))
)
WITH CHECK (true);

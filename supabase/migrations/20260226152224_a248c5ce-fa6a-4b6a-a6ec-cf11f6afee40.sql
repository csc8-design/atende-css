-- Fix: Managers should only see conversations from their departments (not NULL department ones)
DROP POLICY IF EXISTS "Managers see department conversations" ON public.conversations;
CREATE POLICY "Managers see department conversations"
ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND department_id IN (
      SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Managers can manage department conversations" ON public.conversations;
CREATE POLICY "Managers can manage department conversations"
ON public.conversations
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND department_id IN (
    SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
  )
);
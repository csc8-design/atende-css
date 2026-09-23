
-- Drop all existing RESTRICTIVE policies on ai_suggestions
DROP POLICY IF EXISTS "Users can view suggestions for their conversations" ON public.ai_suggestions;
DROP POLICY IF EXISTS "Service can insert suggestions" ON public.ai_suggestions;
DROP POLICY IF EXISTS "Users can update suggestions" ON public.ai_suggestions;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view suggestions for their conversations"
ON public.ai_suggestions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (
      c.assigned_agent_id = auth.uid()
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin')
      OR (c.assigned_agent_id IS NULL AND c.department_id IN (
        SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "Service can insert suggestions"
ON public.ai_suggestions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (
      c.assigned_agent_id = auth.uid()
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin')
      OR (c.assigned_agent_id IS NULL AND c.department_id IN (
        SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "Users can update suggestions"
ON public.ai_suggestions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (
      c.assigned_agent_id = auth.uid()
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin')
      OR (c.assigned_agent_id IS NULL AND c.department_id IN (
        SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
      ))
    )
  )
);


-- Fix the overly permissive insert policy
DROP POLICY IF EXISTS "Service can insert suggestions" ON public.ai_suggestions;
CREATE POLICY "Service can insert suggestions"
  ON public.ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (c.assigned_agent_id = auth.uid() 
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin'))
  ));

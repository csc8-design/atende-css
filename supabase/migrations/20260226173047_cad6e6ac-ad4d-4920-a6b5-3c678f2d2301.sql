
-- Fix messages SELECT policy to allow agents to see messages from unassigned conversations in their departments
DROP POLICY IF EXISTS "Users can view messages of visible conversations" ON public.messages;

CREATE POLICY "Users can view messages of visible conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.assigned_agent_id = auth.uid()
        OR has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR (
          c.assigned_agent_id IS NULL
          AND c.department_id IN (
            SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
          )
        )
      )
    )
  );


-- Fix overly permissive conversation_tags policy
DROP POLICY "Authenticated can manage" ON public.conversation_tags;

CREATE POLICY "Agents can manage tags on their conversations" ON public.conversation_tags
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
);

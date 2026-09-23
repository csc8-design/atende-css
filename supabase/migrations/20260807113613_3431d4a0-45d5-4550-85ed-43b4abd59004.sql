CREATE POLICY "select_closed_history" ON public.conversations
FOR SELECT TO authenticated
USING (status IN ('resolved'::conversation_status, 'closed'::conversation_status));

CREATE POLICY "select_messages_closed_history" ON public.messages
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = messages.conversation_id
    AND c.status IN ('resolved'::conversation_status, 'closed'::conversation_status)
));
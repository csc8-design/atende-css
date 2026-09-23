
-- Allow agents to update their own messages
CREATE POLICY "Agents can update own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid() AND sender_type = 'agent')
WITH CHECK (sender_id = auth.uid() AND sender_type = 'agent');

-- Allow agents to delete their own messages
CREATE POLICY "Agents can delete own messages"
ON public.messages
FOR DELETE
USING (sender_id = auth.uid() AND sender_type = 'agent');

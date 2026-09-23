-- Allow admins to delete messages from any conversation
CREATE POLICY "Admins can delete any messages"
ON public.messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete conversation notes
CREATE POLICY "Admins can delete notes"
ON public.conversation_notes
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete conversation tags
CREATE POLICY "Admins can delete any conversation tags"
ON public.conversation_tags
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
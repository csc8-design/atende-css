-- Allow all authenticated agents to see resolved/closed conversations
CREATE POLICY "All agents can see resolved conversations"
ON public.conversations
FOR SELECT
USING (status IN ('resolved', 'closed'));
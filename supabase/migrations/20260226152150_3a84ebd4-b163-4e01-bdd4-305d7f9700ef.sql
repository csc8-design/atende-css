-- Remove the overly permissive policy
DROP POLICY IF EXISTS "All agents can see resolved conversations" ON public.conversations;
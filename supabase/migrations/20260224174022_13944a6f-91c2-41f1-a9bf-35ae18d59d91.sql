
-- Fix overly permissive policies - restrict to service role context (edge functions)
DROP POLICY "Service can insert ratings" ON public.satisfaction_ratings;
DROP POLICY "Service can update ratings" ON public.satisfaction_ratings;

-- Only admins/managers can insert/update (edge functions use service role which bypasses RLS)
-- No additional permissive policies needed since edge functions with service_role bypass RLS

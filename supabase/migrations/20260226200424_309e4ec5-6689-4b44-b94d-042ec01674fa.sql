-- Drop the overly permissive policy and replace with a proper one
DROP POLICY "Agents can insert contacts" ON public.contacts;

-- Allow all authenticated users (agents included) to insert contacts
CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

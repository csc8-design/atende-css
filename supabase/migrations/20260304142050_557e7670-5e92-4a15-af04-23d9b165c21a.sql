CREATE POLICY "Agents can view all active contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (is_active = true);
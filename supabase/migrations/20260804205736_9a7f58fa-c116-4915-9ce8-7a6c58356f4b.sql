CREATE POLICY "Authenticated can update contact info"
ON public.contacts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
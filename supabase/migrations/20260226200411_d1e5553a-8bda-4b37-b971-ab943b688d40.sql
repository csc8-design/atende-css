-- Allow agents to insert contacts
CREATE POLICY "Agents can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

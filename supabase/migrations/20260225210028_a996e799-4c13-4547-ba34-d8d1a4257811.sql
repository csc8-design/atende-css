-- Allow admins/managers to delete contacts
CREATE POLICY "Admins/managers can delete contacts"
ON public.contacts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins/managers to insert contacts
CREATE POLICY "Admins/managers can insert contacts"
ON public.contacts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
-- Allow public (unauthenticated) read access to branding settings
CREATE POLICY "Public can view branding settings"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (key LIKE 'branding_%');
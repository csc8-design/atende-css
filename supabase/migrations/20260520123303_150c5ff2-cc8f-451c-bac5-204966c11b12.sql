-- Restore authenticated SELECT on whatsapp-media so TUS resumable uploads work
CREATE POLICY "Authenticated can read whatsapp media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated to UPDATE for TUS upsert behavior
CREATE POLICY "Authenticated can update whatsapp media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');
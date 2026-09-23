
-- Increase file size limit on whatsapp-media bucket to 104857600 (100MB)
UPDATE storage.buckets 
SET file_size_limit = 104857600 
WHERE id = 'whatsapp-media';

-- Allow authenticated users to upload to whatsapp-media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload to whatsapp-media'
  ) THEN
    CREATE POLICY "Authenticated users can upload to whatsapp-media"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'whatsapp-media');
  END IF;
END $$;

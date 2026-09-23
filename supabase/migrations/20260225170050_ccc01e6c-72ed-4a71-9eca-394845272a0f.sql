
-- Create storage bucket for internal chat audio
INSERT INTO storage.buckets (id, name, public) VALUES ('internal-audio', 'internal-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for internal audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'internal-audio' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view internal audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'internal-audio');

-- Add message_type and media_url to internal_messages
ALTER TABLE public.internal_messages
ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url text;

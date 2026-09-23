
-- 1. Contacts: tighten insert policy
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Agents can insert contacts assigned to themselves" ON public.contacts;
CREATE POLICY "Agents can insert contacts assigned to themselves"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR assigned_agent_id = auth.uid()
);

-- 2. Google Calendar tokens: revoke column-level read of secret tokens
REVOKE SELECT (access_token, refresh_token) ON public.google_calendar_tokens FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.google_calendar_tokens FROM anon;

-- 3. Internal audio bucket: restrict to channel members
DROP POLICY IF EXISTS "Channel members can view internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can read internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can upload internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can update internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can delete internal audio" ON storage.objects;

CREATE POLICY "Channel members can read internal audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'internal-audio'
  AND public.is_channel_member(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Channel members can upload internal audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'internal-audio'
  AND public.is_channel_member(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Channel members can update internal audio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'internal-audio'
  AND public.is_channel_member(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Channel members can delete internal audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'internal-audio'
  AND public.is_channel_member(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

-- 4. whatsapp-media public bucket: remove broad listing policy
DROP POLICY IF EXISTS "Authenticated can read whatsapp media" ON storage.objects;

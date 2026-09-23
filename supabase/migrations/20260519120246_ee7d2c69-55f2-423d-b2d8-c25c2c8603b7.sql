
-- 1. Conversations: replace overly broad insert_authenticated with scoped agent policy
DROP POLICY IF EXISTS "insert_authenticated" ON public.conversations;

CREATE POLICY "insert_agent_dept" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_agent_id = auth.uid()
    OR department_id IN (
      SELECT ad.department_id FROM public.agent_departments ad WHERE ad.agent_id = auth.uid()
    )
  );

-- 2. Google Calendar tokens: hide sensitive token columns from authenticated role
REVOKE SELECT (access_token, refresh_token) ON public.google_calendar_tokens FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.google_calendar_tokens FROM anon;

-- 3. Storage: prevent listing of public buckets (direct file URLs still work)
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for whatsapp media" ON storage.objects;

-- 4. Fix mutable search_path on function
ALTER FUNCTION public.touch_prospecting_templates() SET search_path = public;

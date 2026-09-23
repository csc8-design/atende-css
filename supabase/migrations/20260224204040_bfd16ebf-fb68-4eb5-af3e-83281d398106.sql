
-- Create a security definer function to check channel membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  )
$$;

-- Create a security definer function to check channel admin
CREATE OR REPLACE FUNCTION public.is_channel_admin(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id AND role = 'admin'
  )
$$;

-- ============ Fix channel_members policies ============
DROP POLICY IF EXISTS "Members can view channel members" ON public.channel_members;
CREATE POLICY "Members can view channel members" ON public.channel_members
  FOR SELECT TO authenticated
  USING (
    is_channel_member(channel_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Channel admins can manage members" ON public.channel_members;
CREATE POLICY "Channel admins can manage members" ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_channel_admin(channel_id, auth.uid())
    OR auth.uid() = (SELECT created_by FROM internal_channels WHERE id = channel_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Channel admins can remove members" ON public.channel_members;
CREATE POLICY "Channel admins can remove members" ON public.channel_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_channel_admin(channel_id, auth.uid())
  );

-- ============ Fix internal_channels policies ============
DROP POLICY IF EXISTS "Members can view their channels" ON public.internal_channels;
CREATE POLICY "Members can view their channels" ON public.internal_channels
  FOR SELECT TO authenticated
  USING (
    is_channel_member(id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Channel admins can update" ON public.internal_channels;
CREATE POLICY "Channel admins can update" ON public.internal_channels
  FOR UPDATE TO authenticated
  USING (
    is_channel_admin(id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ Fix internal_messages policies ============
DROP POLICY IF EXISTS "Members can view channel messages" ON public.internal_messages;
CREATE POLICY "Members can view channel messages" ON public.internal_messages
  FOR SELECT TO authenticated
  USING (is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Members can send messages" ON public.internal_messages;
CREATE POLICY "Members can send messages" ON public.internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_channel_member(channel_id, auth.uid())
  );

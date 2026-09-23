
-- Fix channel_members INSERT policy: the condition had cm.channel_id = cm.channel_id (self-ref)
DROP POLICY IF EXISTS "Channel admins can manage members" ON public.channel_members;
CREATE POLICY "Channel admins can manage members"
  ON public.channel_members
  FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    ))
    OR (auth.uid() = (
      SELECT created_by FROM internal_channels WHERE id = channel_members.channel_id
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix channel_members SELECT policy: same self-ref bug
DROP POLICY IF EXISTS "Members can view channel members" ON public.channel_members;
CREATE POLICY "Members can view channel members"
  ON public.channel_members
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix channel_members DELETE policy for admins: same self-ref bug
DROP POLICY IF EXISTS "Channel admins can remove members" ON public.channel_members;
CREATE POLICY "Channel admins can remove members"
  ON public.channel_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Fix internal_channels SELECT policy: had channel_members.channel_id = channel_members.id (wrong)
DROP POLICY IF EXISTS "Members can view their channels" ON public.internal_channels;
CREATE POLICY "Members can view their channels"
  ON public.internal_channels
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_channels.id
        AND channel_members.user_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix internal_channels UPDATE policy: same bug
DROP POLICY IF EXISTS "Channel admins can update" ON public.internal_channels;
CREATE POLICY "Channel admins can update"
  ON public.internal_channels
  FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_channels.id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role = 'admin'
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

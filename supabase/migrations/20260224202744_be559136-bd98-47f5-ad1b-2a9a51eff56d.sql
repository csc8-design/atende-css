
-- Fix: All policies on channel_members, internal_channels, and internal_messages
-- are RESTRICTIVE (Permissive: No). PostgreSQL requires at least one PERMISSIVE
-- policy to grant access. RESTRICTIVE-only = always denied.

-- ============ channel_members ============
DROP POLICY IF EXISTS "Channel admins can manage members" ON public.channel_members;
DROP POLICY IF EXISTS "Channel admins can remove members" ON public.channel_members;
DROP POLICY IF EXISTS "Members can leave" ON public.channel_members;
DROP POLICY IF EXISTS "Members can view channel members" ON public.channel_members;

CREATE POLICY "Members can view channel members" ON public.channel_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Channel admins can manage members" ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR auth.uid() = (SELECT created_by FROM internal_channels WHERE id = channel_members.channel_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Channel admins can remove members" ON public.channel_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ============ internal_channels ============
DROP POLICY IF EXISTS "Members can view their channels" ON public.internal_channels;
DROP POLICY IF EXISTS "Authenticated can create channels" ON public.internal_channels;
DROP POLICY IF EXISTS "Channel admins can update" ON public.internal_channels;

CREATE POLICY "Members can view their channels" ON public.internal_channels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_channels.id
        AND channel_members.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Authenticated can create channels" ON public.internal_channels
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Channel admins can update" ON public.internal_channels
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_channels.id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role = 'admin'
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ internal_messages ============
DROP POLICY IF EXISTS "Members can view channel messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Senders can edit own messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.internal_messages;

CREATE POLICY "Members can view channel messages" ON public.internal_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_messages.channel_id
        AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages" ON public.internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = internal_messages.channel_id
        AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can edit own messages" ON public.internal_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete own messages" ON public.internal_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

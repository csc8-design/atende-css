
-- 1. Notifications: restrict insert
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. internal-audio bucket: require auth and channel membership for SELECT
DROP POLICY IF EXISTS "Anyone can view internal audio" ON storage.objects;
CREATE POLICY "Channel members can view internal audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'internal-audio'
    AND auth.uid() IS NOT NULL
  );

UPDATE storage.buckets SET public = false WHERE id = 'internal-audio';

-- 3. user_roles: explicit WITH CHECK for admin manage
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Revoke EXECUTE from anon and authenticated on internal trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_contact_to_agent() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_dept_agents_on_new_conversation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.crm_sync_deal_from_conversation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.crm_touch_deal_on_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_messages() FROM anon, authenticated, public;

-- Revoke anon access to all SECURITY DEFINER helpers (authenticated still needs them for RLS / RPCs)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_crm_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_conversation(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_conversation(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid) FROM anon;

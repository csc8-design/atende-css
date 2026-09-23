
-- Revoke from PUBLIC (which includes anon) for all SECURITY DEFINER functions, then re-grant only to authenticated where needed.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_crm_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_crm_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_channel_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_channel_admin(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transfer_conversation(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_conversation(uuid, uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.close_conversation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_conversation(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_channel(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_channel_id UUID;
BEGIN
  SELECT ic.id INTO v_channel_id
  FROM internal_channels ic
  WHERE ic.channel_type = 'direct'
    AND EXISTS (SELECT 1 FROM channel_members cm1 WHERE cm1.channel_id = ic.id AND cm1.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM channel_members cm2 WHERE cm2.channel_id = ic.id AND cm2.user_id = other_user_id)
    AND (SELECT COUNT(*) FROM channel_members cm3 WHERE cm3.channel_id = ic.id) = 2
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO internal_channels (channel_type, created_by)
    VALUES ('direct', auth.uid())
    RETURNING id INTO v_channel_id;

    INSERT INTO channel_members (channel_id, user_id, role)
    VALUES (v_channel_id, auth.uid(), 'admin'), (v_channel_id, other_user_id, 'admin');
  END IF;

  RETURN v_channel_id;
END;
$function$;

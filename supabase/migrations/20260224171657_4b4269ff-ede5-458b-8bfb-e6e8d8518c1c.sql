
-- Internal chat channels (groups, departments, direct)
CREATE TYPE public.channel_type AS ENUM ('group', 'direct', 'department');

CREATE TABLE public.internal_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  description TEXT,
  channel_type channel_type NOT NULL DEFAULT 'group',
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_channels ENABLE ROW LEVEL SECURITY;

-- Channel members
CREATE TABLE public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.internal_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- Internal messages
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.internal_channels(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.internal_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see channels they're members of
CREATE POLICY "Members can view their channels" ON public.internal_channels
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = id AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Authenticated can create channels" ON public.internal_channels
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Channel admins can update" ON public.internal_channels
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = id AND user_id = auth.uid() AND role = 'admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Channel members RLS
CREATE POLICY "Members can view channel members" ON public.channel_members
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = channel_id AND cm.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Channel admins can manage members" ON public.channel_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = channel_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  OR auth.uid() = (SELECT created_by FROM public.internal_channels WHERE id = channel_id)
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Members can leave" ON public.channel_members
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Channel admins can remove members" ON public.channel_members
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = channel_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
);

-- Internal messages RLS
CREATE POLICY "Members can view channel messages" ON public.internal_messages
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = internal_messages.channel_id AND user_id = auth.uid())
);

CREATE POLICY "Members can send messages" ON public.internal_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = internal_messages.channel_id AND user_id = auth.uid())
);

CREATE POLICY "Senders can edit own messages" ON public.internal_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete own messages" ON public.internal_messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- Triggers
CREATE TRIGGER update_internal_channels_updated_at BEFORE UPDATE ON public.internal_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_internal_messages_updated_at BEFORE UPDATE ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

-- Indexes
CREATE INDEX idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX idx_channel_members_channel ON public.channel_members(channel_id);
CREATE INDEX idx_internal_messages_channel ON public.internal_messages(channel_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at);

-- Function to get or create a direct message channel between two users
CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id UUID;
BEGIN
  -- Find existing DM channel between these two users
  SELECT ic.id INTO channel_id
  FROM internal_channels ic
  WHERE ic.channel_type = 'direct'
    AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = ic.id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = ic.id AND user_id = other_user_id)
    AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = ic.id) = 2
  LIMIT 1;

  -- Create new DM channel if not found
  IF channel_id IS NULL THEN
    INSERT INTO internal_channels (channel_type, created_by)
    VALUES ('direct', auth.uid())
    RETURNING id INTO channel_id;

    INSERT INTO channel_members (channel_id, user_id, role)
    VALUES (channel_id, auth.uid(), 'admin'), (channel_id, other_user_id, 'admin');
  END IF;

  RETURN channel_id;
END;
$$;


-- Add pin and favorite columns to channel_members
ALTER TABLE public.channel_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Allow members to update their own membership (for pin/favorite)
CREATE POLICY "Members can update own membership" ON public.channel_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

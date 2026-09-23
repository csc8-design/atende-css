
-- 1. Update conversations SELECT policy for managers to only see their departments
-- Drop the old manager policy
DROP POLICY IF EXISTS "Managers see all conversations" ON public.conversations;

-- Create new policy: managers see conversations from their departments
CREATE POLICY "Managers see department conversations"
ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND (
      department_id IN (
        SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
      )
      OR department_id IS NULL
    )
  )
);

-- Also update the ALL policy for managers to scope to their departments
DROP POLICY IF EXISTS "Admins/managers can manage conversations" ON public.conversations;

CREATE POLICY "Admins can manage all conversations"
ON public.conversations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage department conversations"
ON public.conversations
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND (
    department_id IN (
      SELECT ad.department_id FROM agent_departments ad WHERE ad.agent_id = auth.uid()
    )
    OR department_id IS NULL
  )
);

-- 2. Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'inactivity_alert',
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);

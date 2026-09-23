CREATE TABLE public.conversation_reply_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  level text NOT NULL,
  last_message_at timestamptz NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, level, last_message_at)
);

GRANT SELECT ON public.conversation_reply_alerts TO authenticated;
GRANT ALL ON public.conversation_reply_alerts TO service_role;

ALTER TABLE public.conversation_reply_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reply alerts"
ON public.conversation_reply_alerts FOR SELECT TO authenticated USING (true);
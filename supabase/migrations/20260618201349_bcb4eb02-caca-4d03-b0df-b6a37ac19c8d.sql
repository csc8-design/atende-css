ALTER TABLE public.qual_conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_qual_conv_archived ON public.qual_conversations(archived);
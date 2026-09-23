
-- Add AI analysis fields to conversations
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS sentiment text DEFAULT null,
  ADD COLUMN IF NOT EXISTS sentiment_score numeric DEFAULT null,
  ADD COLUMN IF NOT EXISTS lead_score text DEFAULT null,
  ADD COLUMN IF NOT EXISTS ai_summary text DEFAULT null;

-- Create table for AI suggestions shown to agents
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL DEFAULT 'response',
  content text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Agents can view suggestions for conversations they can see
CREATE POLICY "Users can view suggestions for their conversations"
  ON public.ai_suggestions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (c.assigned_agent_id = auth.uid() 
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin'))
  ));

-- Service/system can insert suggestions
CREATE POLICY "Service can insert suggestions"
  ON public.ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (true);

-- Agents can update (mark as used)
CREATE POLICY "Users can update suggestions"
  ON public.ai_suggestions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
    AND (c.assigned_agent_id = auth.uid() 
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'admin'))
  ));

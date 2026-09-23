
-- ============ QUAL CONVERSATIONS ============
CREATE TABLE public.qual_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  contact_name text,
  contact_avatar_url text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open | finished
  assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finished_at timestamptz,
  finished_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handoff_summary text,
  evolution_instance text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phone)
);
CREATE INDEX idx_qual_conv_last_msg ON public.qual_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_qual_conv_status ON public.qual_conversations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qual_conversations TO authenticated;
GRANT ALL ON public.qual_conversations TO service_role;
ALTER TABLE public.qual_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_conv_all_auth_select" ON public.qual_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_conv_all_auth_insert" ON public.qual_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_conv_all_auth_update" ON public.qual_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_conv_all_auth_delete" ON public.qual_conversations FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_qual_conv_updated_at
  BEFORE UPDATE ON public.qual_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QUAL MESSAGES ============
CREATE TABLE public.qual_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.qual_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL, -- inbound | outbound
  content text,
  media_url text,
  media_type text, -- image | audio | video | document
  evolution_message_id text,
  sender_name text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_msg_conv ON public.qual_messages(conversation_id, sent_at);
CREATE UNIQUE INDEX idx_qual_msg_evo ON public.qual_messages(evolution_message_id) WHERE evolution_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qual_messages TO authenticated;
GRANT ALL ON public.qual_messages TO service_role;
ALTER TABLE public.qual_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_msg_all_auth_select" ON public.qual_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_msg_all_auth_insert" ON public.qual_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_msg_all_auth_update" ON public.qual_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_msg_all_auth_delete" ON public.qual_messages FOR DELETE TO authenticated USING (true);

-- ============ QUAL LEAD QUALIFICATION ============
CREATE TABLE public.qual_lead_qualification (
  conversation_id uuid PRIMARY KEY REFERENCES public.qual_conversations(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{
    "necessidade":      {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "decisor":          {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "prazo":            {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "capacidade":       {"status":"pending","confidence":0,"evidence":null,"summary":null}
  }'::jsonb,
  ai_summary text,
  lead_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- nome, empresa, cnpj, cidade, uf etc extraídos
  last_analyzed_at timestamptz,
  last_message_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qual_lead_qualification TO authenticated;
GRANT ALL ON public.qual_lead_qualification TO service_role;
ALTER TABLE public.qual_lead_qualification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_qlead_all_auth_select" ON public.qual_lead_qualification FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_qlead_all_auth_insert" ON public.qual_lead_qualification FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_qlead_all_auth_update" ON public.qual_lead_qualification FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_qlead_all_auth_delete" ON public.qual_lead_qualification FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_qual_qlead_updated_at
  BEFORE UPDATE ON public.qual_lead_qualification
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_lead_qualification;

ALTER TABLE public.qual_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.qual_messages REPLICA IDENTITY FULL;
ALTER TABLE public.qual_lead_qualification REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.prospecting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prospecting_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view prospecting templates" ON public.prospecting_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert prospecting templates" ON public.prospecting_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update prospecting templates" ON public.prospecting_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete prospecting templates" ON public.prospecting_templates FOR DELETE TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.touch_prospecting_templates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_touch_prospecting_templates BEFORE UPDATE ON public.prospecting_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_prospecting_templates();
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospecting_templates;
INSERT INTO public.prospecting_templates (name, content)
VALUES ('Padrão', 'Olá {contato}! Tudo bem? Sou da ENGWE Brasil e gostaria de conversar sobre a revenda das nossas bikes elétricas na {empresa}.');

CREATE TABLE IF NOT EXISTS public.department_whatsapp_groups (
  department_id uuid PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
  group_jid text NOT NULL UNIQUE,
  group_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read dept groups" ON public.department_whatsapp_groups FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_touch_dept_wa_groups BEFORE UPDATE ON public.department_whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "insert_authenticated" ON public.conversations;
CREATE POLICY "insert_agent_dept" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (assigned_agent_id = auth.uid() OR department_id IN (SELECT ad.department_id FROM public.agent_departments ad WHERE ad.agent_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Agents can insert contacts assigned to themselves" ON public.contacts;
CREATE POLICY "Agents can insert contacts assigned to themselves" ON public.contacts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR assigned_agent_id = auth.uid());

DROP POLICY IF EXISTS "Channel members can view internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can read internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can upload internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can update internal audio" ON storage.objects;
DROP POLICY IF EXISTS "Channel members can delete internal audio" ON storage.objects;
CREATE POLICY "Channel members can read internal audio" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'internal-audio' AND public.is_channel_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid()));
CREATE POLICY "Channel members can upload internal audio" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internal-audio' AND public.is_channel_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid()));
CREATE POLICY "Channel members can update internal audio" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'internal-audio' AND public.is_channel_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid()));
CREATE POLICY "Channel members can delete internal audio" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'internal-audio' AND public.is_channel_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete whatsapp media" ON storage.objects;
CREATE POLICY "Authenticated can read whatsapp media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'whatsapp-media');
CREATE POLICY "Authenticated can update whatsapp media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'whatsapp-media') WITH CHECK (bucket_id = 'whatsapp-media');
CREATE POLICY "Authenticated can delete whatsapp media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'whatsapp-media');

CREATE TABLE public.qual_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  contact_name text,
  contact_avatar_url text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_agent_id uuid,
  finished_at timestamptz,
  finished_by uuid,
  handoff_summary text,
  evolution_instance text DEFAULT 'COMERCIAL_THEO',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_conv_last_msg ON public.qual_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_qual_conv_status ON public.qual_conversations(status);
CREATE INDEX idx_qual_conv_archived ON public.qual_conversations(archived);
ALTER TABLE public.qual_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_conv_all_auth_select" ON public.qual_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_conv_all_auth_insert" ON public.qual_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_conv_all_auth_update" ON public.qual_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_conv_all_auth_delete" ON public.qual_conversations FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_qual_conv_updated_at BEFORE UPDATE ON public.qual_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.qual_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.qual_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  content text,
  media_url text,
  media_type text,
  evolution_message_id text,
  sender_name text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qual_msg_conv ON public.qual_messages(conversation_id, sent_at);
CREATE UNIQUE INDEX idx_qual_msg_evo ON public.qual_messages(evolution_message_id) WHERE evolution_message_id IS NOT NULL;
ALTER TABLE public.qual_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_msg_all_auth_select" ON public.qual_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_msg_all_auth_insert" ON public.qual_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_msg_all_auth_update" ON public.qual_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_msg_all_auth_delete" ON public.qual_messages FOR DELETE TO authenticated USING (true);

CREATE TABLE public.qual_lead_qualification (
  conversation_id uuid PRIMARY KEY REFERENCES public.qual_conversations(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{
    "necessidade": {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "decisor": {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "prazo": {"status":"pending","confidence":0,"evidence":null,"summary":null},
    "capacidade": {"status":"pending","confidence":0,"evidence":null,"summary":null}
  }'::jsonb,
  ai_summary text,
  lead_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_analyzed_at timestamptz,
  last_message_count int NOT NULL DEFAULT 0,
  disqualified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qual_lead_qualification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_qlead_all_auth_select" ON public.qual_lead_qualification FOR SELECT TO authenticated USING (true);
CREATE POLICY "qual_qlead_all_auth_insert" ON public.qual_lead_qualification FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qual_qlead_all_auth_update" ON public.qual_lead_qualification FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qual_qlead_all_auth_delete" ON public.qual_lead_qualification FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_qual_qlead_updated_at BEFORE UPDATE ON public.qual_lead_qualification FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qual_lead_qualification;
ALTER TABLE public.qual_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.qual_messages REPLICA IDENTITY FULL;
ALTER TABLE public.qual_lead_qualification REPLICA IDENTITY FULL;

CREATE TABLE public.mass_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL,
  message_template text,
  status text NOT NULL DEFAULT 'draft',
  throttle_ms integer NOT NULL DEFAULT 1500,
  total_leads integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  replied_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  media_url text,
  media_type text,
  media_mime text,
  evolution_instance text NOT NULL DEFAULT 'COMERCIAL_THEO',
  channel text NOT NULL DEFAULT 'meta_template',
  meta_template_name text,
  meta_template_language text DEFAULT 'pt_BR',
  meta_header_media_url text,
  handoff_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX idx_mass_campaigns_channel ON public.mass_campaigns(channel);
ALTER TABLE public.mass_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read mass_campaigns" ON public.mass_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mass_campaigns" ON public.mass_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update mass_campaigns" ON public.mass_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete mass_campaigns" ON public.mass_campaigns FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_mass_campaigns_updated_at BEFORE UPDATE ON public.mass_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mass_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.mass_campaigns(id) ON DELETE CASCADE,
  nome text, empresa text,
  telefone text NOT NULL,
  telefone_normalizado text,
  modelo text, cidade text, uf text, fonte text, segmento text,
  score numeric, prioridade text, email text, extra jsonb,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz, first_sent_at timestamptz, replied_at timestamptz,
  error_message text, evolution_message_id text, final_message text,
  manual_handoff boolean NOT NULL DEFAULT false,
  manual_handoff_at timestamptz,
  manual_replied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mass_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read mass_leads" ON public.mass_campaign_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mass_leads" ON public.mass_campaign_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update mass_leads" ON public.mass_campaign_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete mass_leads" ON public.mass_campaign_leads FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_mass_leads_campaign ON public.mass_campaign_leads(campaign_id);
CREATE INDEX idx_mass_leads_status ON public.mass_campaign_leads(campaign_id, status);
CREATE INDEX idx_mass_leads_phone ON public.mass_campaign_leads(telefone_normalizado);
CREATE TRIGGER trg_mass_leads_updated_at BEFORE UPDATE ON public.mass_campaign_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recalc_mass_campaign_counters(_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE mass_campaigns mc SET
    total_leads = sub.total, sent_count = sub.sent, failed_count = sub.failed, replied_count = sub.replied, updated_at = now()
  FROM (
    SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('sent','replied')) AS sent,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE status = 'replied') AS replied
    FROM mass_campaign_leads WHERE campaign_id = _campaign_id
  ) sub
  WHERE mc.id = _campaign_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.trg_recalc_mass_campaign_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalc_mass_campaign_counters(OLD.campaign_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_mass_campaign_counters(NEW.campaign_id);
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER mass_campaign_leads_recalc AFTER INSERT OR UPDATE OF status OR DELETE ON public.mass_campaign_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_mass_campaign_counters();
CREATE OR REPLACE FUNCTION public.set_mass_lead_first_sent_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.first_sent_at IS NULL AND NEW.sent_at IS NOT NULL AND NEW.status IN ('sent','replied') THEN
    NEW.first_sent_at := NEW.sent_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_mass_lead_first_sent_at BEFORE INSERT OR UPDATE ON public.mass_campaign_leads
FOR EACH ROW EXECUTE FUNCTION public.set_mass_lead_first_sent_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_campaign_leads;

CREATE POLICY "Agents can claim unassigned contacts" ON public.contacts FOR UPDATE TO authenticated
USING (assigned_agent_id IS NULL) WITH CHECK (assigned_agent_id = auth.uid());
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS interest_type text,
  ADD COLUMN IF NOT EXISTS desired_equipment text,
  ADD COLUMN IF NOT EXISTS is_reseller boolean,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS part_of_interest text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS address text;
CREATE POLICY "Authenticated can update contact info" ON public.contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.conversation_reply_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  level text NOT NULL,
  last_message_at timestamptz NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, level, last_message_at)
);
ALTER TABLE public.conversation_reply_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view reply alerts" ON public.conversation_reply_alerts FOR SELECT TO authenticated USING (true);

CREATE TABLE public.contact_interests (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  interest text,
  interest_type text,
  brands text[] NOT NULL DEFAULT '{}',
  models text[] NOT NULL DEFAULT '{}',
  last_analyzed_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contact interests" ON public.contact_interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contact interests" ON public.contact_interests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contact interests" ON public.contact_interests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete contact interests" ON public.contact_interests FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_contact_interests_updated_at BEFORE UPDATE ON public.contact_interests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "select_closed_history" ON public.conversations FOR SELECT TO authenticated
USING (status IN ('resolved'::conversation_status, 'closed'::conversation_status));
CREATE POLICY "select_messages_closed_history" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.status IN ('resolved'::conversation_status, 'closed'::conversation_status)));
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Data API grants for every public table
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.system_settings TO anon;
REVOKE SELECT (access_token, refresh_token) ON public.google_calendar_tokens FROM authenticated, anon;
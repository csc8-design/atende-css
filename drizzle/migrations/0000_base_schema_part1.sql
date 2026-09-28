-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/managers can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.agent_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (agent_id, department_id)
);

ALTER TABLE public.agent_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view" ON public.agent_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage" ON public.agent_departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  whatsapp_id TEXT UNIQUE,
  avatar_url TEXT,
  notes TEXT,
  assigned_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers see all contacts" ON public.contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents see own contacts" ON public.contacts FOR SELECT TO authenticated USING (assigned_agent_id = auth.uid());
CREATE POLICY "Agents can update own contacts" ON public.contacts FOR UPDATE TO authenticated USING (assigned_agent_id = auth.uid());
CREATE POLICY "Admins/managers can manage contacts" ON public.contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TYPE public.conversation_status AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE public.conversation_channel AS ENUM ('whatsapp', 'instagram', 'telegram', 'webchat');

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  assigned_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  channel conversation_channel NOT NULL DEFAULT 'whatsapp',
  status conversation_status NOT NULL DEFAULT 'open',
  subject TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closing_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers see all conversations" ON public.conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents see assigned conversations" ON public.conversations FOR SELECT TO authenticated USING (assigned_agent_id = auth.uid());
CREATE POLICY "Agents can update assigned conversations" ON public.conversations FOR UPDATE TO authenticated USING (assigned_agent_id = auth.uid());
CREATE POLICY "Admins/managers can manage conversations" ON public.conversations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TYPE public.message_sender_type AS ENUM ('contact', 'agent', 'system');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'audio', 'video', 'document', 'location', 'sticker');

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_type message_sender_type NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT,
  message_type message_type NOT NULL DEFAULT 'text',
  media_url TEXT,
  whatsapp_message_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages of visible conversations" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
);
CREATE POLICY "Agents can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
);
CREATE POLICY "Service role can insert messages" ON public.messages FOR INSERT TO service_role WITH CHECK (true);

CREATE TABLE public.conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notes" ON public.conversation_notes FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
);
CREATE POLICY "Users can insert notes" ON public.conversation_notes FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE TABLE public.quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quick replies" ON public.quick_replies FOR SELECT TO authenticated USING (is_global = true OR created_by = auth.uid());
CREATE POLICY "Users can manage own replies" ON public.quick_replies FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins can manage all" ON public.quick_replies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view tags" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tags" ON public.tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.conversation_tags (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (conversation_id, tag_id)
);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view" ON public.conversation_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can manage tags on their conversations" ON public.conversation_tags
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (
      c.assigned_agent_id = auth.uid() OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
    )
  )
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

CREATE INDEX idx_conversations_agent ON public.conversations(assigned_agent_id);
CREATE INDEX idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_contacts_agent ON public.contacts(assigned_agent_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);

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

CREATE TABLE public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.internal_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER update_internal_channels_updated_at BEFORE UPDATE ON public.internal_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_internal_messages_updated_at BEFORE UPDATE ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

CREATE INDEX idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX idx_channel_members_channel ON public.channel_members(channel_id);
CREATE INDEX idx_internal_messages_channel ON public.internal_messages(channel_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at);

CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id UUID;
BEGIN
  SELECT ic.id INTO channel_id
  FROM internal_channels ic
  WHERE ic.channel_type = 'direct'
    AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = ic.id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = ic.id AND user_id = other_user_id)
    AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = ic.id) = 2
  LIMIT 1;

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

CREATE TABLE public.chatbot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  system_prompt text NOT NULL DEFAULT 'Você é um assistente virtual da ENGWE Brasil. Seja educado, objetivo e ajude o revendedor com suas dúvidas.',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  welcome_message text DEFAULT 'Olá! Sou o assistente virtual da ENGWE Brasil. Como posso ajudar?',
  is_active boolean NOT NULL DEFAULT true,
  max_tokens integer DEFAULT 1024,
  temperature numeric(3,2) DEFAULT 0.7,
  auto_transfer_to_agent boolean NOT NULL DEFAULT true,
  transfer_keywords text[] DEFAULT ARRAY['atendente', 'humano', 'pessoa', 'agente']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view chatbot configs"
  ON public.chatbot_configs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins/managers can manage chatbot configs"
  ON public.chatbot_configs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_chatbot_configs_updated_at
  BEFORE UPDATE ON public.chatbot_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chatbot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id uuid REFERENCES public.chatbot_configs(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  transferred_to_agent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view chatbot logs"
  ON public.chatbot_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage chatbot logs"
  ON public.chatbot_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_chatbot_logs_updated_at
  BEFORE UPDATE ON public.chatbot_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.chatbot_configs (name, description, system_prompt, welcome_message)
VALUES (
  'Assistente ENGWE',
  'Chatbot principal de atendimento a revendedores',
  'Você é o assistente virtual da ENGWE Brasil, fabricante de bicicletas elétricas e patinetes. Seu papel é:
1. Receber e entender a necessidade do revendedor ou cliente
2. Fornecer informações sobre os modelos ENGWE e condições de revenda
3. Identificar o departamento correto para encaminhar o contato
4. Ser educado, profissional e objetivo

Se o contato pedir para falar com um atendente humano, informe que será transferido imediatamente.',
  'Olá! 👋 Bem-vindo à ENGWE Brasil! Sou o assistente virtual. Como posso ajudar hoje?'
);
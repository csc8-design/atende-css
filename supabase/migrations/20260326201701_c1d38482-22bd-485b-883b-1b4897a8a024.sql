-- Tabela de empresas/tenants gerenciadas pela BSec
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  document text,
  email text,
  phone text,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#6366f1',
  platform_name text,
  login_title text,
  login_subtitle text,
  custom_domain text,
  plan text DEFAULT 'basic',
  max_users integer DEFAULT 5,
  max_conversations integer DEFAULT 500,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on tenants"
ON public.tenants FOR ALL TO authenticated
USING (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
)
WITH CHECK (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
);

-- Tabela de configurações de APIs por tenant
CREATE TABLE public.tenant_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'whatsapp',
  config_key text NOT NULL,
  config_value text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, provider, config_key)
);

ALTER TABLE public.tenant_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on tenant_api_configs"
ON public.tenant_api_configs FOR ALL TO authenticated
USING (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
)
WITH CHECK (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
);

-- Tabela de pagamentos/financeiro por tenant
CREATE TABLE public.tenant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'BRL',
  status text DEFAULT 'pending',
  payment_method text,
  reference_month text,
  description text,
  paid_at timestamptz,
  due_date date,
  invoice_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on tenant_payments"
ON public.tenant_payments FOR ALL TO authenticated
USING (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
)
WITH CHECK (
  auth.uid() IN (SELECT au.id FROM auth.users au WHERE au.email = 'admin@bsec.com.br')
);

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_api_configs_updated_at BEFORE UPDATE ON public.tenant_api_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_payments_updated_at BEFORE UPDATE ON public.tenant_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
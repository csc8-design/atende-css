-- Fix RLS policies to use auth.jwt() instead of querying auth.users
DROP POLICY IF EXISTS "Superadmin full access on tenants" ON public.tenants;
CREATE POLICY "Superadmin full access on tenants"
ON public.tenants FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@bsec.com.br')
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@bsec.com.br');

DROP POLICY IF EXISTS "Superadmin full access on tenant_api_configs" ON public.tenant_api_configs;
CREATE POLICY "Superadmin full access on tenant_api_configs"
ON public.tenant_api_configs FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@bsec.com.br')
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@bsec.com.br');

DROP POLICY IF EXISTS "Superadmin full access on tenant_payments" ON public.tenant_payments;
CREATE POLICY "Superadmin full access on tenant_payments"
ON public.tenant_payments FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@bsec.com.br')
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@bsec.com.br');
-- Liberar acesso total à tabela prospect_leads para todos usuários autenticados
-- Mantém apenas a regra de que o created_by precisa ser o próprio usuário ao criar (garantia de auditoria)

DROP POLICY IF EXISTS "Agents can view own prospect leads" ON public.prospect_leads;
DROP POLICY IF EXISTS "Agents can update own prospect leads" ON public.prospect_leads;
DROP POLICY IF EXISTS "Agents can delete own prospect leads" ON public.prospect_leads;
DROP POLICY IF EXISTS "Authenticated can insert prospect leads" ON public.prospect_leads;

-- Todos autenticados visualizam todos os leads
CREATE POLICY "Authenticated can view all prospect leads"
ON public.prospect_leads
FOR SELECT
TO authenticated
USING (true);

-- Todos autenticados podem atualizar qualquer lead
CREATE POLICY "Authenticated can update all prospect leads"
ON public.prospect_leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Todos autenticados podem deletar qualquer lead
CREATE POLICY "Authenticated can delete all prospect leads"
ON public.prospect_leads
FOR DELETE
TO authenticated
USING (true);

-- Inserção continua exigindo created_by = auth.uid() (auditoria)
CREATE POLICY "Authenticated can insert prospect leads"
ON public.prospect_leads
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
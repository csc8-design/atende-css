
-- Desativa departamentos antigos
UPDATE public.departments SET is_active = false;

-- Insere os 11 novos departamentos com IDs determinísticos
INSERT INTO public.departments (id, name, is_active) VALUES
  ('11111111-0001-4000-8000-000000000001', 'Comercial', true),
  ('11111111-0001-4000-8000-000000000002', 'Financeiro', true),
  ('11111111-0001-4000-8000-000000000003', 'Pós-Vendas', true),
  ('11111111-0001-4000-8000-000000000004', 'Peças Balcão', true),
  ('11111111-0001-4000-8000-000000000005', 'Loja Online', true),
  ('11111111-0001-4000-8000-000000000006', 'Importação', true),
  ('11111111-0001-4000-8000-000000000007', 'Seguros', true),
  ('11111111-0001-4000-8000-000000000008', 'Consórcios', true),
  ('11111111-0001-4000-8000-000000000009', 'Consultoria Especializada', true),
  ('11111111-0001-4000-8000-000000000010', 'Governo', true),
  ('11111111-0001-4000-8000-000000000011', 'Telemetria', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Atualiza welcome_message do Menu Inicial
UPDATE public.chatbot_configs
SET welcome_message = 'Olá! 👋 Bem-vindo à CBMaq. Selecione o departamento desejado:

1️⃣ Comercial
2️⃣ Financeiro
3️⃣ Pós-Vendas
4️⃣ Peças Balcão
5️⃣ Loja Online
6️⃣ Importação
7️⃣ Seguros
8️⃣ Consórcios
9️⃣ Consultoria Especializada
🔟 Governo
1️⃣1️⃣ Telemetria',
    updated_at = now()
WHERE id = 'd7481ace-4b58-484b-ad3b-f9f85bfacae7';

-- Desativa submenus antigos (não serão mais usados)
UPDATE public.chatbot_configs
SET is_active = false, updated_at = now()
WHERE id IN (
  '65d59849-8784-4618-b6ac-ab4d56f04dbb',
  '9106f653-b20b-41f5-ae96-b618fbfa6ccb',
  '62c0d61c-1bdd-4e3e-8493-1fec03f40008',
  'f1e2d3c4-b5a6-7890-abcd-1234567890ab'
);

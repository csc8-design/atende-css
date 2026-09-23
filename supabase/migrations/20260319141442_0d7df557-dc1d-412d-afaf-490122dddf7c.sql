-- Insert new Submenu Peças chatbot config
INSERT INTO chatbot_configs (id, name, welcome_message, department_id, is_active, system_prompt, menu_options)
VALUES (
  'f1e2d3c4-b5a6-7890-abcd-1234567890ab',
  'Submenu Peças',
  'Selecione sua região:

1️⃣ Brasília DF
2️⃣ Goiânia GO',
  '621496b7-d9a7-43fd-b029-cda800c62649',
  true,
  'Você é um assistente virtual da CBMaq. Seja educado, objetivo e ajude o cliente com suas dúvidas.',
  '[]'::jsonb
);

-- Update Submenu Comercial welcome message (remove Vendas Online, keep only 2 options)
UPDATE chatbot_configs
SET welcome_message = 'Ótimo, seja bem vindo ao Comercial, selecione o assunto que você deseja:

1️⃣ Máquinas novas
2️⃣ Peças',
    updated_at = now()
WHERE id = '65d59849-8784-4618-b6ac-ab4d56f04dbb';

-- Update Submenu Pós Vendas welcome message (remove Garantia, keep only 2 options)
UPDATE chatbot_configs
SET welcome_message = 'Seja bem vindo ao Pós Vendas, selecione a opção que deseja falar:

1️⃣ Serviços
2️⃣ Peças',
    updated_at = now()
WHERE id = '62c0d61c-1bdd-4e3e-8493-1fec03f40008';
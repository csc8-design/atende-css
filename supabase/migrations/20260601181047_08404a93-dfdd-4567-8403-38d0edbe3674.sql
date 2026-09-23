INSERT INTO public.departments (id, name, description, is_active)
VALUES ('11111111-0001-4000-8000-000000000013', 'RH', 'Recursos Humanos', true)
ON CONFLICT (id) DO NOTHING;

UPDATE public.chatbot_configs
SET welcome_message = 'Olá! 👋 Bem-vindo à CBMaq. Selecione o departamento desejado:

1️⃣ Comercial Máquinas e Tratores
2️⃣ Financeiro
3️⃣ Pós-Vendas
4️⃣ Peças Balcão
5️⃣ Loja Online
6️⃣ Importação
7️⃣ Seguros
8️⃣ Consórcios
9️⃣ Consultoria Especializada 
🔟 Governo
1️⃣1️⃣ Telemetria
1️⃣2️⃣ Compras (Fornecedores)
1️⃣3️⃣ RH'
WHERE id = 'd7481ace-4b58-484b-ad3b-f9f85bfacae7';
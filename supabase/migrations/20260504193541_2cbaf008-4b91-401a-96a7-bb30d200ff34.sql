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
*11.* Telemetria',
    updated_at = now()
WHERE id = 'd7481ace-4b58-484b-ad3b-f9f85bfacae7';
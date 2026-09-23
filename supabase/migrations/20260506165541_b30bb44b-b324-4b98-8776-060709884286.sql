ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS chatbot_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS cnpj text;
-- Create enum for contact categories
CREATE TYPE public.contact_category AS ENUM ('bronze', 'prata', 'ouro', 'diamante', 'vip');

-- Add category column to contacts
ALTER TABLE public.contacts ADD COLUMN category public.contact_category NULL;
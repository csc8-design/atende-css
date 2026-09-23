// Cliente Supabase ISOLADO para o projeto externo do site CBMaq
// Não usar para nada além da tabela "Lead" (leads site cbmaq).
import { createClient } from "@supabase/supabase-js";

const CBMAQ_SITE_URL = "https://mfwdxbpejpkyvawaypnj.supabase.co";
const CBMAQ_SITE_PUBLISHABLE_KEY = "sb_publishable_92naahXZuWs9wImWUpDUIQ_tXn1DOWF";

export const cbmaqSiteSupabase = createClient(CBMAQ_SITE_URL, CBMAQ_SITE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface CbmaqSiteLead {
  id: string;
  type: "CONTATO" | "QUOTE" | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  data: Record<string, any> | null;
  status: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

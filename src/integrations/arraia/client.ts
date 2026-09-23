// Cliente Supabase ISOLADO para a base de leads "Arraiá CBmaq 2026".
// Usar apenas para a tabela `campaign_leads` da base externa.
import { createClient } from "@supabase/supabase-js";

const URL = "https://vztzqxjdumdujlckagkt.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_ahY_9UzqYikeDcRiy9S4zg_uqndwhF4";

export const arraiaSupabase = createClient(URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

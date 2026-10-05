import { createClient } from "npm:@supabase/supabase-js@2";

export type MetaCreds = {
  token: string | undefined;
  phoneNumberId: string | undefined;
  businessAccountId: string | undefined;
  verifyToken: string | undefined;
};

let cache: { at: number; value: MetaCreds } | null = null;

// Credentials saved in Settings > Meta take priority; env secrets are the fallback.
export async function getMetaCreds(): Promise<MetaCreds> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let row: any = null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await sb.from("meta_credentials").select("*").eq("id", 1).maybeSingle();
    row = data;
  } catch (_) { /* fallback to env */ }
  const value: MetaCreds = {
    token: row?.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || undefined,
    phoneNumberId: row?.phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || undefined,
    businessAccountId: row?.business_account_id || Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") || undefined,
    verifyToken: row?.verify_token || Deno.env.get("WHATSAPP_VERIFY_TOKEN") || undefined,
  };
  cache = { at: Date.now(), value };
  return value;
}

import { supabase } from "@/integrations/supabase/client";

// Helper to query tables not yet in the generated types (tenants, tenant_api_configs, tenant_payments)
// These tables exist in the database but the types.ts is read-only and hasn't been regenerated.
export const supabaseAdmin = supabase as any;

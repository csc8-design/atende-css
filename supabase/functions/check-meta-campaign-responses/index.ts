import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function phoneVariants(raw: string | null | undefined): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const set = new Set<string>([digits]);
  if (digits.startsWith("55")) set.add(digits.slice(2));
  else set.add("55" + digits);
  const last11 = digits.slice(-11);
  const last10 = digits.slice(-10);
  if (last11) { set.add(last11); set.add("55" + last11); }
  if (last10) { set.add(last10); set.add("55" + last10); }
  for (const v of Array.from(set)) {
    if (v.length === 13 && v.startsWith("55") && v[4] === "9") set.add(v.slice(0, 4) + v.slice(5));
    if (v.length === 11 && v[2] === "9") set.add(v.slice(0, 2) + v.slice(3));
    if (v.length === 12 && v.startsWith("55")) set.add(v.slice(0, 4) + "9" + v.slice(4));
    if (v.length === 10) set.add(v.slice(0, 2) + "9" + v.slice(2));
  }
  return [...set].filter((v) => v.length >= 10);
}

async function fetchCampaignLeads(admin: any, campaignId: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("mass_campaign_leads")
      .select("id, telefone, telefone_normalizado, sent_at, status")
      .eq("campaign_id", campaignId)
      .not("sent_at", "is", null)
      .in("status", ["sent", "replied", "failed"])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function refreshCounters(admin: any, campaignId: string) {
  const { data: rows } = await admin
    .from("mass_campaign_leads")
    .select("status")
    .eq("campaign_id", campaignId);
  const sent = rows?.filter((r: any) => r.status === "sent" || r.status === "replied").length || 0;
  const replied = rows?.filter((r: any) => r.status === "replied").length || 0;
  const failed = rows?.filter((r: any) => r.status === "failed").length || 0;
  await admin
    .from("mass_campaigns")
    .update({ sent_count: sent, replied_count: replied, failed_count: failed, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  return { sent, replied, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const headerKey = req.headers.get("apikey") || req.headers.get("x-api-key");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!anonKey || !serviceRoleKey || !supabaseUrl) return json({ error: "Supabase não configurado" }, 500);

  const supabase = createClient(
    supabaseUrl,
    anonKey,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
  const isTrustedKey = token === serviceRoleKey || token === anonKey || headerKey === anonKey || headerKey === serviceRoleKey;
  if (!isTrustedKey) {
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { campaignId } = body as { campaignId?: string };

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Descobre quais campanhas meta_template checar
    let camps: { id: string }[] = [];
    if (campaignId) {
      camps = [{ id: campaignId }];
    } else {
      const { data } = await admin
        .from("mass_campaigns")
        .select("id")
        .eq("channel", "meta_template");
      camps = data || [];
    }

    let totalChecked = 0;
    let totalNewReplies = 0;
    const perCampaign: any[] = [];

    for (const c of camps) {
      const leads = await fetchCampaignLeads(admin, c.id);

      if (!leads || leads.length === 0) {
        perCampaign.push({ campaign_id: c.id, checked: 0, new_replies: 0 });
        continue;
      }

      let newReplies = 0;
      for (const lead of leads) {
        const variants = phoneVariants(lead.telefone_normalizado || lead.telefone || "");
        if (variants.length === 0) continue;

        // Busca contatos com qualquer variante do telefone
        const { data: contacts } = await admin
          .from("contacts")
          .select("id, phone")
          .or(variants.map((v) => `phone.eq.${v}`).join(","));

        const matchedIds = (contacts || [])
          .filter((ct) => variants.includes((ct.phone || "").replace(/\D/g, "")))
          .map((ct) => ct.id);

        if (matchedIds.length === 0) continue;

        const { data: convs } = await admin
          .from("conversations")
          .select("id")
          .in("contact_id", matchedIds);
        const convIds = (convs || []).map((c: any) => c.id);
        if (convIds.length === 0) continue;

        const { data: msgs } = await admin
          .from("messages")
          .select("created_at")
          .in("conversation_id", convIds)
          .eq("sender_type", "contact")
          .gte("created_at", lead.sent_at as string)
          .order("created_at", { ascending: true })
          .limit(1);

        if (msgs && msgs.length > 0) {
          await admin
            .from("mass_campaign_leads")
            .update({
              status: "replied",
              replied_at: msgs[0].created_at,
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id);
          if (lead.status !== "replied") newReplies++;
        }
      }

      const counters = await refreshCounters(admin, c.id);
      totalChecked += leads.length;
      totalNewReplies += newReplies;
      perCampaign.push({ campaign_id: c.id, checked: leads.length, new_replies: newReplies, total_replied: counters.replied });
    }

    return json({ campaigns: camps.length, checked: totalChecked, new_replies: totalNewReplies, details: perCampaign });
  } catch (err: any) {
    console.error("check-meta-campaign-responses error:", err);
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find open/pending conversations where the last message is from a contact
    // and was sent more than 5 minutes ago with no agent reply after it
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: conversations, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, contact_id, assigned_agent_id, department_id, contacts(name)")
      .in("status", ["open", "pending"]);

    if (convError) throw convError;

    let notificationsCreated = 0;

    for (const conv of conversations || []) {
      // Get last message
      const { data: lastMessages } = await supabaseAdmin
        .from("messages")
        .select("sender_type, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!lastMessages || lastMessages.length === 0) continue;

      const lastMsg = lastMessages[0];
      // Only alert if last message is from contact and older than 5 min
      if (lastMsg.sender_type !== "contact") continue;
      if (lastMsg.created_at > fiveMinAgo) continue;

      // Find supervisors (managers) for this conversation's department
      if (!conv.department_id) continue;

      const { data: deptManagers } = await supabaseAdmin
        .from("agent_departments")
        .select("agent_id")
        .eq("department_id", conv.department_id);

      if (!deptManagers || deptManagers.length === 0) continue;

      // Get manager user_ids
      const managerIds: string[] = [];
      for (const dm of deptManagers) {
        const { data: hasRole } = await supabaseAdmin.rpc("has_role", {
          _user_id: dm.agent_id,
          _role: "manager",
        });
        if (hasRole) managerIds.push(dm.agent_id);
      }

      // Also notify admins
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      for (const ar of adminRoles || []) {
        if (!managerIds.includes(ar.user_id)) managerIds.push(ar.user_id);
      }

      if (managerIds.length === 0) continue;

      // Check if we already notified about this conversation recently (last 10 min)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("reference_id", conv.id)
        .eq("type", "inactivity_alert")
        .gte("created_at", tenMinAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const contactName = (conv as any).contacts?.name || "Contato";
      const notifications = managerIds.map((userId) => ({
        user_id: userId,
        title: "Conversa sem resposta",
        body: `${contactName} aguarda resposta há mais de 5 minutos.`,
        type: "inactivity_alert",
        reference_id: conv.id,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from("notifications")
        .insert(notifications);

      if (!insertErr) notificationsCreated += notifications.length;
    }

    return new Response(
      JSON.stringify({ success: true, notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

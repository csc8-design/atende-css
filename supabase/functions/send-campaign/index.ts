import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHATSAPP_API = "https://graph.facebook.com/v23.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { campaignId, action } = await req.json();

    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle pause/cancel actions
    if (action === "pause") {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);
      return new Response(JSON.stringify({ success: true, message: "Campaign paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "cancelled" })
        .eq("id", campaignId);
      return new Response(JSON.stringify({ success: true, message: "Campaign cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate template (Meta requires approved templates for bulk messaging)
    if (!campaign.template_name) {
      return new Response(
        JSON.stringify({ error: "Template name is required. Meta requires approved message templates for bulk messaging." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark campaign as sending
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "sending", started_at: new Date().toISOString() })
      .eq("id", campaignId);

    // Fetch pending contacts with their phone/whatsapp_id
    const { data: campaignContacts } = await supabaseAdmin
      .from("campaign_contacts")
      .select("id, contact_id, contacts(phone, whatsapp_id, name)")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (!campaignContacts || campaignContacts.length === 0) {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
      return new Response(JSON.stringify({ success: true, message: "No pending contacts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchSize = campaign.batch_size || 50;
    const batchDelay = (campaign.batch_delay_seconds || 5) * 1000;
    let sentCount = campaign.sent_count || 0;
    let failedCount = campaign.failed_count || 0;

    // Process in batches (Meta compliance: rate limiting)
    for (let i = 0; i < campaignContacts.length; i += batchSize) {
      // Check if campaign was paused/cancelled
      const { data: currentCampaign } = await supabaseAdmin
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (currentCampaign?.status === "paused" || currentCampaign?.status === "cancelled") {
        break;
      }

      const batch = campaignContacts.slice(i, i + batchSize);

      for (const cc of batch) {
        const contact = (cc as any).contacts;
        if (!contact) continue;

        const recipientPhone = contact.whatsapp_id || contact.phone;
        if (!recipientPhone) {
          await supabaseAdmin
            .from("campaign_contacts")
            .update({ status: "failed", error_message: "No phone number" })
            .eq("id", cc.id);
          failedCount++;
          continue;
        }

        // Clean phone number
        const cleanPhone = recipientPhone.replace(/\D/g, "");

        try {
          // Send template message via Meta API
          const templateBody: any = {
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "template",
            template: {
              name: campaign.template_name,
              language: { code: campaign.template_language || "pt_BR" },
            },
          };

          // Add template components if configured
          const components = campaign.template_components;
          if (components && Array.isArray(components) && components.length > 0) {
            templateBody.template.components = components;
          }

          const response = await fetch(
            `${WHATSAPP_API}/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(templateBody),
            }
          );

          const result = await response.json();

          if (response.ok && result.messages?.[0]?.id) {
            await supabaseAdmin
              .from("campaign_contacts")
              .update({
                status: "sent",
                whatsapp_message_id: result.messages[0].id,
                sent_at: new Date().toISOString(),
              })
              .eq("id", cc.id);
            sentCount++;
          } else {
            const errorMsg = result.error?.message || JSON.stringify(result);
            await supabaseAdmin
              .from("campaign_contacts")
              .update({ status: "failed", error_message: errorMsg })
              .eq("id", cc.id);
            failedCount++;

            // Meta error 130429 = rate limit hit, pause campaign
            if (result.error?.code === 130429) {
              await supabaseAdmin
                .from("campaigns")
                .update({
                  status: "paused",
                  sent_count: sentCount,
                  failed_count: failedCount,
                })
                .eq("id", campaignId);

              return new Response(
                JSON.stringify({
                  success: false,
                  message: "Rate limit hit. Campaign paused automatically. Try again later.",
                  sent: sentCount,
                  failed: failedCount,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (err) {
          await supabaseAdmin
            .from("campaign_contacts")
            .update({ status: "failed", error_message: String(err) })
            .eq("id", cc.id);
          failedCount++;
        }

        // Small delay between individual messages (Meta compliance)
        await new Promise((r) => setTimeout(r, 100));
      }

      // Update stats after each batch
      await supabaseAdmin
        .from("campaigns")
        .update({ sent_count: sentCount, failed_count: failedCount })
        .eq("id", campaignId);

      // Delay between batches
      if (i + batchSize < campaignContacts.length) {
        await new Promise((r) => setTimeout(r, batchDelay));
      }
    }

    // Final update
    const { data: finalCampaign } = await supabaseAdmin
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .single();

    if (finalCampaign?.status === "sending") {
      await supabaseAdmin
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq("id", campaignId);
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Campaign error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

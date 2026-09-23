import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  try {
    const contentType = req.headers.get("content-type") || "";
    let conversationId: string;
    let message: string | undefined;
    let messageType = "text";
    let templateName: string | undefined;
    let templateLanguage = "pt_BR";
    let templateComponents: any[] = [];
    let mediaUrl: string | null = null;
    let fileName: string | null = null;
    let metadata: Record<string, any> | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      conversationId = formData.get("conversationId") as string;
      message = (formData.get("message") as string) || "";
      const file = formData.get("file") as File | null;

      if (!conversationId || !file) {
        return new Response(
          JSON.stringify({ error: "conversationId and file are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      fileName = file.name;
      const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
      const uniqueName = `${crypto.randomUUID()}.${ext}`;
      const mimeType = file.type || "application/octet-stream";

      // Determine message type from mime
      if (mimeType.startsWith("image/")) {
        messageType = "image";
      } else if (mimeType.startsWith("video/")) {
        messageType = "video";
      } else if (mimeType.startsWith("audio/")) {
        messageType = "audio";
      } else {
        messageType = "document";
      }

      // Upload to Supabase Storage using service client
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const arrayBuffer = await file.arrayBuffer();
      const fileBody = new Uint8Array(arrayBuffer);

      const { data: uploadData, error: uploadError } = await serviceClient.storage
        .from("whatsapp-media")
        .upload(uniqueName, fileBody, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Failed to upload file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      mediaUrl = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/${uniqueName}`;
    } else {
      // Handle JSON body (text / template / pre-uploaded media)
      const body = await req.json();
      conversationId = body.conversationId;
      message = body.message;
      messageType = body.messageType || "text";
      templateName = body.templateName;
      templateLanguage = body.templateLanguage || "pt_BR";
      templateComponents = body.templateComponents || [];
      mediaUrl = body.mediaUrl || null;
      fileName = body.fileName || null;
      metadata = body.metadata || null;
    }

    if (!conversationId || (!message && !templateName && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "conversationId and (message, templateName, or file) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation with contact
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conversation, error: convError } = await serviceClient
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = conversation.contacts?.phone;
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    // Build mandatory signature: "FirstName LastName - Department:"
    let signature = "";
    try {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      let deptName: string | null = null;
      if (conversation.department_id) {
        const { data: dept } = await serviceClient
          .from("departments")
          .select("name")
          .eq("id", conversation.department_id)
          .maybeSingle();
        deptName = dept?.name || null;
      }

      const fullName = (profile?.full_name || "").trim();
      let shortName = fullName;
      if (fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        shortName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
      }

      if (shortName && deptName) {
        signature = `*${shortName} - ${deptName}:*\n`;
      } else if (shortName) {
        signature = `*${shortName}:*\n`;
      }
    } catch (e) {
      console.error("Signature build error:", e);
    }

    // Prepend signature to text messages and media captions (not to templates)
    if (!templateName && signature) {
      if (message && message.length > 0) {
        message = `${signature}${message}`;
      } else if (messageType === "text") {
        message = signature.trim();
      } else if (mediaUrl) {
        // add caption with just signature for media without caption
        message = signature.trim();
      }
    }

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.warn("WhatsApp credentials not configured, saving message locally only");
    } else {
      let waBody: any;

      if (templateName) {
        waBody = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
          },
        };
        if (templateComponents.length > 0) {
          waBody.template.components = templateComponents;
        }
      } else if (mediaUrl && messageType !== "text") {
        // Send media message
        const mediaTypeMap: Record<string, string> = {
          image: "image",
          video: "video",
          audio: "audio",
          document: "document",
        };
        const waMediaType = mediaTypeMap[messageType] || "document";

        waBody = {
          messaging_product: "whatsapp",
          to: phone,
          type: waMediaType,
          [waMediaType]: {
            link: mediaUrl,
            ...(message ? { caption: message } : {}),
            ...(waMediaType === "document" && fileName ? { filename: fileName } : {}),
          },
        };
      } else {
        waBody = {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        };
      }

      console.log("Sending WhatsApp message:", JSON.stringify(waBody));

      const waResponse = await fetch(
        `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(waBody),
        }
      );

      const waResult = await waResponse.json();
      console.log("WhatsApp API response:", JSON.stringify(waResult));

      if (!waResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to send WhatsApp message", details: waResult }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Save message to DB
    const { data: savedMessage, error: msgError } = await serviceClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "agent",
        sender_id: userId,
        content: templateName ? `[Template: ${templateName}] ${message || ""}` : (message || fileName || ""),
        message_type: messageType,
        media_url: mediaUrl,
        metadata,
        is_read: true,
      })
      .select()
      .single();

    if (msgError) {
      console.error("Message save error:", msgError);
      return new Response(JSON.stringify({ error: "Failed to save message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update conversation
    await serviceClient
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
      .eq("id", conversationId);

    return new Response(JSON.stringify({ success: true, message: savedMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

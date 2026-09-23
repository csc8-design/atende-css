import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista fixa solicitada pelo usuário: nome do grupo => id do departamento existente
const DEPT_GROUPS: { name: string; departmentId: string }[] = [
  { name: "Comercial Máquinas e Tratores", departmentId: "11111111-0001-4000-8000-000000000001" },
  { name: "Financeiro",                     departmentId: "11111111-0001-4000-8000-000000000002" },
  { name: "Pós-Vendas",                     departmentId: "11111111-0001-4000-8000-000000000003" },
  { name: "Peças Balcão",                   departmentId: "11111111-0001-4000-8000-000000000004" },
  { name: "Loja Online",                    departmentId: "11111111-0001-4000-8000-000000000005" },
  { name: "Importação",                     departmentId: "11111111-0001-4000-8000-000000000006" },
  { name: "Seguros",                        departmentId: "11111111-0001-4000-8000-000000000007" },
  { name: "Consórcios",                     departmentId: "11111111-0001-4000-8000-000000000008" },
  { name: "Consultoria Especializada",      departmentId: "11111111-0001-4000-8000-000000000009" },
  { name: "Governo",                        departmentId: "11111111-0001-4000-8000-000000000010" },
  { name: "Telemetria",                     departmentId: "11111111-0001-4000-8000-000000000011" },
  { name: "Compras (Fornecedores)",         departmentId: "11111111-0001-4000-8000-000000000012" },
  { name: "RH",                             departmentId: "11111111-0001-4000-8000-000000000013" },
];

const INITIAL_PARTICIPANT = "5561991535271";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const INSTANCE = Deno.env.get("EVOLUTION_NOTIFY_INSTANCE") || "ENVIO_NOT";
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "Evolution credentials missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    try { const u = new URL(baseUrl); baseUrl = `${u.protocol}//${u.host}`; } catch {}

    // Já existentes
    const { data: existing } = await supabase
      .from("department_whatsapp_groups")
      .select("department_id, group_jid, group_name");
    const existingMap = new Map((existing || []).map((r: any) => [r.department_id, r]));

    const results: any[] = [];

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let firstCreate = true;
    for (const dept of DEPT_GROUPS) {
      if (existingMap.has(dept.departmentId)) {
        results.push({ department: dept.name, status: "skipped", reason: "already exists", group_jid: existingMap.get(dept.departmentId)!.group_jid });
        continue;
      }

      // Espera entre criações para evitar rate-overlimit do WhatsApp
      if (!firstCreate) await sleep(8000);
      firstCreate = false;

      const groupName = `AtendeCBMaq - ${dept.name}`;
      const createRes = await fetch(`${baseUrl}/group/create/${INSTANCE}`, {
        method: "POST",
        headers: { "apikey": EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: groupName,
          description: `Notificações automáticas de novos atendimentos do departamento ${dept.name}.`,
          participants: [INITIAL_PARTICIPANT],
        }),
      });

      const json = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        results.push({ department: dept.name, status: "error", error: json });
        continue;
      }

      // Evolution retorna o JID em campos variados conforme versão
      const groupJid: string | undefined =
        json?.groupJid || json?.id || json?.data?.id || json?.data?.groupJid || json?.key?.remoteJid;

      if (!groupJid) {
        results.push({ department: dept.name, status: "error", error: "no group_jid in response", raw: json });
        continue;
      }

      const { error: insertErr } = await supabase
        .from("department_whatsapp_groups")
        .insert({ department_id: dept.departmentId, group_jid: groupJid, group_name: groupName });

      if (insertErr) {
        results.push({ department: dept.name, status: "created_but_db_error", group_jid: groupJid, error: insertErr.message });
        continue;
      }

      results.push({ department: dept.name, status: "created", group_jid: groupJid });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-department-groups error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

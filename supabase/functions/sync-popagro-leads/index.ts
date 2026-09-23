import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POPAGRO_BASE = "https://api.popagro.com.br/api/1.0";

async function fetchPopAgroLeads(url: string, apiKey: string, sellerId: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      "X-Seller-Id": sellerId,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PopAgro ${res.status}: ${body || "Falha na chamada à API PopAgro"}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("POPAGRO_API_KEY");
    const sellerId = Deno.env.get("POPAGRO_SELLER_ID");
    if (!apiKey || !sellerId) throw new Error("POPAGRO_API_KEY ou POPAGRO_SELLER_ID não configurados");

    const targetUrl = Deno.env.get("DEALERNET_SUPABASE_URL");
    const targetKey = Deno.env.get("DEALERNET_SERVICE_ROLE_KEY");
    if (!targetUrl || !targetKey) throw new Error("DEALERNET_SUPABASE_URL ou DEALERNET_SERVICE_ROLE_KEY não configurados");
    const supabase = createClient(targetUrl, targetKey);

    const pageSize = 100;
    let page = 0;
    let totalPages = 1;
    let totalElements = 0;
    let totalImportado = 0;
    let paginasProcessadas = 0;

    while (page < totalPages) {
      const url = `${POPAGRO_BASE}/leads?page=${page}&pageSize=${pageSize}`;
      const json = await fetchPopAgroLeads(url, apiKey, sellerId);

      const items: any[] =
        json.data || json.elements || json.content || json.leads || [];
      totalPages = json.numberOfPages ?? 1;
      totalElements = json.totalElements ?? items.length;

      if (items.length > 0) {
        const rows = items.map((x: any) => ({
          popagro_id: String(x.id),
          nome: x.name ?? null,
          email: x.email ?? null,
          telefone: x.telephone ?? null,
          mensagem: x.message ?? null,
          cidade: x.cityName ?? null,
          uf: x.uf ?? null,
          produto_id: x.productId != null ? String(x.productId) : null,
          produto_nome: x.productName ?? null,
          produto_marca: x.productMake ?? null,
          produto_modelo: x.productModel ?? null,
          produto_valor: x.productValue ?? null,
          produto_ano: x.productYear != null ? String(x.productYear) : null,
          produto_foto: x.productPhoto ?? null,
          produto_url: x.productUrl ?? null,
          status: x.status ?? null,
          tipo_negociacao: x.negociationType ?? null,
          condicao: x.condition ?? null,
          qualificado: x.isQualify ?? null,
          cnpj: x.cnpj ?? null,
          empresa: x.companyName ?? null,
          data_lead: x.createdAt ?? null,
          atualizado_em: x.updatedAt ?? null,
          dados_json: x,
        }));

        const { error } = await supabase
          .from("leads_popagro")
          .upsert(rows, { onConflict: "popagro_id" });
        if (error) throw new Error(`Upsert: ${error.message}`);
        totalImportado += rows.length;
      }

      paginasProcessadas++;
      page++;
      if (page >= totalPages) break;
    }

    return new Response(
      JSON.stringify({
        total_importado: totalImportado,
        paginas_processadas: paginasProcessadas,
        total_popagro: totalElements,
        mensagem: `Sincronização concluída: ${totalImportado} leads importados em ${paginasProcessadas} páginas.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("sync-popagro-leads error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

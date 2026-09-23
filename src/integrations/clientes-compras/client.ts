// Cliente Supabase ISOLADO para a base externa DealerNet.
// Usar apenas para a view `leads_unificados` (junta clientes_compras + vendas_veiculos).
import { createClient } from "@supabase/supabase-js";

const URL = "https://mjrpkphxakoeddkeskqy.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_6YVA2-CzCzUvxXeF94IRPA_N7Lpx07w";

export const clientesComprasSupabase = createClient(URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type LeadOrigem = "COMPRA_PECA" | "VENDA_VEICULO";

export interface LeadUnificado {
  origem: LeadOrigem;
  codigo_cliente: number | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  interesse: string | null;
  data_registro: string | null;
  empresa: string | null;
  valor: string | null;
  quantidade: number | null;
  atualizado_em: string | null;
}

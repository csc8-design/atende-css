// Department welcome scripts - sent as the first agent message after assignment.

const SCRIPTS: Record<string, (greeting: string, salutation: string) => string> = {
  comercial: (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com o setor Comercial da ENGWE Brasil.\n\nComo posso auxiliá-lo(a) em relação a propostas, equipamentos ou condições comerciais?`,
  financeiro: (g, s) =>
    `${s}, ${g}.\n\nAqui é do setor Financeiro da ENGWE Brasil.\n\nEm que podemos ajudar quanto a pagamentos, boletos, faturamento ou negociações?`,
  "pos-vendas": (g, s) =>
    `${s}, ${g}.\n\nVocê está falando com o setor de Pós-Vendas da ENGWE Brasil.\n\nComo podemos auxiliá-lo(a) em relação a suporte, garantias ou acompanhamento de serviços?`,
  "pecas-balcao": (g, s) =>
    `${s}, ${g}.\n\nAqui é do setor de Peças Balcão da ENGWE Brasil.\n\nPoderia informar a peça ou equipamento desejado para que possamos verificar disponibilidade e valores?`,
  "loja-online": (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com a equipe da Loja Online da ENGWE Brasil.\n\nComo podemos auxiliá-lo(a) em sua compra pelo site ou em relação a produtos disponíveis?`,
  importacao: (g, s) =>
    `${s}, ${g}.\n\nAqui é do setor de Importação da ENGWE Brasil.\n\nEm que podemos auxiliá-lo(a) quanto a processos, prazos ou demandas de importação?`,
  seguros: (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com o setor de Seguros da ENGWE Brasil.\n\nComo podemos ajudá-lo(a) em relação a cotações, apólices ou sinistros?`,
  consorcios: (g, s) =>
    `${s}, ${g}.\n\nAqui é do setor de Consórcios da ENGWE Brasil.\n\nEm que podemos auxiliá-lo(a) quanto a planos, adesões ou contemplações?`,
  "consultoria-especializada": (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com a área de Consultoria Especializada da ENGWE Brasil.\n\nPoderia nos informar sua demanda para que possamos direcionar a melhor solução técnica?`,
  governo: (g, s) =>
    `${s}, ${g}.\n\nAqui é do setor de Atendimento ao Governo da ENGWE Brasil.\n\nComo podemos auxiliá-lo(a) em relação a processos, licitações ou demandas institucionais?`,
  telemetria: (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com o setor de Telemetria da ENGWE Brasil.\n\nComo podemos auxiliá-lo(a) quanto a monitoramento, dados operacionais ou suporte técnico?`,
  "compras-fornecedores": (g, s) =>
    `${s}, ${g}.\n\nVocê está em contato com o setor de Compras (Fornecedores) da ENGWE Brasil.\n\nComo podemos auxiliá-lo(a) em relação a propostas, cotações ou cadastro de fornecedores?`,
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const greetingForNow = (d = new Date()) => {
  const h = d.getHours();
  if (h < 12) return "bom dia";
  if (h < 18) return "boa tarde";
  return "boa noite";
};

const GENERIC_NAME_RE = /^(contato|cliente|usuario|usuário|whatsapp|sem nome|desconhecido)/i;

const isGenericName = (name?: string | null, phone?: string | null) => {
  if (!name) return true;
  const n = name.trim();
  if (!n) return true;
  if (phone && n.replace(/\D/g, "") === phone.replace(/\D/g, "")) return true;
  if (GENERIC_NAME_RE.test(n)) return true;
  // pure digits / phone-like
  if (/^\+?\d[\d\s().-]{5,}$/.test(n)) return true;
  return false;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0];

export const buildDepartmentScript = (
  departmentName: string | null | undefined,
  contactName: string | null | undefined,
  contactPhone: string | null | undefined,
): string | null => {
  if (!departmentName) return null;
  const key = slugify(departmentName);
  // try a few aliases
  const aliases: Record<string, string> = {
    "pecas": "pecas-balcao",
    "peca-balcao": "pecas-balcao",
    "pos-venda": "pos-vendas",
    "consorcio": "consorcios",
    "seguro": "seguros",
    "importacoes": "importacao",
  };
  const builder = SCRIPTS[key] || SCRIPTS[aliases[key] || ""];
  if (!builder) return null;

  const greeting = greetingForNow();
  const salutation = isGenericName(contactName, contactPhone)
    ? "Prezado(a)"
    : `Prezado(a) ${firstName(contactName!)}`;

  return builder(greeting, salutation);
};

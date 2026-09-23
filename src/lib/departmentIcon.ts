import {
  Building2,
  Wrench,
  DollarSign,
  Headphones,
  ShoppingCart,
  Truck,
  Users,
  Megaphone,
  Briefcase,
  Package,
  LifeBuoy,
  Settings,
  Heart,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

/**
 * Returns a Lucide icon coerente com o nome do departamento.
 * Faz match por palavras-chave (case/acentos-insensível).
 */
export function getDepartmentIcon(name?: string | null): LucideIcon {
  if (!name) return Building2;
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(financ|cobran|pagam|fatur|contas)/.test(n)) return DollarSign;
  if (/(pos.?venda|suporte|atendimento|sac|ajuda)/.test(n)) return Headphones;
  if (/(comercial|pecas|peca|vendas?\b)/.test(n) && !/online/.test(n)) return Wrench;
  if (/(vendas? online|ecommerce|e-commerce|loja|online)/.test(n)) return ShoppingCart;
  if (/(logistic|entrega|transport|frete)/.test(n)) return Truck;
  if (/(rh|recursos humanos|pessoas)/.test(n)) return Users;
  if (/(marketing|midia|divulg)/.test(n)) return Megaphone;
  if (/(diretoria|gestao|gerenc|administra)/.test(n)) return Briefcase;
  if (/(estoque|produto|almox)/.test(n)) return Package;
  if (/(garantia|assistencia)/.test(n)) return LifeBuoy;
  if (/(ti|tecnologia|sistema|tecnico)/.test(n)) return Settings;
  if (/(saude|clinic|medic)/.test(n)) return Heart;
  if (/(treinamento|escola|educac)/.test(n)) return GraduationCap;

  return Building2;
}

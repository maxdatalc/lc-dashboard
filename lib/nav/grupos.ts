import type React from "react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  ClipboardList,
  FileText,
  Home,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Scale,
  SendHorizonal,
  ShoppingCart,
  Users,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NavLeaf = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  featureKey?: string;
  /**
   * Presença define quais folhas disputam os 4 slots da bottom nav mobile
   * (menor = mais prioritário). Folhas sem prioridade vivem só no drawer "Mais".
   */
  mobilePriority?: number;
  /** Label curto para a bottom nav (caber em ~52px); default = label. */
  mobileLabel?: string;
};

export type NavSection = {
  key: string;
  label: string;
  icon: React.ElementType;
  items: NavLeaf[];
};

export type NavCategory = {
  key: string;
  label: string;
  icon: React.ElementType;
  sections: NavSection[];
};

export type NavGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  featureKey?: string;
  items?: NavLeaf[];
  categories?: NavCategory[];
};

// ─── Estrutura de navegação (fonte única: desktop rail + bottom nav + "Mais") ─

export const GRUPOS: NavGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/home",                 label: "Visão Geral", icon: Home,         exact: true, featureKey: "dashboard_visao_geral", mobilePriority: 1, mobileLabel: "Início" },
      { href: "/dashboard",            label: "Vendas",     icon: ShoppingCart, exact: true, featureKey: "modulo_vendas",     mobilePriority: 2 },
      { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark,     featureKey: "modulo_financeiro", mobilePriority: 3 },
      { href: "/dashboard/produtos",   label: "Produtos",   icon: Package,      featureKey: "modulo_produtos",   mobilePriority: 5 },
      { href: "/dashboard/clientes",   label: "Clientes",   icon: Users,        featureKey: "modulo_clientes",   mobilePriority: 6 },
    ],
  },
  {
    key: "movimentacao",
    label: "Movimentação",
    icon: ArrowLeftRight,
    items: [
      { href: "/os", label: "Ordens de Serviço", icon: ClipboardList, featureKey: "modulo_os", mobilePriority: 4, mobileLabel: "OS" },
    ],
  },
  {
    key: "fiscal",
    label: "Fiscal",
    icon: Scale,
    featureKey: "modulo_fiscal",
    items: [
      { href: "/fiscal/transmissao-xmls", label: "Transmissão de XMLs", icon: SendHorizonal, featureKey: "modulo_fiscal" },
    ],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    icon: FileText,
    featureKey: "modulo_relatorios",
    categories: [
      {
        key: "vendas",
        label: "Vendas",
        icon: ShoppingCart,
        sections: [
          {
            key: "comissoes",
            label: "Comissões",
            icon: BadgeDollarSign,
            items: [
              { href: "/relatorios/comissao-recebimento", label: "Comissão por Recebimento", icon: Receipt },
            ],
          },
        ],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Todas as folhas da árvore, na ordem em que aparecem. */
export function flattenLeaves(grupos: NavGroup[] = GRUPOS): NavLeaf[] {
  const leaves: NavLeaf[] = [];
  for (const g of grupos) {
    if (g.items) leaves.push(...g.items);
    g.categories?.forEach((cat) =>
      cat.sections.forEach((sec) => leaves.push(...sec.items)),
    );
  }
  return leaves;
}

/**
 * Folhas da bottom nav mobile: visíveis pela feature, com mobilePriority,
 * ordenadas, limitadas a `slots`. O restante da árvore fica no drawer "Mais".
 */
export function mobilePrimaryLeaves(
  hasFeature: (key: string) => boolean,
  isAdmin: boolean,
  slots = 4,
): NavLeaf[] {
  return flattenLeaves()
    .filter((l) => l.mobilePriority !== undefined)
    .filter((l) => isAdmin || !l.featureKey || hasFeature(l.featureKey))
    .sort((a, b) => a.mobilePriority! - b.mobilePriority!)
    .slice(0, slots);
}

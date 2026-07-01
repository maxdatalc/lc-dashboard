// Catálogo central de funcionalidades do produto LC Dashboard
// Fonte única de verdade para features core e premium

export type Feature = {
  key: string;
  label: string;
  descricao: string;
  categoria: "core" | "premium";
  icone: string; // nome do ícone lucide-react
  disponivel: boolean; // false = em desenvolvimento
};

export const FEATURES_CATALOG: Feature[] = [
  // ── Core — incluída no plano free ────────────────────────────────────────
  {
    key: "dashboard_visao_geral",
    label: "Dashboard Visão Geral",
    descricao: "KPIs, gráficos e indicadores gerenciais",
    categoria: "core",
    icone: "LayoutDashboard",
    disponivel: true,
  },

  // ── Premium — módulos pagos ───────────────────────────────────────────────
  {
    key: "modulo_fiscal",
    label: "Fiscal — Transmissão de XMLs",
    descricao: "Envio automático de NF-e e NFC-e para a plataforma SIEG, eliminando o trabalho manual de exportação para o contador",
    categoria: "premium",
    icone: "Scale",
    disponivel: true,
  },
  {
    key: "modulo_os",
    label: "Ordens de Serviço",
    descricao: "Gestão de OS com controle fiscal de estoque integrado ao MaxManager",
    categoria: "premium",
    icone: "ClipboardList",
    disponivel: true,
  },
  {
    key: "modulo_financeiro",
    label: "Financeiro",
    descricao: "Contas a receber, inadimplência e fluxo de caixa",
    categoria: "premium",
    icone: "Landmark",
    disponivel: true,
  },
  {
    key: "modulo_produtos",
    label: "Produtos & Estoque",
    descricao: "Catálogo, níveis de estoque e alertas de ruptura",
    categoria: "premium",
    icone: "Package",
    disponivel: true,
  },
  {
    key: "modulo_relatorios",
    label: "Relatórios",
    descricao: "Relatórios gerenciais de comissões por forma de pagamento",
    categoria: "premium",
    icone: "FileText",
    disponivel: true,
  },
  {
    key: "modulo_vendas",
    label: "Vendas",
    descricao: "Histórico, análise e drill-down de vendas",
    categoria: "premium",
    icone: "ShoppingCart",
    disponivel: true,
  },
  {
    key: "modulo_clientes",
    label: "Clientes",
    descricao: "Perfil 360º e histórico por cliente",
    categoria: "premium",
    icone: "Users",
    disponivel: true,
  },
  {
    key: "consolidado_multilojas",
    label: "Consolidado Multi-lojas",
    descricao: "Visão unificada de todas as filiais em uma tela",
    categoria: "premium",
    icone: "Building2",
    disponivel: false,
  },
  {
    key: "cobrador_whatsapp",
    label: "Cobrador WhatsApp",
    descricao: "Cobrança automatizada de inadimplentes via WhatsApp",
    categoria: "premium",
    icone: "MessageCircle",
    disponivel: false,
  },
  {
    key: "alertas_inteligentes",
    label: "Alertas Inteligentes",
    descricao: "Notificações de estoque crítico, vencimentos e anomalias",
    categoria: "premium",
    icone: "Bell",
    disponivel: false,
  },
  {
    key: "relatorios_ia",
    label: "Relatórios com IA",
    descricao: "Insights e análises narrativas geradas por inteligência artificial",
    categoria: "premium",
    icone: "Sparkles",
    disponivel: false,
  },
  {
    key: "reativacao_clientes",
    label: "Reativação de Clientes",
    descricao: "Campanhas automáticas para clientes sem compras recentes",
    categoria: "premium",
    icone: "UserCheck",
    disponivel: false,
  },
  {
    key: "sugestao_compra",
    label: "Sugestão de Compra",
    descricao: "IA sugere reposição de estoque baseada no histórico",
    categoria: "premium",
    icone: "TrendingUp",
    disponivel: false,
  },
  {
    key: "pix_inteligente",
    label: "PIX Inteligente",
    descricao: "Geração automática e controle de cobranças PIX",
    categoria: "premium",
    icone: "Zap",
    disponivel: false,
  },
  {
    key: "bi_avancado",
    label: "BI Avançado",
    descricao: "Dashboards personalizados com drill-down ilimitado",
    categoria: "premium",
    icone: "BarChart3",
    disponivel: false,
  },
];

/** Verifica se uma lista de features contém a feature solicitada */
export function hasFeature(features: string[], featureKey: string): boolean {
  return features.includes(featureKey);
}

/** Retorna os keys de features sempre incluídas (independente de plano) */
export function getCoreFeatures(): string[] {
  return [
    "dashboard_visao_geral",
    "modulo_vendas",
    "modulo_financeiro",
    "modulo_produtos",
  ];
}

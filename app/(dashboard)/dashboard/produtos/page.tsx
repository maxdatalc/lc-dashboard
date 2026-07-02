import { ProdutosDashboard } from "@/components/produtos/ProdutosDashboard";

// Dashboard de Produtos & Estoque — "Estoque & Capital de Giro".
// Dados reais do MaxManager via SQL bridge (lib/db/produtos-estoque.ts +
// app/api/dashboard/produtos/overview). Toda a interatividade (cross-filtering,
// multilojas, tabela acionável) vive no client component abaixo.

export default function ProdutosPage() {
  return <ProdutosDashboard />;
}

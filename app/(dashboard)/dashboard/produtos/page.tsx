// Módulo Produtos & Estoque — Server Component puro
// Exibe catálogo com indicadores de ruptura, estoque crítico e normal

import Link from "next/link";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Search,
  DollarSign,
} from "lucide-react";
import { getSelectedLojaId } from "@/app/actions/lojas";
import {
  getResumoProdutos,
  getProdutos,
  type ResumoProdutos,
  type ProdutoItem,
  type FiltroProduto,
} from "@/lib/db/produtos";
import { SyncButton } from "@/components/dashboard/sync-button";
import { SyncButtonProdutos } from "@/components/dashboard/sync-button-produtos";

// ── Helpers de formatação ──────────────────────────────────────────────────

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

// ── Componente ─────────────────────────────────────────────────────────────

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; busca?: string }>;
}) {
  const params = await searchParams;
  const filtro = (["todos", "ruptura", "critico", "normal"].includes(params.filtro ?? "")
    ? params.filtro
    : "ruptura") as FiltroProduto;
  const busca = params.busca || undefined;

  const lojaId = await getSelectedLojaId();

  // Sem loja selecionada — orientar o usuário
  if (!lojaId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Produtos & Estoque</h1>
        <div className="rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 text-sm">
            Selecione uma loja na barra lateral para ver os dados.
          </p>
        </div>
      </div>
    );
  }

  // Buscar resumo e lista em paralelo
  const [resumo, produtos] = await Promise.all([
    getResumoProdutos(lojaId),
    getProdutos(lojaId, filtro, busca),
  ]);

  const FILTROS: { valor: FiltroProduto; label: string; count: number }[] = [
    { valor: "ruptura", label: "Ruptura", count: resumo.totalRuptura },
    { valor: "critico", label: "Crítico", count: resumo.totalCritico },
    { valor: "normal", label: "Normal", count: resumo.totalNormal },
    { valor: "todos", label: "Todos", count: resumo.totalAtivos },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos & Estoque</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de catálogo e níveis de estoque</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButtonProdutos />
          <SyncButton />
        </div>
      </div>

      {/* Grid de 4 KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Card 1 — Ruptura */}
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700">Em Ruptura</span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{resumo.totalRuptura}</p>
          <p className="text-xs text-red-500 mt-0.5">Estoque zerado ou negativo</p>
        </div>

        {/* Card 2 — Crítico */}
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-700">Estoque Crítico</span>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{resumo.totalCritico}</p>
          <p className="text-xs text-amber-500 mt-0.5">Abaixo do mínimo configurado</p>
        </div>

        {/* Card 3 — Normal */}
        <div className="rounded-xl border-l-4 border-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <span className="text-sm font-medium text-green-700">Estoque Normal</span>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{resumo.totalNormal}</p>
          <p className="text-xs text-green-500 mt-0.5">{resumo.totalAtivos} produtos ativos</p>
        </div>

        {/* Card 4 — Valor em Estoque */}
        <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-blue-700">Valor em Estoque</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatarMoeda(resumo.valorTotalEstoque)}
          </p>
          <p className="text-xs text-blue-500 mt-0.5">{resumo.gruposUnicos} grupos de produto</p>
        </div>
      </div>

      {/* Nota sobre atualização parcial */}
      <p className="text-xs text-slate-400 -mt-2">
        Atualiza os primeiros 1.500 produtos. Para catálogo completo, use Sincronização Inicial no menu admin.
      </p>

      {/* Filtros + Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">

        {/* Filtros de situação de estoque */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={`/dashboard/produtos?filtro=${f.valor}${busca ? `&busca=${encodeURIComponent(busca)}` : ""}`}
              className={
                filtro === f.valor
                  ? "inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                  : "inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {f.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  filtro === f.valor
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Busca por nome */}
        <form method="GET" action="/dashboard/produtos">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              name="busca"
              defaultValue={busca ?? ""}
              placeholder="Buscar produto..."
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 w-52"
            />
          </div>
        </form>
      </div>

      {/* Tabela de produtos */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        {produtos.length === 0 ? (
          // Estado vazio
          <div className="py-16 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">
              Nenhum produto{" "}
              {filtro === "ruptura"
                ? "em ruptura"
                : filtro === "critico"
                ? "em estoque crítico"
                : "encontrado"}
            </p>
            {busca && (
              <p className="text-sm text-slate-400 mt-1">para a busca &ldquo;{busca}&rdquo;</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Produto", "Grupo", "Fabricante", "Estoque", "Mínimo", "Indicador", "Preço", "Status"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtos.map((produto) => {
                // Cor do estoque conforme situação
                const corEstoque =
                  produto.estoqueAtual < 0
                    ? "text-red-600"
                    : produto.estoqueAtual === 0
                    ? "text-red-500"
                    : produto.estoqueMinimo > 0 && produto.estoqueAtual <= produto.estoqueMinimo
                    ? "text-amber-600"
                    : "text-green-700";

                // Barra de progresso do indicador
                const pct =
                  produto.estoqueMinimo > 0
                    ? Math.min(100, Math.max(0, (produto.estoqueAtual / produto.estoqueMinimo) * 100))
                    : 0;
                const corBarra =
                  produto.estoqueAtual <= 0
                    ? "bg-red-500"
                    : produto.estoqueAtual <= produto.estoqueMinimo
                    ? "bg-amber-500"
                    : "bg-green-500";

                return (
                  <tr key={produto.id} className="hover:bg-slate-50 transition-colors">

                    {/* Produto */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">
                        {produto.nome.length > 35
                          ? produto.nome.slice(0, 35) + "..."
                          : produto.nome}
                      </div>
                      {produto.codigo && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Cód: {produto.codigo}
                        </div>
                      )}
                    </td>

                    {/* Grupo */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {produto.grupoNome ?? "—"}
                      </span>
                    </td>

                    {/* Fabricante */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {produto.fabricante ?? "—"}
                      </span>
                    </td>

                    {/* Estoque */}
                    <td className="px-4 py-3">
                      <span className={`font-mono font-semibold text-sm ${corEstoque}`}>
                        {produto.estoqueAtual.toFixed(0)}
                      </span>
                    </td>

                    {/* Mínimo */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {produto.estoqueMinimo > 0 ? produto.estoqueMinimo.toFixed(0) : "—"}
                      </span>
                    </td>

                    {/* Indicador de progresso */}
                    <td className="px-4 py-3 w-24">
                      {produto.estoqueMinimo > 0 ? (
                        <div>
                          <div className="relative h-2 w-20 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all ${corBarra}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {Math.round(pct)}% do mínimo
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">Sem mínimo</span>
                      )}
                    </td>

                    {/* Preço de venda */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {produto.precoVenda ? formatarMoeda(produto.precoVenda) : "—"}
                      </span>
                    </td>

                    {/* Badge de status */}
                    <td className="px-4 py-3">
                      {produto.statusEstoque === "ruptura" && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          Ruptura
                        </span>
                      )}
                      {produto.statusEstoque === "critico" && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Crítico
                        </span>
                      )}
                      {produto.statusEstoque === "normal" && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rodapé */}
      <p className="text-xs text-slate-400 text-center mt-2">
        Exibindo até 200 produtos · Sincronizado do MaxManager
      </p>
    </div>
  );
}

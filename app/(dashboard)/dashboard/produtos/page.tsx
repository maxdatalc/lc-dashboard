import Link from "next/link";
import { Package, AlertTriangle, TrendingDown, CheckCircle2, Search, DollarSign } from "lucide-react";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getResumoProdutos, getProdutos, type FiltroProduto } from "@/lib/db/produtos";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

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

  if (!lojaId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div
          className="rounded-2xl p-10 text-center max-w-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Selecione uma loja na barra lateral para ver os dados.
          </p>
        </div>
      </div>
    );
  }

  const [resumo, produtos] = await Promise.all([
    getResumoProdutos(lojaId),
    getProdutos(lojaId, filtro, busca),
  ]);

  const FILTROS: { valor: FiltroProduto; label: string; count: number }[] = [
    { valor: "ruptura", label: "Ruptura",  count: resumo.totalRuptura },
    { valor: "critico", label: "Crítico",  count: resumo.totalCritico },
    { valor: "normal",  label: "Normal",   count: resumo.totalNormal  },
    { valor: "todos",   label: "Todos",    count: resumo.totalAtivos  },
  ];

  return (
    <div className="px-3 py-4 sm:px-4 md:p-6 space-y-5">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Produtos &amp; Estoque
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Gestão de catálogo e níveis de estoque
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #ef4444" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-xs font-medium text-red-400">Em Ruptura</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{resumo.totalRuptura}</p>
          <p className="text-xs text-red-400/70 mt-0.5">Estoque zerado ou negativo</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-400">Estoque Crítico</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{resumo.totalCritico}</p>
          <p className="text-xs text-amber-400/70 mt-0.5">Abaixo do mínimo</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #22c55e" }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <span className="text-xs font-medium text-green-400">Estoque Normal</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{resumo.totalNormal}</p>
          <p className="text-xs text-green-400/70 mt-0.5">{resumo.totalAtivos} produtos ativos</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #3b82f6" }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-xs font-medium text-blue-400">Valor em Estoque</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatarMoeda(resumo.valorTotalEstoque)}</p>
          <p className="text-xs text-blue-400/70 mt-0.5">{resumo.gruposUnicos} grupos</p>
        </div>
      </div>

      {/* Filtros + Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={`/dashboard/produtos?filtro=${f.valor}${busca ? `&busca=${encodeURIComponent(busca)}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                filtro === f.valor
                  ? { backgroundColor: "var(--accent-cyan)", color: "#0d1117" }
                  : { border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "transparent" }
              }
            >
              {f.label}
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-xs"
                style={
                  filtro === f.valor
                    ? { backgroundColor: "rgba(0,0,0,0.15)", color: "#0d1117" }
                    : { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }
                }
              >
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        <form method="GET" action="/dashboard/produtos">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              name="busca"
              defaultValue={busca ?? ""}
              placeholder="Buscar produto..."
              className="pl-8 pr-3 py-1.5 rounded-md text-sm w-52 focus:outline-none"
              style={{
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </form>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border-subtle)" }}>
        {produtos.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              Nenhum produto {filtro === "ruptura" ? "em ruptura" : filtro === "critico" ? "em estoque crítico" : "encontrado"}
            </p>
            {busca && <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>para a busca &ldquo;{busca}&rdquo;</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                {["Produto", "Grupo", "Fabricante", "Estoque", "Mínimo", "Indicador", "Preço", "Status"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto) => {
                const corEstoque =
                  produto.estoqueAtual < 0 ? "text-red-400"
                  : produto.estoqueAtual === 0 ? "text-red-400"
                  : produto.estoqueMinimo > 0 && produto.estoqueAtual <= produto.estoqueMinimo ? "text-amber-400"
                  : "text-green-400";

                const pct = produto.estoqueMinimo > 0
                  ? Math.min(100, Math.max(0, (produto.estoqueAtual / produto.estoqueMinimo) * 100))
                  : 0;
                const corBarra =
                  produto.estoqueAtual <= 0 ? "bg-red-500"
                  : produto.estoqueAtual <= produto.estoqueMinimo ? "bg-amber-500"
                  : "bg-green-500";

                return (
                  <tr key={produto.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {produto.nome.length > 35 ? produto.nome.slice(0, 35) + "..." : produto.nome}
                      </div>
                      {produto.codigo && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Cód: {produto.codigo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                        {produto.grupoNome ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {produto.fabricante ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-semibold text-sm ${corEstoque}`}>
                        {produto.estoqueAtual.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {produto.estoqueMinimo > 0 ? produto.estoqueMinimo.toFixed(0) : "—"}
                    </td>
                    <td className="px-4 py-3 w-24">
                      {produto.estoqueMinimo > 0 ? (
                        <div>
                          <div className="relative h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                            <div className={`absolute inset-y-0 left-0 rounded-full ${corBarra}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{Math.round(pct)}%</div>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {produto.precoVenda ? formatarMoeda(produto.precoVenda) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {produto.statusEstoque === "ruptura" && (
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">Ruptura</span>
                      )}
                      {produto.statusEstoque === "critico" && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">Crítico</span>
                      )}
                      {produto.statusEstoque === "normal" && (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Exibindo até 200 produtos
      </p>
    </div>
  );
}

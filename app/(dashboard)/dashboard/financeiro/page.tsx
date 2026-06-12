import { AlertCircle, Clock, CalendarClock, Wallet, CheckCircle } from "lucide-react";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getResumoFinanceiro, getClientesInadimplentes } from "@/lib/db/financeiro";
import Link from "next/link";

type Filtro = "vencido" | "a_vencer" | "todos";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function formatarData(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro = (["vencido", "a_vencer", "todos"].includes(params.filtro ?? "")
    ? params.filtro
    : "vencido") as Filtro;

  const lojaId = await getSelectedLojaId();

  if (!lojaId) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh] p-6"
      >
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

  const [resumo, clientes] = await Promise.all([
    getResumoFinanceiro(lojaId),
    getClientesInadimplentes(lojaId, filtro),
  ]);

  const FILTROS: { valor: Filtro; label: string; count: number }[] = [
    { valor: "vencido", label: "Vencidos", count: resumo.qtdInadimplentes },
    { valor: "a_vencer", label: "A Vencer", count: resumo.qtdAVencer30 },
    { valor: "todos", label: "Todos", count: resumo.qtdInadimplentes + resumo.qtdAVencer30 },
  ];

  return (
    <div className="px-3 py-4 sm:px-4 md:p-6 space-y-5">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Financeiro
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Contas a receber e inadimplência
        </p>
      </div>

      {/* Grid de KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border-l-4 border-red-500 p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #ef4444" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-xs font-medium text-red-400">Total Vencido</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatarMoeda(resumo.totalVencido)}</p>
          <p className="text-xs text-red-400/70 mt-0.5">{resumo.qtdInadimplentes} clientes inadimplentes</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-400">Vence em 7 dias</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{formatarMoeda(resumo.totalAVencer7)}</p>
          <p className="text-xs text-amber-400/70 mt-0.5">Cobranças urgentes</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid #3b82f6" }}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-xs font-medium text-blue-400">Vence em 30 dias</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatarMoeda(resumo.totalAVencer30)}</p>
          <p className="text-xs text-blue-400/70 mt-0.5">{resumo.qtdAVencer30} clientes a vencer</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Total Pendente</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {formatarMoeda(resumo.totalGeral)}
          </p>
          {resumo.clientesSemDocumento > 0 ? (
            <p className="text-xs text-amber-400 mt-0.5">⚠ {resumo.clientesSemDocumento} sem CPF/CNPJ</p>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Todos os registros</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/dashboard/financeiro?filtro=${f.valor}`}
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
                  : { backgroundColor: "var(--bg-secondary, rgba(255,255,255,0.05))", color: "var(--text-muted)" }
              }
            >
              {f.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border-subtle)" }}>
        {clientes.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              Nenhuma conta {filtro === "vencido" ? "vencida" : filtro === "a_vencer" ? "a vencer" : "pendente"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Carteira em dia</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-secondary, rgba(255,255,255,0.03))" }}>
                {["Cliente", "CPF/CNPJ", "Boletos", "Valor Total", "Mais Antigo", "Situação"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.cnpj} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                    {cliente.nome.length > 28 ? cliente.nome.slice(0, 28) + "..." : cliente.nome}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatarDocumento(cliente.cnpj)}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {cliente.quantidadeBoletos} {cliente.quantidadeBoletos === 1 ? "boleto" : "boletos"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${cliente.diasMaiorAtraso > 0 ? "text-red-400" : "text-blue-400"}`}>
                      {formatarMoeda(cliente.totalDevido)}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {formatarData(cliente.boletoMaisAntigo)}
                  </td>
                  <td className="px-4 py-3">
                    {cliente.diasMaiorAtraso > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        {cliente.diasMaiorAtraso}d em atraso
                      </span>
                    ) : Math.abs(cliente.diasMaiorAtraso) <= 7 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        Vence em {Math.abs(cliente.diasMaiorAtraso)}d
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                        Vence em {Math.abs(cliente.diasMaiorAtraso)}d
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Clientes sem CPF/CNPJ no ERP não aparecem nesta lista.
      </p>
    </div>
  );
}

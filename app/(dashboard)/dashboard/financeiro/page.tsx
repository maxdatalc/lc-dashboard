import { getSelectedLojaId } from "@/app/actions/lojas";
import { getResumoFinanceiro, getClientesInadimplentes } from "@/lib/db/financeiro";
import { TabelaFinanceiro } from "@/components/financeiro/tabela-financeiro";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Financeiro — LC Dashboard" };

type Filtro = "vencido" | "a_vencer" | "todos";

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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Financeiro</h1>
        <p className="text-slate-500 text-sm">
          Selecione uma loja na barra lateral para ver os dados.
        </p>
      </div>
    );
  }

  const [resumo, clientes, todosClientes, aVencerClientes] = await Promise.all([
    getResumoFinanceiro(lojaId),
    getClientesInadimplentes(lojaId, filtro),
    getClientesInadimplentes(lojaId, "todos"),
    getClientesInadimplentes(lojaId, "a_vencer"),
  ]);

  const vencidosCount = todosClientes.filter((c) => c.diasMaiorAtraso > 0).length;
  const aVencerCount = aVencerClientes.length;
  const todosCount = todosClientes.length;

  const filtros: { valor: Filtro; label: string; count: number }[] = [
    { valor: "vencido", label: "Vencidos", count: vencidosCount },
    { valor: "a_vencer", label: "A vencer", count: aVencerCount },
    { valor: "todos", label: "Todos", count: todosCount },
  ];

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-slate-500 text-sm mt-1">Contas a receber e inadimplência</p>
      </div>

      <TabelaFinanceiro
        resumo={resumo}
        clientes={clientes}
        filtro={filtro}
        filtros={filtros}
      />
    </div>
  );
}

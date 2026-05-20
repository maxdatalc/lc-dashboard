// Módulo Financeiro — Server Component puro
// Exibe contas a receber agrupadas por cliente com filtros de situação

import Link from "next/link";
import { AlertCircle, Clock, CalendarClock, Wallet, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { getSelectedLojaId } from "@/app/actions/lojas";
import {
  getResumoFinanceiro,
  getClientesInadimplentes,
  type ResumoFinanceiro,
  type ClienteInadimplente,
} from "@/lib/db/financeiro";

type Filtro = "vencido" | "a_vencer" | "todos";

// ── Helpers de formatação ──────────────────────────────────────────────────

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

// ── Componente ─────────────────────────────────────────────────────────────

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

  // Sem loja selecionada — orientar o usuário
  if (!lojaId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Financeiro</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500 text-sm text-center py-8">
              Selecione uma loja na barra lateral para ver os dados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Buscar resumo e clientes em paralelo
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
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-500 text-sm mt-1">Contas a receber e inadimplência</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Sincronizado da API MaxData · Atualiza automaticamente
          </p>
        </div>
        <SyncButton key={lojaId ?? "sem-loja"} />
      </div>

      {/* Grid de 4 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Card 1 — Total Vencido */}
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700">Total Vencido</span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatarMoeda(resumo.totalVencido)}
          </p>
          <p className="text-xs text-red-500 mt-0.5">
            {resumo.qtdInadimplentes} clientes inadimplentes
          </p>
        </div>

        {/* Card 2 — Vence em 7 dias */}
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-700">Vence em 7 dias</span>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {formatarMoeda(resumo.totalAVencer7)}
          </p>
          <p className="text-xs text-amber-500 mt-0.5">Cobranças urgentes</p>
        </div>

        {/* Card 3 — Vence em 30 dias */}
        <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-blue-700">Vence em 30 dias</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatarMoeda(resumo.totalAVencer30)}
          </p>
          <p className="text-xs text-blue-500 mt-0.5">
            {resumo.qtdAVencer30} clientes a vencer
          </p>
        </div>

        {/* Card 4 — Total Pendente */}
        <div className="rounded-xl border-l-4 border-slate-400 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-slate-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700">Total Pendente</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {formatarMoeda(resumo.totalGeral)}
          </p>
          {resumo.clientesSemDocumento > 0 ? (
            <p className="text-xs text-amber-600 mt-0.5">
              ⚠ {resumo.clientesSemDocumento} clientes sem CPF/CNPJ
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Todos os registros</p>
          )}
        </div>
      </div>

      {/* Filtros de situação */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/dashboard/financeiro?filtro=${f.valor}`}
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

      {/* Tabela de clientes */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        {clientes.length === 0 ? (
          // Estado vazio
          <div className="py-16 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="font-medium text-slate-700">
              Nenhuma conta{" "}
              {filtro === "vencido"
                ? "vencida"
                : filtro === "a_vencer"
                ? "a vencer"
                : "pendente"}
            </p>
            <p className="text-sm text-slate-400 mt-1">Carteira em dia 🎉</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Cliente", "CPF/CNPJ", "Boletos", "Valor Total", "Mais Antigo", "Situação"].map(
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
              {clientes.map((cliente) => (
                <tr
                  key={cliente.cnpj}
                  className="hover:bg-slate-50 transition-colors"
                >
                  {/* Nome */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">
                      {cliente.nome.length > 28
                        ? cliente.nome.slice(0, 28) + "..."
                        : cliente.nome}
                    </span>
                  </td>

                  {/* CPF/CNPJ */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">
                      {formatarDocumento(cliente.cnpj)}
                    </span>
                  </td>

                  {/* Boletos */}
                  <td className="px-4 py-3">
                    <span className="text-slate-600">
                      {cliente.quantidadeBoletos}{" "}
                      {cliente.quantidadeBoletos === 1 ? "boleto" : "boletos"}
                    </span>
                  </td>

                  {/* Valor Total */}
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        filtro === "vencido" || cliente.diasMaiorAtraso > 0
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {formatarMoeda(cliente.totalDevido)}
                    </span>
                  </td>

                  {/* Boleto mais antigo */}
                  <td className="px-4 py-3">
                    <span className="text-slate-600">
                      {formatarData(cliente.boletoMaisAntigo)}
                    </span>
                  </td>

                  {/* Badge de situação */}
                  <td className="px-4 py-3">
                    {cliente.diasMaiorAtraso > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        {cliente.diasMaiorAtraso} dias em atraso
                      </span>
                    ) : Math.abs(cliente.diasMaiorAtraso) <= 7 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Vence em {Math.abs(cliente.diasMaiorAtraso)} dias
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        Vence em {Math.abs(cliente.diasMaiorAtraso)} dias
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rodapé informativo */}
      <p className="text-xs text-slate-400 text-center mt-2">
        Clientes sem CPF/CNPJ no ERP não aparecem nesta lista.
        Atualize o cadastro no MaxManager para cobertura completa.
      </p>
    </div>
  );
}

"use client";

// Componente de exibição do módulo financeiro com animações framer-motion
// Recebe dados já buscados pelo Server Component (financeiro/page.tsx)

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Clock, Wallet, CheckCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResumoFinanceiro, ClienteInadimplente } from "@/lib/db/financeiro";

type Filtro = "vencido" | "a_vencer" | "todos";

interface Props {
  resumo: ResumoFinanceiro;
  clientes: ClienteInadimplente[];
  filtro: Filtro;
  filtros: { valor: Filtro; label: string; count: number }[];
}

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

export function TabelaFinanceiro({
  resumo,
  clientes,
  filtro,
  filtros,
}: Props) {
  return (
    <>
      {/* Grid de KPI cards com entrada escalonada */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1 — Total Vencido */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
        >
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-medium text-red-700">Total Vencido</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatarMoeda(resumo.totalVencido)}
            </p>
            <p className="text-xs text-red-400 mt-1">
              {resumo.qtdInadimplentes} clientes inadimplentes
            </p>
          </div>
        </motion.div>

        {/* Card 2 — Vence em 7 dias */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-amber-700">Vence em 7 dias</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatarMoeda(resumo.totalAVencer7)}
            </p>
            <p className="text-xs text-amber-400 mt-1">Atenção: cobranças urgentes</p>
          </div>
        </motion.div>

        {/* Card 3 — Vence em 30 dias */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
        >
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-blue-700">Vence em 30 dias</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatarMoeda(resumo.totalAVencer30)}
            </p>
            <p className="text-xs text-blue-400 mt-1">
              {resumo.qtdAVencer30} clientes a vencer
            </p>
          </div>
        </motion.div>

        {/* Card 4 — Total Pendente */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
        >
          <div className="bg-slate-50 border-l-4 border-slate-400 rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="text-sm font-medium text-slate-600">Total Pendente</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatarMoeda(resumo.totalGeral)}
            </p>
            {resumo.clientesSemDocumento > 0 && (
              <p className="text-xs text-amber-500 mt-1">
                ⚠ {resumo.clientesSemDocumento} clientes sem CPF/CNPJ não exibidos
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Tabs de filtro */}
      <div className="flex items-center gap-2 flex-wrap">
        {filtros.map((f) => (
          <Link key={f.valor} href={`/dashboard/financeiro?filtro=${f.valor}`}>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filtro === f.valor
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
                  filtro === f.valor
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {f.count}
              </span>
            </button>
          </Link>
        ))}
      </div>

      {/* Tabela de clientes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {clientes.length === 0 ? (
          // Estado vazio
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <CheckCircle className="h-16 w-16 text-green-400" />
            <p className="text-slate-600 font-medium text-lg">
              Nenhuma conta{" "}
              {filtro === "vencido"
                ? "vencida"
                : filtro === "a_vencer"
                ? "a vencer"
                : "pendente"}
            </p>
            <p className="text-slate-400 text-sm">Sua carteira está em dia 🎉</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Cliente
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      CPF/CNPJ
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      Boletos
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      Valor Total
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Boleto Mais Antigo
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      Atraso
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, idx) => (
                    <tr
                      key={c.cnpj}
                      className={`border-b border-slate-100 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">
                          {c.nome.length > 30 ? c.nome.slice(0, 30) + "…" : c.nome}
                        </span>
                      </td>

                      {/* CPF/CNPJ */}
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {formatarDocumento(c.cnpj)}
                      </td>

                      {/* Boletos */}
                      <td className="px-4 py-3 text-center text-slate-600">
                        {c.quantidadeBoletos} boleto{c.quantidadeBoletos !== 1 ? "s" : ""}
                      </td>

                      {/* Valor Total */}
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          c.diasMaiorAtraso > 0 ? "text-red-600" : "text-blue-600"
                        }`}
                      >
                        {formatarMoeda(c.totalDevido)}
                      </td>

                      {/* Boleto Mais Antigo */}
                      <td className="px-4 py-3 text-slate-500">
                        {formatarData(c.boletoMaisAntigo)}
                      </td>

                      {/* Badge de atraso */}
                      <td className="px-4 py-3 text-center">
                        {c.diasMaiorAtraso > 0 ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 whitespace-nowrap">
                            {c.diasMaiorAtraso} dias em atraso
                          </Badge>
                        ) : c.diasMaiorAtraso > -8 ? (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
                            Vence em {Math.abs(c.diasMaiorAtraso)} dias
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 whitespace-nowrap">
                            Vence em {Math.abs(c.diasMaiorAtraso)} dias
                          </Badge>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3 text-center">
                        <Link
                          href="#"
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Ver detalhes →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* Nota de rodapé */}
      <p className="text-xs text-slate-400 text-center">
        Clientes sem CPF/CNPJ cadastrado no ERP não aparecem nesta lista.
        Atualize o cadastro no MaxManager para cobertura completa.
      </p>
    </>
  );
}

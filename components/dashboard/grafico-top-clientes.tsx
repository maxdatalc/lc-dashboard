"use client";

// Gráfico horizontal de top 10 clientes por faturamento no período

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import type { ClienteRanking } from "@/lib/db/dashboard";

interface Props {
  dados: ClienteRanking[];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

// Formato compacto para labels nas barras (ex: R$12k, R$1,2k)
function formatCompact(valor: number): string {
  if (valor >= 1_000_000) {
    return `R$${(valor / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (valor >= 1000) {
    const v = valor / 1000;
    return v % 1 === 0 ? `R$${v}k` : `R$${v.toFixed(1).replace(".", ",")}k`;
  }
  return `R$${Math.round(valor)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ClienteRanking }>;
  label?: string;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-medium text-slate-800 truncate max-w-[200px]">{d.nome}</p>
      <p className="text-blue-600 font-semibold">{formatarMoeda(d.total)}</p>
      <p className="text-slate-500">{d.quantidade} {d.quantidade === 1 ? "compra" : "compras"}</p>
    </div>
  );
}

// Trunca nomes longos para caber no eixo Y
function truncar(nome: string): string {
  return nome.length > 15 ? nome.slice(0, 15) + "..." : nome;
}

export function GraficoTopClientes({ dados }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Users className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-sm font-medium text-slate-600">
            Top 10 Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dados.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center">
              <p className="text-slate-400 text-sm">Sem dados para o período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={dados}
                margin={{ top: 5, right: 60, bottom: 5, left: 0 }}
              >
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={120}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={truncar}
                />
                <XAxis type="number" hide={true} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="total"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationBegin={300}
                >
                  {dados.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index < 3 ? "#2563EB" : "#93C5FD"}
                    />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={(v: unknown) => formatCompact(Number(v))}
                    style={{ fontSize: 11, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

"use client";

// Gráfico de barras de receita por dia da semana com destaque no melhor e pior dia

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import type { DiaSemanaData } from "@/lib/db/dashboard";

interface Props {
  dados: DiaSemanaData[];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: DiaSemanaData }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-medium text-slate-800">{label}</p>
      <p className="text-blue-600 font-semibold">{formatarMoeda(d.total)}</p>
      <p className="text-slate-500">{d.quantidade} {d.quantidade === 1 ? "venda" : "vendas"}</p>
      <p className="text-slate-400">Ticket médio: {formatarMoeda(d.media)}</p>
    </div>
  );
}

export function GraficoDiaSemana({ dados }: Props) {
  // Identificar melhor e pior dia por total de receita
  const melhorDiaIdx = dados.reduce(
    (maxIdx, d, idx) => (d.total > dados[maxIdx].total ? idx : maxIdx),
    0
  );
  const piordDiaIdx = dados.reduce(
    (minIdx, d, idx) => (d.total < dados[minIdx].total ? idx : minIdx),
    0
  );

  // Média diária para linha de referência
  const totalGeral = dados.reduce((acc, d) => acc + d.total, 0);
  const mediaDiaria = totalGeral / 7;

  const melhorDia = dados[melhorDiaIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-sm font-medium text-slate-600">
            Receita por Dia da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={dados}
              margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
            >
              {/* Linha de referência na média diária */}
              <ReferenceLine
                y={mediaDiaria}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{
                  value: "Média",
                  position: "right",
                  fontSize: 10,
                  fill: "#94A3B8",
                }}
              />
              <XAxis
                dataKey="dia"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="total"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
                isAnimationActive={true}
                animationDuration={600}
                animationBegin={400}
              >
                {dados.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index === melhorDiaIdx
                        ? "#10B981"
                        : index === piordDiaIdx
                        ? "#F87171"
                        : "#60A5FA"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Resumo do melhor dia */}
          {melhorDia && melhorDia.total > 0 && (
            <p className="text-xs text-slate-500 text-center">
              📈 <span className="font-medium text-slate-700">{melhorDia.dia}</span>{" "}
              é seu dia mais forte com{" "}
              <span className="font-medium text-emerald-600">
                {formatarMoeda(melhorDia.total)}
              </span>{" "}
              em média
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

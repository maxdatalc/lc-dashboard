"use client";

// Gráfico de barras de faturamento por período — usa Recharts

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  dados: { label: string; total: number }[];
  totalGeral: number;
  label: string;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-sm text-blue-600 font-semibold">
        {formatarMoeda(payload[0].value)}
      </p>
    </div>
  );
}

export function GraficoFaturamento({ dados, totalGeral, label }: Props) {
  const semDados = dados.length === 0 || dados.every((d) => d.total === 0);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row justify-between items-center pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Faturamento — {label}
        </CardTitle>
        <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
          {formatarMoeda(totalGeral)}
        </span>
      </CardHeader>

      <CardContent>
        {semDados ? (
          <div className="h-[280px] flex items-center justify-center">
            <p className="text-slate-400 text-sm">Nenhuma venda neste período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="total"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

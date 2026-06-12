"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface ClientesRetencaoData {
  novos: number;
  recorrentes: number;
  faturamentoNovos: number;
  faturamentoRecorrentes: number;
}

const COR_NOVO = "#00e5ff";
const COR_REC  = "#f59e0b";

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { faturamento: number } }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{p.name}</p>
      <p style={{ color: "var(--text-secondary)" }}>{p.value} clientes</p>
      <p style={{ color: "var(--text-muted)" }}>{formatCurrency(p.payload.faturamento)}</p>
    </div>
  );
}

interface Props {
  data: ClientesRetencaoData;
}

export function ClientesRetencaoChart({ data }: Props) {
  const total = data.novos + data.recorrentes;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados no período
        </p>
      </div>
    );
  }

  const pctNovos = total > 0 ? (data.novos / total) * 100 : 0;
  const pctRec   = total > 0 ? (data.recorrentes / total) * 100 : 0;

  const pieData = [
    { name: "Novos",       value: data.novos,       faturamento: data.faturamentoNovos,       fill: COR_NOVO },
    { name: "Recorrentes", value: data.recorrentes, faturamento: data.faturamentoRecorrentes, fill: COR_REC  },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Donut */}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: "var(--bg-elevated)", border: `1px solid ${COR_NOVO}33` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_NOVO }} />
            <span className="text-xs font-medium" style={{ color: COR_NOVO }}>Novos</span>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {data.novos}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {pctNovos.toFixed(1)}% dos clientes
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(data.faturamentoNovos)}
          </p>
        </div>

        <div
          className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: "var(--bg-elevated)", border: `1px solid ${COR_REC}33` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COR_REC }} />
            <span className="text-xs font-medium" style={{ color: COR_REC }}>Recorrentes</span>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {data.recorrentes}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {pctRec.toFixed(1)}% dos clientes
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(data.faturamentoRecorrentes)}
          </p>
        </div>
      </div>
    </div>
  );
}

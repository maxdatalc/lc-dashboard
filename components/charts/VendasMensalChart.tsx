"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, LabelList, Cell,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface VendasMensalData {
  mes: string;
  mesCompleto: string;
  mesKey?: string;
  vendas: number;
  devolucoes: number;
  vendaLiquidaDevolucao: number;
  taxaDevolucao?: number;
  qtdVendas?: number;
  qtdDevolucoes?: number;
  ticketMedio?: number;
}

interface Props {
  data: VendasMensalData[];
  onMesClick?: (mesKey: string) => void;
  selectedMes?: string | null;
}

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ 0`;
}

function fmtYLeft(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return "R$ 0";
}

function fmtYRight(v: number): string {
  const n = Number(v);
  if (n === 0) return "0%";
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1).replace(".", ",")}%`;
}

export function VendasMensalChart({ data, onMesClick, selectedMes }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height: 220, color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  const enriched = data.map((d) => ({
    ...d,
    taxaDevolucao: d.taxaDevolucao ?? (d.vendas > 0 ? (d.devolucoes / d.vendas) * 100 : 0),
  }));

  const mediaVendas = enriched.reduce((s, d) => s + d.vendas, 0) / enriched.length;
  const maxVendas = Math.max(...enriched.map((d) => d.vendas));
  const maxIdx = enriched.findIndex((d) => d.vendas === maxVendas);
  const lastIdx = enriched.length - 1;
  const labelSet = new Set([maxIdx]);
  if (lastIdx !== maxIdx) labelSet.add(lastIdx);

  const hasSelected = !!selectedMes;

  return (
    <div>
      {/* Legend */}
      <div
        className="flex items-center gap-5 justify-center md:justify-end px-1 mb-2"
        style={{ fontSize: "12px", color: "var(--text-muted)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: "linear-gradient(180deg, #2563eb 0%, rgba(37,99,235,0.35) 100%)",
              display: "inline-block",
            }}
          />
          Vendas Brutas
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="10" style={{ display: "inline-block", verticalAlign: "middle" }}>
            <line x1="0" y1="5" x2="16" y2="5" stroke="#ef4444" strokeWidth="1.5" />
            <circle cx="8" cy="5" r="2.5" fill="#ef4444" />
          </svg>
          Taxa de Devolução
        </div>
      </div>

      <ChartFrame role="default">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={enriched}
          margin={{ top: 20, right: isMobile ? 8 : 44, bottom: 0, left: 4 }}
          barCategoryGap="32%"
          style={{ cursor: onMesClick ? "pointer" : "default" }}
        >
          <defs>
            <linearGradient id="vMensalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="vMensalGradDim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.04)" />

          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={fmtYLeft}
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 44 : 52}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={fmtYRight}
            tick={{ fontSize: 10, fill: "rgba(239,68,68,0.6)" }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={[0, "auto"]}
            hide={isMobile}
          />

          <ReferenceLine
            yAxisId="left"
            y={mediaVendas}
            stroke="rgba(37,99,235,0.28)"
            strokeDasharray="6 3"
            label={{
              value: "Média",
              position: "insideTopLeft",
              fill: "rgba(37,99,235,0.5)",
              fontSize: 10,
              fontWeight: 500,
            }}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as VendasMensalData & { taxaDevolucao: number };
              return (
                <div
                  className="rounded-xl shadow-xl"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    padding: "12px 16px",
                    minWidth: "220px",
                    fontSize: "12px",
                  }}
                >
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "var(--text-primary)",
                      marginBottom: "10px",
                    }}
                  >
                    {d.mesCompleto ?? label}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Vendas Brutas</span>
                      <span style={{ fontWeight: 600, color: "#2563eb", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoeda(d.vendas)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Devoluções</span>
                      <span style={{ fontWeight: 600, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoeda(d.devolucoes)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                      <span style={{ color: "#ef4444" }}>Taxa de Devolução</span>
                      <span style={{ fontWeight: 600, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                        {d.taxaDevolucao.toFixed(2).replace(".", ",")}%
                      </span>
                    </div>
                    {(d.qtdDevolucoes ?? 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Qtd. Devoluções</span>
                        <span style={{ fontWeight: 600, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                          {(d.qtdDevolucoes ?? 0).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    )}
                    {d.qtdVendas !== undefined && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Quantidade de Vendas</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {d.qtdVendas.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    )}
                    {d.ticketMedio !== undefined && d.ticketMedio > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Ticket Médio</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtMoeda(d.ticketMedio)}
                        </span>
                      </div>
                    )}
                  </div>
                  {onMesClick && (
                    <p
                      style={{
                        marginTop: "8px",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        borderTop: "1px solid var(--border-subtle)",
                        paddingTop: "6px",
                      }}
                    >
                      {selectedMes && d.mesKey === selectedMes
                        ? "Clique para remover o filtro"
                        : "Clique para filtrar por este mês"}
                    </p>
                  )}
                </div>
              );
            }}
            cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 }}
          wrapperStyle={{ overflow: "visible" }}
          />

          <Bar
            yAxisId="left"
            dataKey="vendas"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={(barData: any) => {
              if (onMesClick && barData.mesKey) onMesClick(barData.mesKey as string);
            }}
          >
            {enriched.map((d, i) => (
              <Cell
                key={i}
                fill={
                  hasSelected && d.mesKey
                    ? d.mesKey === selectedMes
                      ? "url(#vMensalGrad)"
                      : "url(#vMensalGradDim)"
                    : "url(#vMensalGrad)"
                }
              />
            ))}
            <LabelList
              dataKey="vendas"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => {
                const { x, y, width, value, index } = props as {
                  x: number; y: number; width: number; value: number; index: number;
                };
                if (index === undefined || !labelSet.has(index)) return null;
                const cx = Number(x) + Number(width) / 2;
                const cy = Number(y) - 5;
                return (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill={
                      hasSelected && enriched[index]?.mesKey !== selectedMes
                        ? "rgba(37,99,235,0.35)"
                        : "#2563eb"
                    }
                  >
                    {fmtCompact(Number(value))}
                  </text>
                );
              }}
            />
          </Bar>

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="taxaDevolucao"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#ef4444" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

"use client";

import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useState, useRef, useCallback } from "react";

export interface VendasMensalData {
  mes: string;
  mesCompleto: string;
  vendas: number;
  devolucoes: number;
  vendaLiquidaDevolucao: number;
}

interface Props {
  data: VendasMensalData[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  mesCompleto?: string;
}

function CustomTooltip({ active, payload, mesCompleto }: CustomTooltipProps) {
  if (!active || !payload?.length || !mesCompleto) return null;

  const vendas = payload.find((p) => p.name === "vendas")?.value ?? 0;
  const devolucoes = payload.find((p) => p.name === "devolucoes")?.value ?? 0;
  const liquido = vendas - devolucoes;

  return (
    <div
      className="rounded-xl px-4 py-3 shadow-xl text-xs"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        minWidth: "210px",
      }}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--text-primary)", fontSize: "13px" }}>
        {mesCompleto}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div className="flex justify-between gap-4">
          <span style={{ color: "var(--text-secondary)" }}>Vendas</span>
          <span className="font-semibold tabular-nums" style={{ color: "#00e5ff" }}>
            {fmt(vendas)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: "var(--text-secondary)" }}>Devolução</span>
          <span className="font-semibold tabular-nums" style={{ color: "#ef4444" }}>
            {fmt(devolucoes)}
          </span>
        </div>
        <div
          className="flex justify-between gap-4 pt-1.5 mt-0.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Venda (−) Devolução</span>
          <span
            className="font-bold tabular-nums"
            style={{ color: liquido >= 0 ? "#10b981" : "#ef4444" }}
          >
            {fmt(liquido)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function VendasMensalChart({ data }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipMes, setTooltipMes] = useState("");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const temDevolucoes = data.some((d) => d.devolucoes > 0);

  // Tooltip com delay de 800ms para não flicker ao passar o mouse rapidamente
  // Usa o índice para acessar os dados — evita incompatibilidade com BarRectangleItem do Recharts
  const handleBarMouseEnter = useCallback((_: unknown, index: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredIndex(index);
      setTooltipMes(data[index]?.mesCompleto ?? "");
    }, 800);
  }, [data]);

  const handleBarMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredIndex(null);
  }, []);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height: 200, color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  // Largura mínima por mês para garantir legibilidade com 12 barras
  const MIN_WIDTH_PER_MES = 72;
  const totalWidth = Math.max(data.length * MIN_WIDTH_PER_MES, 600);

  return (
    <div className="flex flex-col gap-2">
      {/* Legenda */}
      <div
        className="flex items-center gap-4 justify-end px-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-sm"
            style={{ width: 10, height: 10, background: "#00e5ff" }}
          />
          Vendas
        </div>
        {temDevolucoes && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: "#ef4444" }}
            />
            Devoluções
          </div>
        )}
      </div>

      {/* Scroll horizontal para 12 barras */}
      <div style={{ overflowX: "auto", overflowY: "visible" }} className="custom-scroll">
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
              barGap={3}
              barCategoryGap="25%"
            >
              <defs>
                <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={1} />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="vendasGradHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={1} />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity={0.65} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />

              <Tooltip
                content={
                  <CustomTooltip
                    active={hoveredIndex !== null}
                    payload={
                      hoveredIndex !== null
                        ? [
                            { name: "vendas", value: data[hoveredIndex]?.vendas ?? 0, color: "#00e5ff" },
                            { name: "devolucoes", value: data[hoveredIndex]?.devolucoes ?? 0, color: "#ef4444" },
                          ]
                        : []
                    }
                    mesCompleto={tooltipMes}
                  />
                }
                cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 }}
              />

              {/* Barras de vendas com highlight no hover */}
              <Bar
                dataKey="vendas"
                radius={[4, 4, 0, 0]}
                maxBarSize={temDevolucoes ? 32 : 44}
                onMouseEnter={handleBarMouseEnter}
                onMouseLeave={handleBarMouseLeave}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`vendas-${index}`}
                    fill={hoveredIndex === index ? "url(#vendasGradHover)" : "url(#vendasGrad)"}
                  />
                ))}
              </Bar>

              {/* Barras de devoluções — só exibe se houver dados */}
              {temDevolucoes && (
                <Bar
                  dataKey="devolucoes"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  fill="#ef4444"
                  fillOpacity={0.75}
                  onMouseEnter={handleBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

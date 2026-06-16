"use client";

import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";

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

export function VendasMensalChart({ data }: Props) {
  const temDevolucoes = data.some((d) => d.devolucoes > 0);

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
          <ResponsiveContainer width="100%" height={155}>
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

              {/* Tooltip nativo do Recharts sem delay */}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const vendas = (payload.find((p) => p.dataKey === "vendas")?.value as number) ?? 0;
                  const devolucoes = (payload.find((p) => p.dataKey === "devolucoes")?.value as number) ?? 0;
                  const liquido = vendas - devolucoes;
                  const item = data.find((d) => d.mes === label);
                  return (
                    <div
                      className="rounded-xl px-4 py-3 shadow-xl text-xs"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        minWidth: "200px",
                      }}
                    >
                      <p className="font-semibold mb-2" style={{ color: "var(--text-primary)", fontSize: "13px" }}>
                        {item?.mesCompleto ?? label}
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
                }}
                cursor={{ fill: "var(--chart-cursor-bg)", radius: 4 }}
              />

              {/* Barras de vendas */}
              <Bar
                dataKey="vendas"
                fill="url(#vendasGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={temDevolucoes ? 32 : 44}
              />

              {/* Barras de devoluções — só exibe se houver dados */}
              {temDevolucoes && (
                <Bar
                  dataKey="devolucoes"
                  fill="#ef4444"
                  fillOpacity={0.75}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

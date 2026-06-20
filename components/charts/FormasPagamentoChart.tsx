"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieAny = Pie as any;

export interface FormasPagamentoData {
  nome: string;
  valor: number;
  percentual: number;
  qtdVendas?: number;
}

interface Props {
  data: FormasPagamentoData[];
}

const CORES = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#7c3aed",
  "#f97316",
  "#ef4444",
];

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return formatCurrency(v);
}

function fmtPct(p: number): string {
  if (p <= 0) return "0%";
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 3}
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export function FormasPagamentoChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const top6 = data.slice(0, 6);

  if (!top6.length) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height: 220, color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  const displayed = activeIndex !== undefined ? top6[activeIndex] : top6[0];
  const displayedColor =
    activeIndex !== undefined ? CORES[activeIndex % CORES.length] : CORES[0];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Donut — mesmas dimensões do VendasTipoChart */}
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <PieAny
              data={top6}
              cx={55}
              cy={55}
              innerRadius={35}
              outerRadius={52}
              paddingAngle={2}
              dataKey="valor"
              strokeWidth={0}
              activeIndex={activeIndex}
              activeShape={ActiveSlice}
              onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {top6.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CORES[index % CORES.length]}
                  opacity={
                    activeIndex !== undefined && activeIndex !== index ? 0.35 : 1
                  }
                />
              ))}
            </PieAny>
          </PieChart>
        </ResponsiveContainer>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="tabular-nums leading-none"
            style={{
              fontFamily: "var(--font-numeric)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: displayedColor,
            }}
          >
            {fmtPct(displayed?.percentual ?? 0)}
          </span>
          <span
            className="text-[10px] mt-0.5"
            style={{
              color: "var(--text-muted)",
              maxWidth: "62px",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayed?.nome ?? ""}
          </span>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col gap-2 w-full">
        {top6.map((d, i) => {
          const cor = CORES[i % CORES.length];
          const isActive = activeIndex === i;
          return (
            <div
              key={d.nome}
              className="flex items-center gap-2"
              style={{
                opacity: activeIndex !== undefined && !isActive ? 0.4 : 1,
                transition: "opacity 0.15s",
                cursor: "default",
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <div
                className="flex-shrink-0"
                style={{ width: 7, height: 7, borderRadius: "50%", background: cor }}
              />
              <span
                className="text-xs flex-1 truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {d.nome}
              </span>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: "var(--text-primary)", minWidth: "32px", textAlign: "right" }}
              >
                {fmtPct(d.percentual)}
              </span>
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-muted)", minWidth: "52px", textAlign: "right" }}
              >
                {fmtCompact(d.valor)}
              </span>
              {d.qtdVendas != null && (
                <span
                  className="text-[10px] tabular-nums"
                  style={{ color: "var(--text-muted)", minWidth: "44px", textAlign: "right" }}
                >
                  {d.qtdVendas.toLocaleString("pt-BR")} vd.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

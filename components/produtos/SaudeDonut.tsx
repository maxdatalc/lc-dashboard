"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { AlertTriangle } from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { STATUS_META, fmtInt, fmtPct } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieAny = Pie as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
      startAngle={startAngle} endAngle={endAngle} fill={fill} />
  );
}

const SEGMENTOS: StatusEstoque[] = ["negativo", "abaixo", "acima", "semMin", "regular"];

export function SaudeDonut({
  kpis, activeStatus, onStatusClick,
}: {
  kpis: ProdutosKpis;
  activeStatus: StatusEstoque | null;
  onStatusClick: (s: StatusEstoque) => void;
}) {
  const [hover, setHover] = useState<number | undefined>(undefined);

  const valores: Record<StatusEstoque, number> = {
    negativo: kpis.negativo,
    abaixo: kpis.abaixoMin,
    acima: kpis.acimaMin,
    semMin: kpis.semMin,
    regular: kpis.regular,
    margemNeg: kpis.margemNeg,
  };

  const total = kpis.totalPosicoes;
  const data = SEGMENTOS
    .map((s) => ({ status: s, value: valores[s] }))
    .filter((d) => d.value > 0);

  const semMinPct = total > 0 ? (kpis.semMin / total) * 100 : 0;
  const hasSel = activeStatus !== null;

  if (total === 0) {
    return <div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>Sem produtos para os filtros atuais</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <PieAny
                data={data}
                cx="50%" cy="50%"
                innerRadius={52} outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                activeIndex={hover}
                activeShape={ActiveSlice}
                onClick={(e: { status: StatusEstoque }) => onStatusClick(e.status)}
                onMouseEnter={(_: unknown, idx: number) => setHover(idx)}
                onMouseLeave={() => setHover(undefined)}
                style={{ cursor: "pointer" }}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={STATUS_META[d.status].color}
                    opacity={hasSel && activeStatus !== d.status ? 0.25 : 1} />
                ))}
              </PieAny>
            </PieChart>
          </ResponsiveContainer>
          {/* Centro */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontFamily: "var(--font-numeric)", fontSize: 22, fontWeight: 700, color: STATUS_META.semMin.color, lineHeight: 1 }}>
              {fmtPct(semMinPct)}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>sem mínimo</span>
          </div>
        </div>

        {/* Legenda clicável */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {data.map((d) => {
            const meta = STATUS_META[d.status];
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const isSel = activeStatus === d.status;
            return (
              <button
                type="button"
                key={d.status}
                onClick={() => onStatusClick(d.status)}
                className="flex items-center gap-2 rounded-md transition-all text-left"
                style={{ padding: "3px 5px", opacity: hasSel && !isSel ? 0.45 : 1, background: isSel ? `${meta.color}12` : "transparent", cursor: "pointer" }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.color, flexShrink: 0 }} />
                <span className="truncate" style={{ fontSize: 11.5, color: "var(--text-secondary)", flex: 1 }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{fmtInt(d.value)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color, fontVariantNumeric: "tabular-nums", width: 46, textAlign: "right" }}>{fmtPct(pct)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Destaque: sem mínimo */}
      {semMinPct >= 15 && (
        <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Alto volume sem mínimo compromete a análise de reposição e cobertura.
          </span>
        </div>
      )}
    </div>
  );
}

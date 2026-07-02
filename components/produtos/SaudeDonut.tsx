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
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle} fill={fill} />
  );
}

const SEGMENTOS: StatusEstoque[] = ["negativo", "abaixo", "acima", "semMin", "regular"];

// Legenda agrupada: separa o que é problema operacional (estoque) do que é
// lacuna de cadastro — leitura mais gerencial, sem mudar nenhum cálculo.
const LEGENDA: { titulo: string; itens: StatusEstoque[] }[] = [
  { titulo: "Situação operacional", itens: ["negativo", "abaixo", "acima", "regular"] },
  { titulo: "Cadastro", itens: ["semMin"] },
];

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
    return <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>Sem produtos para os filtros atuais</div>;
  }

  return (
    <div className="flex flex-col gap-3 h-full justify-center">
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 158, height: 158 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <PieAny
                data={data}
                cx="50%" cy="50%"
                innerRadius={54} outerRadius={76}
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
            <span style={{ fontFamily: "var(--font-numeric)", fontSize: 23, fontWeight: 800, color: STATUS_META.semMin.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {fmtPct(semMinPct)}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>sem mínimo</span>
          </div>
        </div>

        {/* Legenda agrupada e clicável */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          {LEGENDA.map((grupo) => {
            const rows = grupo.itens.filter((s) => valores[s] > 0);
            if (rows.length === 0) return null;
            return (
              <div key={grupo.titulo}>
                <p style={{
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--text-muted)", marginBottom: 3, paddingLeft: 6,
                }}>
                  {grupo.titulo}
                </p>
                {rows.map((s) => {
                  const meta = STATUS_META[s];
                  const pct = total > 0 ? (valores[s] / total) * 100 : 0;
                  const isSel = activeStatus === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => onStatusClick(s)}
                      className="prod-row flex items-center gap-2 rounded-md text-left w-full"
                      style={{
                        padding: "3.5px 6px",
                        opacity: hasSel && !isSel ? 0.4 : 1,
                        background: isSel ? `color-mix(in srgb, ${meta.color} 9%, transparent)` : undefined,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: meta.color, flexShrink: 0 }} />
                      <span className="truncate" style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{fmtInt(valores[s])}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, fontVariantNumeric: "tabular-nums", width: 48, textAlign: "right" }}>{fmtPct(pct)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Destaque: sem mínimo */}
      {semMinPct >= 15 && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: "color-mix(in srgb, var(--accent-yellow) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)",
          }}>
          <AlertTriangle style={{ width: 14, height: 14, color: "var(--accent-yellow)", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Alto volume sem mínimo compromete a análise de reposição e cobertura.
          </span>
        </div>
      )}
    </div>
  );
}

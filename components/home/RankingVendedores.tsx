"use client";

import { formatCurrency } from "@/lib/utils/format";

export interface RankingItem {
  nome: string;
  valor: number;
  percent: number;
}

// Realce sutil apenas para o líder; demais posições em tom neutro.
function positionColor(index: number): string {
  return index === 0 ? "var(--accent-cyan)" : "var(--text-secondary)";
}

export function RankingVendedores({ ranking }: { ranking: RankingItem[] }) {
  const top = ranking[0]?.valor ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      {ranking.length === 0 && (
        <p className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda atribuída a vendedores no período.
        </p>
      )}

      {ranking.slice(0, 5).map((v, i) => {
        const barPct = top > 0 ? (v.valor / top) * 100 : 0;
        const isLeader = i === 0;
        return (
          <div
            key={i}
            className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              className="shrink-0 w-6 text-center text-[13px] font-bold tabular-nums"
              style={{
                color: positionColor(i),
                fontFamily: "var(--font-numeric)",
              }}
            >
              {i + 1}
            </span>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className="text-[13px] font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {v.nome}
                </p>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {v.percent.toFixed(0)}%
                  </span>
                  <span
                    className="text-[13px] font-semibold tabular-nums"
                    style={{
                      color: isLeader ? "var(--accent-cyan)" : "var(--text-secondary)",
                      fontFamily: "var(--font-numeric)",
                    }}
                  >
                    {formatCurrency(v.valor)}
                  </span>
                </div>
              </div>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 4, background: "var(--chart-track-bg)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${barPct}%`,
                    background: isLeader ? "var(--accent-cyan)" : "var(--text-muted)",
                    opacity: isLeader ? 1 : 0.6,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

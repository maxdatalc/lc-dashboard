"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface GrupoItem {
  nome: string;
  valor: number;
  quantidade: number;
}

const CORES = [
  "#2563eb", "#f59e0b", "#10b981", "#7c3aed",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1",
];

const PODIO_COLORS = ["#f59e0b", "#94a3b8", "#b45309"]; // ouro, prata, bronze

function fmtK(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return formatCurrency(v);
}

function KpiChip({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 6,
      background: "var(--card-header-bg)",
      border: "1px solid var(--card-header-border)",
      minWidth: 0,
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, whiteSpace: "nowrap" }}>
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? "var(--text-primary)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: GrupoItem }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{d.nome}</p>
      <p style={{ color: "var(--accent-cyan)" }}>{formatCurrency(d.valor)}</p>
    </div>
  );
}

interface Props {
  data: GrupoItem[];
}

export function TopGruposChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200 }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sem dados no período</p>
      </div>
    );
  }

  const totalGeral  = data.reduce((s, d) => s + d.valor, 0);
  const top3        = data.slice(0, 3);
  const rest        = data.slice(3);
  const top3Sum     = top3.reduce((s, d) => s + d.valor, 0);
  const top3Pct     = totalGeral > 0 ? (top3Sum / totalGeral) * 100 : 0;
  const leader      = data[0];
  const leaderPct   = totalGeral > 0 ? (leader.valor / totalGeral) * 100 : 0;
  const maxValor    = data[0]?.valor ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── 4 KPI chips 2×2 ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <KpiChip
          label="Total faturado"
          value={fmtK(totalGeral)}
          sub="período selecionado"
        />
        <KpiChip
          label="Líder de mercado"
          value={leader.nome}
          sub={`${leaderPct.toFixed(1)}% — ${fmtK(leader.valor)}`}
          valueColor="var(--accent-cyan)"
        />
        <KpiChip
          label="Conc. top 3"
          value={`${top3Pct.toFixed(1)}%`}
          sub={top3.map(d => d.nome.split(" ")[0]).join(" · ")}
        />
        <KpiChip
          label="Fabricantes ativos"
          value={String(data.length)}
          sub="no período"
        />
      </div>

      {/* ── Gráfico de barras horizontal (todos os itens) ───────── */}
      <div>
        <SectionLabel icon="📊" label="Faturamento por fabricante" />
        <ResponsiveContainer width="100%" height={Math.min(data.length * 22, 180)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={100}
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-cursor-bg, rgba(255,255,255,0.04))" }} />
            <Bar dataKey="valor" radius={[0, 3, 3, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Pódio TOP 3 ─────────────────────────────────────────── */}
      <div>
        <SectionLabel icon="🏆" label="Pódio — top 3" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {top3.map((d, i) => {
            const pct  = totalGeral > 0 ? (d.valor / totalGeral) * 100 : 0;
            const barW = maxValor > 0 ? (d.valor / maxValor) * 100 : 0;
            const cor  = CORES[i % CORES.length];
            const rankColor = PODIO_COLORS[i];
            return (
              <div key={d.nome}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {/* rank badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: rankColor,
                    width: 14, textAlign: "center", flexShrink: 0, lineHeight: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.nome}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 2, margin: "4px 0 3px 21px" }}>
                  <div style={{ height: "100%", width: `${barW}%`, background: cor, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", paddingLeft: 21 }}>
                  {formatCurrency(d.valor)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Demais fabricantes (scrollable) ─────────────────────── */}
      {rest.length > 0 && (
        <div>
          <SectionLabel icon="≡" label="Demais fabricantes" />
          <div style={{ maxHeight: 140, overflowY: "auto", paddingRight: 4 }}>
            {rest.map((d, i) => {
              const pct  = totalGeral > 0 ? (d.valor / totalGeral) * 100 : 0;
              const barW = maxValor > 0 ? (d.valor / maxValor) * 100 : 0;
              const cor  = CORES[(i + 3) % CORES.length];
              return (
                <div key={d.nome} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.nome}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {pct.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 5 }}>
                      {formatCurrency(d.valor)}
                    </span>
                  </div>
                  <div style={{ height: 3, background: "var(--border-subtle)", borderRadius: 2, marginTop: 3, marginLeft: 12 }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: cor, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

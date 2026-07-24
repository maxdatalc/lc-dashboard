"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trophy, BarChart2, List } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface GrupoItem {
  nome: string;
  valor: number;
  quantidade: number;
}

const CORES = [
  "#2563eb", "#10b981", "#7c3aed", "#f59e0b",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1", "#94a3b8", "#14b8a6",
  "#fb923c", "#a855f7", "#38bdf8", "#4ade80",
  "#f472b6", "#facc15", "#fb7185", "#818cf8",
];

function fmtK(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return formatCurrency(v);
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: GrupoItem }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{d.nome}</p>
      <p style={{ color: "var(--accent-cyan)" }}>{formatCurrency(d.valor)}</p>
    </div>
  );
}

interface Props {
  data: GrupoItem[];
}

export function TopGruposChart({ data }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200 }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sem dados no período</p>
      </div>
    );
  }

  const totalGeral = data.reduce((s, d) => s + d.valor, 0);
  const top3       = data.slice(0, 3);
  const rest       = data.slice(3);
  const top3Sum    = top3.reduce((s, d) => s + d.valor, 0);
  const top3Pct    = totalGeral > 0 ? (top3Sum / totalGeral) * 100 : 0;
  const leader     = data[0];
  const leaderPct  = totalGeral > 0 ? (leader.valor / totalGeral) * 100 : 0;
  const maxValor   = data[0]?.valor ?? 1;

  // data já vem ordenado desc (maior → menor); exibe nessa ordem no gráfico
  const chartData   = data;
  const chartHeight = Math.max(chartData.length * 26, 120);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── 4 KPI chips — 2×2 no mobile, linha única no desktop ──── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
        {/* Total faturado */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--card-header-bg)", border: "1px solid var(--card-header-border)" }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Total faturado</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
            {fmtK(totalGeral)}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>período selecionado</p>
        </div>

        {/* Líder de mercado */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--card-header-bg)", border: "1px solid var(--card-header-border)" }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Líder de mercado</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-cyan)", lineHeight: 1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {leader.nome}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{leaderPct.toFixed(1)}% — {fmtK(leader.valor)}</p>
        </div>

        {/* Top 3 concentração */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--card-header-bg)", border: "1px solid var(--card-header-border)" }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Top 3 concentração</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#10b981", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
            {top3Pct.toFixed(1)}%
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {top3.map(d => d.nome.split(" ")[0]).join(" · ")}
          </p>
        </div>

        {/* Fabricantes ativos */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--card-header-bg)", border: "1px solid var(--card-header-border)" }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Fabricantes ativos</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
            {data.length}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>no período</p>
        </div>
      </div>

      {/* ── Pódio | Gráfico: lado a lado no desktop, empilhado no mobile ── */}
      {/* No mobile, empilhar dá largura total ao pódio — sem isso o nome da
          marca era espremido a ~90px e truncava para "F…" (bug reportado). */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, height: isMobile ? "auto" : 300 }}>

        {/* Pódio TOP 3 */}
        <div style={{
          height: isMobile ? "auto" : "100%", boxSizing: "border-box",
          padding: "14px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, flexShrink: 0 }}>
            <Trophy style={{ width: 12, height: 12, color: "#f59e0b", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Pódio — Top 3
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {top3.map((d, i) => {
              const pct  = totalGeral > 0 ? (d.valor / totalGeral) * 100 : 0;
              const barW = maxValor > 0 ? (d.valor / maxValor) * 100 : 0;
              const cor  = CORES[i % CORES.length];
              return (
                <div key={d.nome} style={{ marginBottom: i < top3.length - 1 ? 18 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", background: cor,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{i + 1}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.nome}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--border-subtle)", borderRadius: 3, margin: "8px 0 5px 34px" }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: cor, borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 34, fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(d.valor)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Faturamento por fabricante — scroll real */}
        <div style={{
          height: isMobile ? 300 : "100%", boxSizing: "border-box",
          padding: "14px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexShrink: 0 }}>
            <BarChart2 style={{ width: 12, height: 12, color: "var(--accent-cyan)", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Faturamento por fabricante
            </span>
          </div>
          {/* Área scrollável — minHeight: 0 é obrigatório para o flex encolher */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            <div style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 20 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                    tickFormatter={(v: number) => v >= 1000 ? `R$ ${Math.round(v / 1000)}k` : `R$ ${v}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={85}
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="valor" radius={[0, 3, 3, 0]}>
                    {chartData.map((d) => {
                      const idx = data.findIndex(x => x.nome === d.nome);
                      return <Cell key={d.nome} fill={CORES[idx % CORES.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Demais fabricantes (scrollável) ─────────────────────── */}
      {rest.length > 0 && (
        <div style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <List style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Demais fabricantes
            </span>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", paddingRight: 2 }}>
            {rest.map((d, i) => {
              const pct  = totalGeral > 0 ? (d.valor / totalGeral) * 100 : 0;
              const barW = maxValor > 0 ? (d.valor / maxValor) * 100 : 0;
              const cor  = CORES[(i + 3) % CORES.length];
              return (
                <div key={d.nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {d.nome}
                  </span>
                  <div style={{ flex: 1, height: 4, background: "var(--border-subtle)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: cor, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", width: 38, textAlign: "right", flexShrink: 0 }}>
                    {pct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", width: 95, textAlign: "right", flexShrink: 0 }}>
                    {formatCurrency(d.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

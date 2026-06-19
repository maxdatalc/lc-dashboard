"use client";

export interface FinTopDevedorData {
  cliente: string;
  qtd: number;
  valor: number;
  maisAntigo: string;
  maxDias: number;
}

interface Props {
  data: FinTopDevedorData[];
  selectedAging?: string | null;
}

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function riskColor(dias: number): string {
  if (dias > 90) return "#991b1b";
  if (dias > 60) return "#ef4444";
  if (dias > 30) return "#f97316";
  return "#f59e0b";
}

function riskBg(dias: number): string {
  if (dias > 90) return "rgba(153,27,27,0.12)";
  if (dias > 60) return "rgba(239,68,68,0.10)";
  if (dias > 30) return "rgba(249,115,22,0.10)";
  return "rgba(245,158,11,0.10)";
}

export function FinTopDevedoresChart({ data, selectedAging: _ }: Props) {
  if (data.length === 0) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 200,
        color: "var(--text-muted)",
        fontSize: 13,
      }}>
        Nenhum devedor nesta faixa
      </div>
    );
  }

  const maxValor = Math.max(...data.map((d) => d.valor), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
      {data.map((d, i) => {
        const pct = (d.valor / maxValor) * 100;
        const cor = riskColor(d.maxDias);
        const bg  = riskBg(d.maxDias);
        return (
          <div
            key={`${d.cliente}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2rem 1fr auto",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: 8,
              background: i === 0 ? bg : "transparent",
              border: `1px solid ${i === 0 ? cor + "30" : "transparent"}`,
              transition: "background 0.15s",
            }}
          >
            {/* Rank */}
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: i < 3 ? cor : "var(--text-muted)",
              fontFamily: "var(--font-mono, monospace)",
              textAlign: "right",
            }}>
              {i + 1}
            </span>

            {/* Nome + barra */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginBottom: 3,
              }}>
                {d.cliente}
              </div>
              <div style={{
                height: 3,
                borderRadius: 2,
                background: "var(--border-subtle)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: cor,
                  borderRadius: 2,
                  transition: "width 0.6s cubic-bezier(.22,.61,.36,1)",
                }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {d.qtd} título{d.qtd !== 1 ? "s" : ""} · {d.maxDias} dias em atraso
              </div>
            </div>

            {/* Valor */}
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
              color: cor,
              whiteSpace: "nowrap",
            }}>
              {fmtR(d.valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

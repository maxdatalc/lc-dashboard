"use client";

export interface FinSaldoContaData {
  ctaId: number;
  ctaNome: string;
  saldo: number;
}

interface Props {
  data: FinSaldoContaData[];
  selectedConta?: number | null;
  onContaClick?: (ctaId: number | null) => void;
}

function fmtR(v: number) {
  return `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinSaldoContasChart({ data, selectedConta, onContaClick }: Props) {
  if (data.length === 0) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "var(--text-muted)", fontSize: 13 }}>Sem contas com movimento</div>;
  }

  const sorted = [...data].sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  const maxAbs = Math.max(...sorted.map((d) => Math.abs(d.saldo)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 214, overflowY: "auto", paddingRight: 2 }}>
      {sorted.map((d) => {
        const pos = d.saldo >= 0;
        const cor = pos ? "var(--accent-cyan)" : "#ef4444";
        const pct = (Math.abs(d.saldo) / maxAbs) * 50; // metade da largura = zero central
        const active = selectedConta === d.ctaId;
        const dimmed = selectedConta != null && !active;
        return (
          <button
            key={d.ctaId}
            onClick={() => onContaClick?.(active ? null : d.ctaId)}
            style={{
              display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(56px, 0.65fr) auto", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              background: active ? "rgba(127,127,127,0.08)" : "transparent",
              border: `1px solid ${active ? cor + "55" : "transparent"}`,
              opacity: dimmed ? 0.4 : 1, transition: "opacity .2s, background .15s, border-color .15s",
            }}
          >
            <span
              style={{
                fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.25,
                wordBreak: "break-word",
              }}
              title={d.ctaNome}
            >
              {d.ctaNome}
            </span>
            {/* trilho divergente com zero central */}
            <div style={{ position: "relative", height: 12 }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-subtle)" }} />
              <div style={{
                position: "absolute", top: 1, bottom: 1, height: 10, borderRadius: 3, background: cor,
                ...(pos ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }),
                transition: "width .6s cubic-bezier(.22,.61,.36,1)",
              }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: cor, textAlign: "right", whiteSpace: "nowrap" }}>
              {fmtR(d.saldo)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

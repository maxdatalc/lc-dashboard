"use client";

export interface TopClienteData {
  nome: string;
  total: number;
  compras: number;
}

interface Props {
  data: TopClienteData[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (value >= 1_000)
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Gera cor consistente a partir do nome via hash simples
function hashColor(nome: string): string {
  const cores = [
    "#00d4ff", "#f0a500", "#3fb950", "#a371f7",
    "#ff7b00", "#ff4444", "#4d9de0", "#e15554",
  ];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return cores[Math.abs(hash) % cores.length];
}

function initials(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function TopClientesChart({ data }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center py-8 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = sorted[0]?.total ?? 1;

  return (
    <div className="flex flex-col gap-2">
      {sorted.slice(0, 8).map((cliente, i) => {
        const pct = max > 0 ? (cliente.total / max) * 100 : 0;
        const cor = hashColor(cliente.nome);

        return (
          <div key={i} className="flex items-center gap-2">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: `${cor}22`, color: cor }}
            >
              {initials(cliente.nome)}
            </div>

            {/* Nome + compras */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
                title={cliente.nome}
              >
                {cliente.nome}
              </span>

              {/* Barra */}
              <div
                className="rounded-full overflow-hidden"
                style={{ height: "4px", backgroundColor: "var(--border-subtle)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--accent-yellow)",
                  }}
                />
              </div>
            </div>

            {/* Compras + valor */}
            <div className="flex flex-col items-end flex-shrink-0">
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(cliente.total)}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {cliente.compras} {cliente.compras === 1 ? "compra" : "compras"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

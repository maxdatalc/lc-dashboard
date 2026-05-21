"use client";

import { formatCurrency } from "@/lib/utils/format";

export interface TopClienteData {
  nome: string;
  total: number;
  compras: number;
}

interface Props {
  data: TopClienteData[];
}


// Cor de avatar consistente baseada no nome via hash simples
function hashAvatarColor(nome: string): { bg: string; text: string } {
  const palettes = [
    { bg: "rgba(0,229,255,0.15)", text: "#00e5ff" },
    { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
    { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
    { bg: "rgba(167,139,250,0.15)", text: "#a78bfa" },
    { bg: "rgba(249,115,22,0.15)", text: "#f97316" },
    { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
    { bg: "rgba(77,154,224,0.15)", text: "#4d9ae0" },
    { bg: "rgba(232,121,249,0.15)", text: "#e879f9" },
  ];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
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
    <div className="flex flex-col gap-3">
      {sorted.slice(0, 8).map((cliente, i) => {
        const pct = max > 0 ? (cliente.total / max) * 100 : 0;
        const avatar = hashAvatarColor(cliente.nome);
        const gradId = `grad-c-${i}`;

        return (
          <div key={i} className="flex items-center gap-3">
            {/* Avatar 32px */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                width: 32,
                height: 32,
                backgroundColor: avatar.bg,
                color: avatar.text,
              }}
            >
              {initials(cliente.nome)}
            </div>

            {/* Nome + barra */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
                title={cliente.nome}
              >
                {cliente.nome}
              </span>

              {/* Barra gradiente violeta */}
              <div
                className="relative rounded-full overflow-hidden"
                style={{ height: 4, backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <svg
                  className="absolute inset-0"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#a78bfa22" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={`${pct}%`}
                    height="100%"
                    fill={`url(#${gradId})`}
                    rx="9999"
                    style={{ transition: "width 0.5s ease" }}
                  />
                </svg>
              </div>
            </div>

            {/* Valor + compras */}
            <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
              <span
                className="text-xs font-semibold tabular-nums"
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

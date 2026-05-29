"use client";

import { useState } from "react";

export interface ClienteItem {
  nome: string;
  total: number;
  compras: number;
  ticketMedio: number;
  ultimaCompra: string;
  tipoPessoa: "PF" | "PJ";
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
  telefone?: string | null;
  cnpjCpf?: string | null;
}

export type TopClienteData = ClienteItem;

interface Props {
  data: ClienteItem[];
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

function formatData(d: string): string {
  if (!d) return "-";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function getAvatarColor(nome: string): string {
  const cores = ["#7c3aed", "#1a6fd4", "#059669", "#d97706", "#dc2626", "#0891b2", "#7c3aed"];
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

function InfoItem({ icon, label, truncate }: { icon: string; label: string; truncate?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          overflow: truncate ? "hidden" : "visible",
          textOverflow: truncate ? "ellipsis" : "unset",
          whiteSpace: truncate ? "nowrap" : "normal",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function TopClientesChart({ data }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
  const maxTotal = sorted[0]?.total ?? 1;

  return (
    <div style={{ height: 380, overflowY: "auto" }} className="custom-scroll">
      {sorted.map((cliente, i) => (
        <div
          key={`${cliente.nome}-${i}`}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          style={{
            padding: "10px 0",
            paddingLeft: hoveredIndex === i ? 8 : 0,
            borderBottom: "1px solid var(--border-subtle)",
            cursor: "default",
            transition: "background 0.15s, padding-left 0.15s",
            borderRadius: 8,
            background: hoveredIndex === i ? "rgba(0,229,255,0.03)" : "transparent",
          }}
        >
          {/* Linha principal */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                background: getAvatarColor(cliente.nome),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {initials(cliente.nome)}
            </div>

            {/* Nome + barra */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 200,
                  }}
                  title={cliente.nome}
                >
                  {cliente.nome}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    flexShrink: 0,
                    background:
                      cliente.tipoPessoa === "PJ"
                        ? "rgba(124,58,237,0.15)"
                        : "rgba(0,229,255,0.10)",
                    color: cliente.tipoPessoa === "PJ" ? "#a78bfa" : "#00e5ff",
                  }}
                >
                  {cliente.tipoPessoa}
                </span>
              </div>

              {/* Barra de progresso */}
              <div
                style={{
                  marginTop: 4,
                  height: 3,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: `${(cliente.total / maxTotal) * 100}%`,
                    height: "100%",
                    borderRadius: 2,
                    background: "linear-gradient(90deg, #7c3aed, rgba(124,58,237,0.3))",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>

            {/* Valor */}
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                flexShrink: 0,
                fontFamily: "DM Serif Display, serif",
              }}
            >
              {formatCurrencyBRL(cliente.total)}
            </span>
          </div>

          {/* Painel hover */}
          {hoveredIndex === i && (
            <div
              style={{
                marginTop: 10,
                marginLeft: 42,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px 16px",
                animation: "fadeInUp 0.15s ease-out",
              }}
            >
              {cliente.cidade && (
                <InfoItem
                  icon="📍"
                  label={`${cliente.cidade}${cliente.estado ? ` - ${cliente.estado}` : ""}`}
                />
              )}
              {cliente.telefone && <InfoItem icon="📱" label={cliente.telefone} />}
              {cliente.email && <InfoItem icon="✉️" label={cliente.email} truncate />}
              {cliente.cnpjCpf && <InfoItem icon="🪪" label={formatDoc(cliente.cnpjCpf)} />}
              <InfoItem
                icon="🛒"
                label={`${cliente.compras} compra${cliente.compras > 1 ? "s" : ""}`}
              />
              <InfoItem icon="📅" label={`Última: ${formatData(cliente.ultimaCompra)}`} />
              <InfoItem
                icon="💰"
                label={`Ticket médio: ${formatCurrencyBRL(cliente.ticketMedio)}`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

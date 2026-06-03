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

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatData(data: string): string {
  if (!data) return "";

  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

function getAvatarColor(nome: string): string {
  const cores = ["#7c3aed", "#1a6fd4", "#059669", "#d97706", "#0891b2", "#be185d"];
  let hash = 0;

  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }

  return cores[Math.abs(hash) % cores.length];
}

function getIniciais(nome: string): string {
  const partes = nome.split(" ").filter(Boolean).slice(0, 2);
  return partes.map((parte) => parte[0]).join("").toUpperCase();
}

function getRankColor(index: number): string {
  if (index === 0) return "#f59e0b";
  if (index === 1) return "#94a3b8";
  if (index === 2) return "#a78bfa";
  return "#475569";
}

export function TopClientesChart({ data }: { data: ClienteItem[] }) {
  const [expandido, setExpandido] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  const clientes = [...data].sort((a, b) => b.total - a.total);
  const maxTotal = clientes[0]?.total ?? 1;

  return (
    <div className="custom-scroll" style={{ height: "280px", overflowY: "auto", paddingRight: "4px" }}>
      {clientes.map((cliente, i) => {
        const isExpanded = expandido === i;
        const progresso = maxTotal > 0 ? Math.min((cliente.total / maxTotal) * 100, 100) : 0;
        const localizacao = [cliente.cidade, cliente.estado].filter(Boolean).join(" - ");
        const ultimaCompra = formatData(cliente.ultimaCompra);
        const comprasTexto = `${cliente.compras} compra${cliente.compras !== 1 ? "s" : ""}`;

        return (
          <div
            key={`${cliente.nome}-${i}`}
            onMouseEnter={() => setExpandido(i)}
            onMouseLeave={() => setExpandido(null)}
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              paddingBottom: "6px",
              marginBottom: "5px",
              cursor: "default",
            }}
          >
            {/* Linha principal do ranking */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  minWidth: "20px",
                  color: getRankColor(i),
                }}
              >
                #{i + 1}
              </span>

              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: getAvatarColor(cliente.nome),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {getIniciais(cliente.nome)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span
                    title={cliente.nome}
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "clamp(100px, 35vw, 200px)",
                    }}
                  >
                    {cliente.nome}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      flexShrink: 0,
                      background:
                        cliente.tipoPessoa === "PJ" ? "rgba(124,58,237,0.2)" : "rgba(0,229,255,0.12)",
                      color: cliente.tipoPessoa === "PJ" ? "#a78bfa" : "#00e5ff",
                      fontWeight: 500,
                    }}
                  >
                    {cliente.tipoPessoa}
                  </span>
                </div>

                <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
                  <div
                    style={{
                      width: `${progresso}%`,
                      height: "100%",
                      borderRadius: "1px",
                      background: "linear-gradient(90deg, #7c3aed 0%, rgba(124,58,237,0.2) 100%)",
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
              </div>

              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  flexShrink: 0,
                  fontFamily: "var(--font-inter, Inter, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatMoeda(cliente.total)}
              </span>
            </div>

            <div
              style={{
                maxHeight: isExpanded ? "220px" : "0px",
                opacity: isExpanded ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 0.2s ease-out, opacity 0.2s ease-out",
              }}
            >
              <div
                style={{
                  marginTop: "8px",
                  marginLeft: "60px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  borderLeft: "2px solid var(--accent-cyan)",
                  background: "rgba(0,229,255,0.04)",
                }}
              >
                {/* Lista vertical do hover */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {localizacao && <InfoLinha icon="📍" texto={localizacao} />}
                  {cliente.telefone && <InfoLinha icon="📱" texto={cliente.telefone} />}
                  {cliente.email && <InfoLinha icon="✉️" texto={cliente.email} />}
                  {cliente.cnpjCpf && <InfoLinha icon="🪪" texto={formatDoc(cliente.cnpjCpf)} />}
                  <InfoLinha
                    icon="🛒"
                    texto={ultimaCompra ? `${comprasTexto}  |  Última: ${ultimaCompra}` : comprasTexto}
                  />
                  <InfoLinha icon="💰" texto={`Ticket médio: ${formatMoeda(cliente.ticketMedio)}`} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoLinha({ icon, texto }: { icon: string; texto: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <span style={{ fontSize: "16px", lineHeight: "1.4", flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        {texto}
      </span>
    </div>
  );
}

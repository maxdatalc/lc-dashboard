"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, CreditCard, ShoppingCart, Wallet, ChevronDown, X } from "lucide-react";

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
  return partes.map((p) => p[0]).join("").toUpperCase();
}

function getRankColor(index: number): string {
  if (index === 0) return "#f59e0b";
  if (index === 1) return "#94a3b8";
  if (index === 2) return "#a78bfa";
  return "var(--text-muted)";
}

function InfoLinha({ icon: Icon, texto }: { icon: React.ElementType; texto: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <Icon
        style={{
          width: 13,
          height: 13,
          flexShrink: 0,
          marginTop: 1,
          color: "var(--text-muted)",
        }}
      />
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

export function TopClientesChart({
  data,
  onSelect,
  selectedNome,
}: {
  data: ClienteItem[];
  onSelect?: (nome: string | null) => void;
  selectedNome?: string | null;
}) {
  const [expandido, setExpandido] = useState<number | null>(null);

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

  const clientes = [...data].sort((a, b) => b.total - a.total);
  const maxTotal = clientes[0]?.total ?? 1;

  return (
    <div>
      {/* Hint bar — mesma altura que o toggle Valor/Qtd do TopProdutos */}
      <div style={{ marginBottom: "12px", height: "28px", display: "flex", alignItems: "center" }}>
        {selectedNome && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Filtro ativo:{" "}
            <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
              {selectedNome.length > 30 ? selectedNome.slice(0, 30) + "…" : selectedNome}
            </span>
          </span>
        )}
      </div>

      <div
        className="custom-scroll"
        style={{ height: "210px", overflowY: "auto", paddingRight: "4px" }}
      >
        {clientes.map((cliente, i) => {
          const isExpanded = expandido === i;
          const isSelected = selectedNome === cliente.nome;
          const progresso = maxTotal > 0 ? Math.min((cliente.total / maxTotal) * 100, 100) : 0;
          const localizacao = [cliente.cidade, cliente.estado].filter(Boolean).join(" — ");
          const ultimaCompra = formatData(cliente.ultimaCompra);
          const comprasTexto = `${cliente.compras} compra${cliente.compras !== 1 ? "s" : ""}`;

          return (
            <div
              key={`${cliente.nome}-${i}`}
              onClick={() => {
                if (isSelected) {
                  onSelect?.(null);
                } else {
                  setExpandido(null);
                  onSelect?.(cliente.nome);
                }
              }}
              style={{
                position: "relative",
                borderRadius: isSelected ? "6px" : "0",
                padding: "6px 8px",
                marginBottom: "4px",
                cursor: onSelect ? "pointer" : "default",
                background: isSelected ? "rgba(0,229,255,0.06)" : "transparent",
                ...(isSelected
                  ? { border: "1px solid rgba(0,229,255,0.25)" }
                  : { border: "1px solid transparent", borderBottom: "1px solid var(--chart-item-border)" }),
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {/* X button when selected */}
              {isSelected && onSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "rgba(239,68,68,0.18)",
                    color: "#ef4444",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <X size={10} />
                </button>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    minWidth: "20px",
                    color: getRankColor(i),
                    fontFamily: "var(--font-numeric)",
                  }}
                >
                  {i + 1}
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
                          cliente.tipoPessoa === "PJ"
                            ? "rgba(124,58,237,0.15)"
                            : "rgba(8,145,178,0.12)",
                        color:
                          cliente.tipoPessoa === "PJ"
                            ? "#a78bfa"
                            : "var(--accent-cyan)",
                        fontWeight: 500,
                      }}
                    >
                      {cliente.tipoPessoa}
                    </span>
                  </div>

                  <div
                    style={{
                      height: "3px",
                      background: "var(--chart-track-bg)",
                      borderRadius: "2px",
                    }}
                  >
                    <div
                      style={{
                        width: `${progresso}%`,
                        height: "100%",
                        borderRadius: "2px",
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
                    fontFamily: "var(--font-numeric)",
                    whiteSpace: "nowrap",
                    marginRight: isSelected ? "20px" : "0",
                  }}
                >
                  {formatMoeda(cliente.total)}
                </span>

                {/* Chevron para expandir detalhes (escondido quando selecionado) */}
                {!isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandido(isExpanded ? null : i);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <ChevronDown
                      style={{
                        width: 12,
                        height: 12,
                        color: "var(--text-muted)",
                        transition: "transform 0.2s ease",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                )}
              </div>

              {/* Painel de detalhes */}
              <div
                style={{
                  maxHeight: isExpanded && !isSelected ? "220px" : "0px",
                  opacity: isExpanded && !isSelected ? 1 : 0,
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {localizacao && <InfoLinha icon={MapPin} texto={localizacao} />}
                    {cliente.telefone && <InfoLinha icon={Phone} texto={cliente.telefone} />}
                    {cliente.email && <InfoLinha icon={Mail} texto={cliente.email} />}
                    {cliente.cnpjCpf && (
                      <InfoLinha icon={CreditCard} texto={formatDoc(cliente.cnpjCpf)} />
                    )}
                    <InfoLinha
                      icon={ShoppingCart}
                      texto={
                        ultimaCompra
                          ? `${comprasTexto}  ·  Última: ${ultimaCompra}`
                          : comprasTexto
                      }
                    />
                    <InfoLinha
                      icon={Wallet}
                      texto={`Ticket médio: ${formatMoeda(cliente.ticketMedio)}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

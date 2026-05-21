"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface VendaRow {
  id: string;
  external_id: string | number;
  loja_id: string;
  data_venda: string;
  valor_total: number | null;
  status: string | null;
  cfop: number | null;
  cliente_nome: string | null;
}

interface DrillDownData {
  itens: Array<{
    produto_nome: string | null;
    quantidade: number | null;
    valor_unitario: number | null;
    valor_total: number | null;
    desconto: number | null;
  }>;
  pagamentos: Array<{
    forma_pagamento: string | null;
    valor: number | null;
    parcelas: number | null;
  }>;
}

interface TabelaVendasProps {
  lojaIds: string[];
  period: string;
  start?: string;
  end?: string;
}

function formatCurrency(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    finalizada: { label: "Finalizada", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    cancelada:  { label: "Cancelada",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
    pendente:   { label: "Pendente",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  };
  const s = map[status ?? ""] ?? { label: status ?? "—", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function TipoLabel({ cfop }: { cfop: number | null }) {
  if (cfop == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const prefix = Math.floor(cfop / 1000);
  if (prefix === 5 || prefix === 6) return <span style={{ color: "#10b981" }}>Venda</span>;
  if (prefix >= 1 && prefix <= 3) return <span style={{ color: "#ef4444" }}>Devolução</span>;
  return <span style={{ color: "var(--text-muted)" }}>{cfop}</span>;
}

export function TabelaVendas({ lojaIds, period, start, end }: TabelaVendasProps) {
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<Record<string, DrillDownData | null>>({});

  const fetchVendas = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lojaIds: lojaIds.join(","),
        period,
        page: String(page),
      });
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      if (search) params.set("search", search);
      if (statusFiltro) params.set("status", statusFiltro);
      if (tipoFiltro) params.set("tipo", tipoFiltro);

      const res = await fetch(`/api/dashboard/vendas?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        vendas: VendaRow[];
        total: number;
        totalPages: number;
      };
      setVendas(data.vendas);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("[TabelaVendas]", err);
    } finally {
      setLoading(false);
    }
  }, [lojaIds, period, start, end, page, search, statusFiltro, tipoFiltro]);

  useEffect(() => {
    void fetchVendas();
  }, [fetchVendas]);

  // Reiniciar para página 1 quando filtros mudarem
  useEffect(() => {
    setPage(1);
  }, [lojaIds, period, start, end, search, statusFiltro, tipoFiltro]);

  const handleRowClick = async (
    rowKey: string,
    externalId: string | number,
    lojaId: string,
  ) => {
    // Colapsar linha já aberta
    if (expandedId === rowKey) {
      setExpandedId(null);
      return;
    }

    setExpandedId(rowKey);
    setDrillLoading(rowKey);
    setDrillData((prev) => ({ ...prev, [rowKey]: null }));

    try {
      const res = await fetch(
        `/api/dashboard/vendas/${externalId}?lojaId=${lojaId}`,
      );
      if (!res.ok) throw new Error("Erro ao buscar detalhes");
      const data = (await res.json()) as DrillDownData;
      setDrillData((prev) => ({ ...prev, [rowKey]: data }));
    } catch (err) {
      console.error("[TabelaVendas] erro drill-down:", err);
      setDrillData((prev) => ({
        ...prev,
        [rowKey]: { itens: [], pagamentos: [] },
      }));
    } finally {
      setDrillLoading(null);
    }
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? "rgba(0,229,255,0.12)" : "transparent",
    color: active ? "#00e5ff" : "var(--text-muted)",
    border: `1px solid ${active ? "rgba(0,229,255,0.3)" : "var(--border-subtle)"}`,
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Busca */}
        <div
          className="flex items-center gap-2 px-3 rounded-lg flex-1"
          style={{
            backgroundColor: "var(--bg-card-hover)",
            border: "1px solid var(--border-subtle)",
            minWidth: 180,
            height: 34,
          }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-xs flex-1"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        {/* Filtro status */}
        {(["", "finalizada", "cancelada"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterBtnStyle(statusFiltro === s)}
          >
            {s === "" ? "Todos" : s === "finalizada" ? "Finalizadas" : "Canceladas"}
          </button>
        ))}

        {/* Filtro tipo */}
        {(["", "venda", "devolucao"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipoFiltro(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterBtnStyle(tipoFiltro === t)}
          >
            {t === "" ? "Todos tipos" : t === "venda" ? "Vendas" : "Devoluções"}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        {/* Cabeçalho */}
        <div
          className="grid text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5"
          style={{
            gridTemplateColumns: "1fr 130px 80px 100px 24px",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span>Cliente</span>
          <span>Data</span>
          <span>Tipo</span>
          <span className="text-right">Valor</span>
          <span />
        </div>

        {/* Linhas */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : vendas.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>
            Nenhuma venda encontrada.
          </div>
        ) : (
          vendas.map((venda) => {
            const rowKey = `${venda.loja_id}-${venda.external_id}`;
            const isExpanded = expandedId === rowKey;
            const drillRow = drillData[rowKey];

            return (
              <div key={rowKey} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {/* Linha principal */}
                <div
                  className="grid items-center px-4 py-2.5 cursor-pointer transition-colors"
                  style={{
                    gridTemplateColumns: "1fr 130px 80px 100px 24px",
                    backgroundColor: isExpanded ? "rgba(0,229,255,0.03)" : "transparent",
                  }}
                  onClick={() => void handleRowClick(rowKey, venda.external_id, venda.loja_id)}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {venda.cliente_nome ?? "—"}
                    </span>
                    <StatusBadge status={venda.status} />
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(venda.data_venda)}
                  </span>
                  <span className="text-xs">
                    <TipoLabel cfop={venda.cfop} />
                  </span>
                  <span
                    className="text-xs font-semibold tabular-nums text-right"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatCurrency(venda.valor_total)}
                  </span>
                  <div className="flex justify-end" style={{ color: "var(--text-muted)" }}>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>

                {/* Drill-down */}
                {isExpanded && (
                  <div
                    className="px-4"
                    style={{
                      backgroundColor: "rgba(0,229,255,0.02)",
                      borderTop: "1px solid rgba(0,229,255,0.07)",
                    }}
                  >
                    {drillLoading === rowKey ? (
                      /* Loading spinner enquanto busca */
                      <div className="flex items-center gap-2 py-4">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: "var(--accent-cyan)" }}
                        />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Carregando detalhes...
                        </span>
                      </div>
                    ) : drillRow ? (
                      /* Conteúdo expandido */
                      <div className="flex gap-6 py-3">
                        {/* Itens */}
                        {(drillRow?.itens?.length ?? 0) > 0 && (
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Itens
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {(drillRow?.itens ?? []).map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                                    {item.produto_nome ?? "—"}
                                  </span>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    ×{item.quantidade ?? 1}
                                  </span>
                                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                                    {formatCurrency(item.valor_total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pagamentos */}
                        {(drillRow?.pagamentos?.length ?? 0) > 0 && (
                          <div className="flex-shrink-0" style={{ minWidth: 180 }}>
                            <p
                              className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Pagamentos
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {(drillRow?.pagamentos ?? []).map((pag, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                                    {pag.forma_pagamento ?? "—"}
                                    {pag.parcelas && pag.parcelas > 1 ? ` (${pag.parcelas}×)` : ""}
                                  </span>
                                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                                    {formatCurrency(pag.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(drillRow?.itens?.length ?? 0) === 0 &&
                          (drillRow?.pagamentos?.length ?? 0) === 0 && (
                            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
                              Sem detalhes disponíveis.
                            </p>
                          )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {total} {total === 1 ? "venda" : "vendas"}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{
                backgroundColor: "var(--bg-card-hover)",
                color: page === 1 ? "var(--text-muted)" : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
                opacity: page === 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs px-2" style={{ color: "var(--text-secondary)" }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{
                backgroundColor: "var(--bg-card-hover)",
                color: page === totalPages ? "var(--text-muted)" : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
                opacity: page === totalPages ? 0.4 : 1,
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

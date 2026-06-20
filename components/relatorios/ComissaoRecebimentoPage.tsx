"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText as FilePdf,
  Loader2,
  Receipt,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import type { ComissaoRow } from "@/app/api/relatorios/comissao-recebimento/route";

// ─── Tipos de pagamento ──────────────────────────────────────────────────────

export const PAYMENT_TYPES = [
  { key: "vista_0", label: "Dinheiro",       group: "vista" as const, defaultRate: 2.0 },
  { key: "vista_1", label: "Cheque à Vista", group: "vista" as const, defaultRate: 1.5 },
  { key: "vista_2", label: "Cartão Débito",  group: "vista" as const, defaultRate: 1.5 },
  { key: "vista_3", label: "Depósito",       group: "vista" as const, defaultRate: 1.5 },
  { key: "vista_4", label: "Dep./PIX",       group: "vista" as const, defaultRate: 2.0 },
  { key: "prazo_0", label: "Cartão Crédito", group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_1", label: "Cheque Pré",     group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_2", label: "Carteira",       group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_3", label: "Boleto",         group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_4", label: "Vale",           group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_5", label: "Cheque Dev.",    group: "prazo" as const, defaultRate: 0.0 },
  { key: "prazo_6", label: "Débito Conta",   group: "prazo" as const, defaultRate: 1.5 },
  { key: "prazo_7", label: "Custódia",       group: "prazo" as const, defaultRate: 1.5 },
] as const;

const STORAGE_KEY = "lc_comissao_rates";

const DEFAULT_RATES = Object.fromEntries(
  PAYMENT_TYPES.map((pt) => [pt.key, pt.defaultRate])
);

function getPaymentKey(tipoVista: number | null, tipoPrazo: number | null): string {
  if (tipoVista !== null && tipoVista >= 0) return `vista_${tipoVista}`;
  if (tipoPrazo !== null && tipoPrazo >= 0) return `prazo_${tipoPrazo}`;
  return "outro";
}

function loadRates(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_RATES, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_RATES };
}

function saveRates(rates: Record<string, number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rates)); } catch {}
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtPct(v: number) {
  return `${v.toFixed(2).replace(".", ",")}%`;
}

// ─── Helpers de data ─────────────────────────────────────────────────────────

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Componente: multi-select de vendedores ───────────────────────────────────

interface Vendedor {
  VendedorId: number;
  Nome: string;
}

function VendedoresSelect({
  vendedores,
  selecionados,
  onChange,
}: {
  vendedores: Vendedor[];
  selecionados: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (id: number) => {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((s) => s !== id)
        : [...selecionados, id]
    );
  };

  const label =
    selecionados.length === 0
      ? "Todos os vendedores"
      : selecionados.length === 1
      ? vendedores.find((v) => v.VendedorId === selecionados[0])?.Nome ?? "1 vendedor"
      : `${selecionados.length} vendedores`;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 200 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderRadius: 8,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
          {label}
        </span>
        <ChevronDown style={{ width: 13, height: 13, color: "var(--text-muted)" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 50,
            padding: "4px 0",
          }}
        >
          <button
            type="button"
            onClick={() => onChange([])}
            style={{
              width: "100%",
              padding: "6px 12px",
              textAlign: "left",
              fontSize: 12,
              color: selecionados.length === 0 ? "var(--accent-cyan)" : "var(--text-secondary)",
              background: "transparent",
              cursor: "pointer",
              fontWeight: selecionados.length === 0 ? 600 : 400,
            }}
          >
            Todos
          </button>
          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "2px 0" }} />
          {vendedores.map((v) => {
            const selected = selecionados.includes(v.VendedorId);
            return (
              <button
                key={v.VendedorId}
                type="button"
                onClick={() => toggle(v.VendedorId)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: selected ? "var(--accent-cyan)" : "var(--text-secondary)",
                  background: selected ? "var(--sidebar-item-active-bg)" : "transparent",
                  cursor: "pointer",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: `1px solid ${selected ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                    background: selected ? "var(--accent-cyan)" : "transparent",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {v.Nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componente: configurador de comissões ────────────────────────────────────

function ComissaoConfig({
  rates,
  onChange,
}: {
  rates: Record<string, number>;
  onChange: (key: string, value: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const vista = PAYMENT_TYPES.filter((p) => p.group === "vista");
  const prazo = PAYMENT_TYPES.filter((p) => p.group === "prazo");

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "var(--bg-card)",
          color: "var(--text-secondary)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SlidersHorizontal style={{ width: 14, height: 14 }} />
          Configurar % de comissão por forma de pagamento
        </span>
        {open ? (
          <ChevronUp style={{ width: 13, height: 13 }} />
        ) : (
          <ChevronDown style={{ width: 13, height: 13 }} />
        )}
      </button>

      {open && (
        <div
          style={{
            padding: "12px 14px 16px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-subtle, var(--bg-card))",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 24px",
          }}
        >
          {/* À Vista */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              À Vista
            </p>
            {vista.map((pt) => (
              <div key={pt.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{pt.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={rates[pt.key] ?? pt.defaultRate}
                    onChange={(e) => onChange(pt.key, parseFloat(e.target.value) || 0)}
                    style={{
                      width: 58,
                      height: 28,
                      padding: "0 6px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>%</span>
                </div>
              </div>
            ))}
          </div>

          {/* A Prazo */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              A Prazo
            </p>
            {prazo.map((pt) => (
              <div key={pt.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{pt.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={rates[pt.key] ?? pt.defaultRate}
                    onChange={(e) => onChange(pt.key, parseFloat(e.target.value) || 0)}
                    style={{
                      width: 58,
                      height: 28,
                      padding: "0 6px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type EnrichedRow = ComissaoRow & {
  PaymentKey: string;
  PercentualAplicado: number;
  ComissaoPaga: number;
};

export default function ComissaoRecebimentoPage() {
  const { lojasDisponiveis } = useLoja();

  // Loja local: auto-seleciona se só tem uma disponível
  const [lojaId, setLojaId] = useState<string>("");

  useEffect(() => {
    if (lojasDisponiveis.length === 1) setLojaId(lojasDisponiveis[0].id);
  }, [lojasDisponiveis]);

  const [start, setStart]     = useState(firstDayOfMonth);
  const [end, setEnd]         = useState(today);
  const [vendedores, setVendedores]     = useState<Vendedor[]>([]);
  const [vendedoresSel, setVendedoresSel] = useState<number[]>([]);
  const [rates, setRates]     = useState<Record<string, number>>({});
  const [rows, setRows]       = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Hydrate rates from localStorage
  useEffect(() => { setRates(loadRates()); }, []);

  // Fetch vendedores when loja changes
  useEffect(() => {
    if (!lojaId) return;
    setVendedoresSel([]);
    setVendedores([]);
    fetch(`/api/relatorios/vendedores?lojaIds=${lojaId}`)
      .then((r) => r.json())
      .then((data) => setVendedores(Array.isArray(data) ? data : []))
      .catch(() => setVendedores([]));
  }, [lojaId]);

  const handleRateChange = useCallback((key: string, value: number) => {
    setRates((prev) => {
      const next = { ...prev, [key]: value };
      saveRates(next);
      return next;
    });
  }, []);

  const enrich = useCallback(
    (rawRows: ComissaoRow[]): EnrichedRow[] =>
      rawRows.map((row) => {
        const key = getPaymentKey(row.TipoVista, row.TipoPrazo);
        const pct = (rates[key] ?? 0) / 100;
        const baseTotal = row.ValorTotalVenda > 0 ? row.ValorTotalVenda : 1;
        const proporcao = (row.BaseCalculoComissao * pct) / baseTotal;
        const comissao = Math.round(row.ValorRecebidoLiquido * proporcao * 100) / 100;
        return {
          ...row,
          PaymentKey: key,
          PercentualAplicado: (rates[key] ?? 0),
          ComissaoPaga: comissao,
        };
      }),
    [rates]
  );

  // Re-enrich whenever rates change (without re-fetching)
  const enrichedRows = enrich(
    rows.map(({ PaymentKey: _, PercentualAplicado: __, ComissaoPaga: ___, ...raw }) => raw as ComissaoRow)
  );

  const handleGerar = async () => {
    if (!lojaId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lojaIds: lojaId, start, end });
      if (vendedoresSel.length > 0) params.set("vendedorIds", vendedoresSel.join(","));

      const res = await fetch(`/api/relatorios/comissao-recebimento?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");

      setRows(enrich(data.rows ?? []));
      setGenerated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  // ── Totalizadores ────────────────────────────────────────────────────────
  const totalRecebido  = enrichedRows.reduce((s, r) => s + r.ValorRecebidoLiquido, 0);
  const totalComissao  = enrichedRows.reduce((s, r) => s + r.ComissaoPaga, 0);
  const totalVendas    = new Set(enrichedRows.map((r) => r.VendaId)).size;
  const pctMedio       = totalRecebido > 0 ? (totalComissao / totalRecebido) * 100 : 0;

  const multiVendedor  = new Set(enrichedRows.map((r) => r.VendedorId)).size > 1;

  // ── Exportação ───────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const periodLabel = `${start}_${end}`;

  const buildTableData = () => {
    const head = [
      "Data",
      ...(multiVendedor ? ["Vendedor"] : []),
      "Tipo",
      "Forma de Pagamento",
      "Valor Venda",
      "Base Comissão",
      "% Comissão",
      "Recebido Líq.",
      "Comissão",
    ];
    const body = enrichedRows.map((row) => [
      fmtData(row.DataPagamento),
      ...(multiVendedor ? [row.NomeVendedor] : []),
      row.TipoVenda,
      row.TipoPagamento,
      row.ValorTotalVenda,
      row.BaseCalculoComissao,
      row.PercentualAplicado,
      row.ValorRecebidoLiquido,
      row.ComissaoPaga,
    ]);
    return { head, body };
  };

  const handleExportXlsx = async () => {
    setExportOpen(false);
    const XLSX = await import("xlsx");
    const { body, head } = buildTableData();

    const wsData = [
      head,
      ...body,
      [],
      [
        "TOTAL",
        ...(multiVendedor ? [""] : []),
        "", "", "", "", "",
        totalRecebido,
        totalComissao,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Larguras das colunas
    ws["!cols"] = [
      { wch: 12 },
      ...(multiVendedor ? [{ wch: 22 }] : []),
      { wch: 8 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 13 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comissões");
    XLSX.writeFile(wb, `comissao-recebimento-${periodLabel}.xlsx`);
  };

  const handleExportPdf = async () => {
    setExportOpen(false);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Comissão por Recebimento", 14, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Período: ${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}`, 14, 23);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 29);
    doc.setTextColor(0);

    const { head, body } = buildTableData();
    const numColIdx = multiVendedor ? [4, 5, 6, 7, 8] : [3, 4, 5, 6, 7];
    const colStyles: Record<number, object> = {};
    numColIdx.forEach((i) => { colStyles[i] = { halign: "right" }; });
    // Comissão em negrito
    colStyles[numColIdx[numColIdx.length - 1]] = { halign: "right", fontStyle: "bold" };

    const bodyFormatted = body.map((row) =>
      row.map((cell, i) =>
        numColIdx.includes(i) && i !== numColIdx[numColIdx.length - 4]
          ? typeof cell === "number" ? fmtMoeda(cell) : cell
          : i === numColIdx[numColIdx.length - 4]
          ? `${(cell as number).toFixed(2).replace(".", ",")}%`
          : cell
      )
    );

    autoTable(doc, {
      head: [head],
      body: [
        ...bodyFormatted,
        [
          "TOTAL",
          ...(multiVendedor ? [""] : []),
          "", "", "", "", "",
          fmtMoeda(totalRecebido),
          fmtMoeda(totalComissao),
        ],
      ],
      startY: 34,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: colStyles,
      didDrawPage: () => {
        const pageCount = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
        doc.setFontSize(7.5);
        doc.setTextColor(150);
        doc.text(
          `Página ${pageCount}`,
          doc.internal.pageSize.getWidth() - 20,
          doc.internal.pageSize.getHeight() - 8
        );
        doc.setTextColor(0);
      },
    });

    doc.save(`comissao-recebimento-${periodLabel}.pdf`);
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200 }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Comissão por Recebimento
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Comissões calculadas sobre os valores efetivamente recebidos, por forma de pagamento
          </p>
        </div>

        {/* Botão exportar — só aparece com dados */}
        {generated && enrichedRows.length > 0 && (
          <div ref={exportRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              style={{
                height: 36,
                padding: "0 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Download style={{ width: 14, height: 14 }} />
              Exportar
              <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
            </button>

            {exportOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
                  overflow: "hidden",
                  zIndex: 50,
                  minWidth: 180,
                }}
              >
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <FileSpreadsheet style={{ width: 15, height: 15, color: "#22c55e" }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>Excel</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>.xlsx</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <FilePdf style={{ width: 15, height: 15, color: "#ef4444" }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>PDF</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>.pdf</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Linha de filtros */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          {/* Seletor de loja */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Loja
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Store
                style={{
                  position: "absolute",
                  left: 10,
                  width: 14,
                  height: 14,
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <select
                value={lojaId}
                onChange={(e) => setLojaId(e.target.value)}
                style={{
                  height: 36,
                  paddingLeft: 30,
                  paddingRight: 28,
                  borderRadius: 8,
                  border: `1px solid ${!lojaId ? "rgba(239,68,68,0.5)" : "var(--border-subtle)"}`,
                  background: "var(--bg-card)",
                  color: lojaId ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 13,
                  minWidth: 180,
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Selecione uma loja…</option>
                {lojasDisponiveis.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                style={{
                  position: "absolute",
                  right: 8,
                  width: 13,
                  height: 13,
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Data inicial */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Data inicial
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Data final */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Data final
            </label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Vendedores */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Vendedores
            </label>
            <VendedoresSelect
              vendedores={vendedores}
              selecionados={vendedoresSel}
              onChange={setVendedoresSel}
            />
          </div>

          {/* Botão gerar */}
          <button
            type="button"
            onClick={handleGerar}
            disabled={loading || !lojaId}
            style={{
              height: 36,
              padding: "0 20px",
              borderRadius: 8,
              background: (loading || !lojaId) ? "var(--sidebar-item-active-bg)" : "var(--accent-cyan)",
              color: (loading || !lojaId) ? "var(--text-muted)" : "#000",
              fontSize: 13,
              fontWeight: 600,
              cursor: (loading || !lojaId) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "none",
            }}
          >
            {loading ? (
              <>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                Gerando…
              </>
            ) : (
              "Gerar Relatório"
            )}
          </button>
        </div>

        {/* Config de comissões */}
        <ComissaoConfig rates={rates} onChange={handleRateChange} />
      </div>

      {/* ── Erro ─────────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Cards de resumo ───────────────────────────────────────────── */}
      {generated && enrichedRows.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            {
              label: "Total Recebido",
              value: fmtMoeda(totalRecebido),
              icon: <Receipt style={{ width: 16, height: 16 }} />,
            },
            {
              label: "Total de Comissão",
              value: fmtMoeda(totalComissao),
              icon: <TrendingUp style={{ width: 16, height: 16 }} />,
              accent: true,
            },
            {
              label: "% Médio",
              value: fmtPct(pctMedio),
              icon: <SlidersHorizontal style={{ width: 16, height: 16 }} />,
            },
            {
              label: "Vendas",
              value: String(totalVendas),
              icon: <Receipt style={{ width: 16, height: 16 }} />,
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${card.accent ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: card.accent ? "var(--accent-cyan)" : "var(--text-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                {card.icon}
                {card.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: card.accent ? "var(--accent-cyan)" : "var(--text-primary)",
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabela ────────────────────────────────────────────────────── */}
      {generated && (
        enrichedRows.length === 0 ? (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Nenhum recebimento encontrado no período.
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {[
                      "Data",
                      ...(multiVendedor ? ["Vendedor"] : []),
                      "Tipo Venda",
                      "Forma de Pagamento",
                      "Valor Venda",
                      "Base Comissão",
                      "% Comissão",
                      "Recebido Líquido",
                      "Comissão",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: h === "Data" || h === "Vendedor" || h === "Tipo Venda" || h === "Forma de Pagamento" ? "left" : "right",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrichedRows.map((row, idx) => (
                    <tr
                      key={row.RecebimentoId}
                      style={{
                        borderBottom: idx < enrichedRows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        background: idx % 2 === 0 ? "transparent" : "var(--sidebar-item-hover-bg, rgba(255,255,255,0.02))",
                      }}
                    >
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {fmtData(row.DataPagamento)}
                      </td>
                      {multiVendedor && (
                        <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                          {row.NomeVendedor}
                        </td>
                      )}
                      <td style={{ padding: "9px 14px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: row.TipoVenda === "OS"
                              ? "rgba(99,102,241,0.15)"
                              : "rgba(34,197,94,0.12)",
                            color: row.TipoVenda === "OS" ? "#818cf8" : "#4ade80",
                          }}
                        >
                          {row.TipoVenda}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {row.TipoPagamento}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtMoeda(row.ValorTotalVenda)}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtMoeda(row.BaseCalculoComissao)}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            color: row.PercentualAplicado > 0 ? "var(--accent-cyan)" : "var(--text-muted)",
                            fontWeight: row.PercentualAplicado > 0 ? 600 : 400,
                          }}
                        >
                          {fmtPct(row.PercentualAplicado)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtMoeda(row.ValorRecebidoLiquido)}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtMoeda(row.ComissaoPaga)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totais */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-subtle)" }}>
                    <td
                      colSpan={multiVendedor ? 7 : 6}
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Total ({enrichedRows.length} recebimentos)
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
                      {fmtMoeda(totalRecebido)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "var(--accent-cyan)", textAlign: "right", whiteSpace: "nowrap" }}>
                      {fmtMoeda(totalComissao)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

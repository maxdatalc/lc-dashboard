"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText as FilePdf,
  Loader2,
  Printer,
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

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EnrichedRow = ComissaoRow & {
  PaymentKey: string;
  PercentualAplicado: number;
  ValorProdutosRecebimento: number;
  ComissaoPaga: number;
  ValorLiquidoEmpresa: number;
};

type SaleGroup = {
  vendaId: number;
  tipoVenda: string;
  rows: EnrichedRow[];
  subtotalRecebido: number;
  subtotalComissao: number;
  subtotalLiquido: number;
};

type VendorGroup = {
  vendedorId: number;
  nome: string;
  saleGroups: SaleGroup[];
  subtotalRecebido: number;
  subtotalComissao: number;
  subtotalLiquido: number;
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ComissaoRecebimentoPage() {
  const { lojasDisponiveis } = useLoja();

  const [lojaId, setLojaId] = useState<string>("");

  useEffect(() => {
    if (lojasDisponiveis.length === 1) setLojaId(lojasDisponiveis[0].id);
  }, [lojasDisponiveis]);

  const [start, setStart]               = useState(firstDayOfMonth);
  const [end, setEnd]                   = useState(today);
  const [vendedores, setVendedores]     = useState<Vendedor[]>([]);
  const [vendedoresSel, setVendedoresSel] = useState<number[]>([]);
  const [rates, setRates]               = useState<Record<string, number>>({});
  const [rows, setRows]                 = useState<EnrichedRow[]>([]);
  const [loading, setLoading]           = useState(false);
  const [generated, setGenerated]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => { setRates(loadRates()); }, []);

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
        const totalVenda = row.ValorTotalVenda > 0 ? row.ValorTotalVenda : 0;
        const proporcaoPecas = totalVenda > 0 ? row.ValorPecasVenda / totalVenda : 0;
        const vlrProdutos = Math.round(row.ValorRecebidoLiquido * proporcaoPecas * 100) / 100;
        const comissao = row.SemVinculo ? 0 : Math.round(vlrProdutos * pct * 100) / 100;
        const vlrLiquido = Math.round((row.ValorRecebidoLiquido - comissao) * 100) / 100;
        return {
          ...row,
          PaymentKey: key,
          PercentualAplicado: rates[key] ?? 0,
          ValorProdutosRecebimento: vlrProdutos,
          ComissaoPaga: comissao,
          ValorLiquidoEmpresa: vlrLiquido,
        };
      }),
    [rates]
  );

  const enrichedRows = enrich(
    rows.map(({ PaymentKey: _, PercentualAplicado: __, ValorProdutosRecebimento: ___, ComissaoPaga: ____, ValorLiquidoEmpresa: _____, ...raw }) => raw as ComissaoRow)
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
  const totalRecebido = enrichedRows.reduce((s, r) => s + r.ValorRecebidoLiquido, 0);
  const totalComissao = enrichedRows.reduce((s, r) => s + r.ComissaoPaga, 0);
  const totalLiquido  = enrichedRows.reduce((s, r) => s + r.ValorLiquidoEmpresa, 0);
  const totalVendas   = new Set(enrichedRows.filter((r) => r.VendaId).map((r) => r.VendaId)).size;
  const pctMedio      = totalRecebido > 0 ? (totalComissao / totalRecebido) * 100 : 0;

  const multiVendedor = new Set(enrichedRows.map((r) => r.VendedorId)).size > 1;
  const semVinculoRows = enrichedRows.filter((r) => r.SemVinculo);
  const totalSemVinculoQtd   = semVinculoRows.length;
  const totalSemVinculoValor = semVinculoRows.reduce((s, r) => s + r.ValorRecebidoLiquido, 0);

  // ── Agrupamento por vendedor → por venda (sem vínculo separado) ──────────
  const vendorGroups = useMemo<VendorGroup[]>(() => {
    const normalRows = enrichedRows.filter((r) => !r.SemVinculo);
    const vendorMap = new Map<number, EnrichedRow[]>();
    normalRows.forEach((row) => {
      const k = row.VendedorId ?? -1;
      if (!vendorMap.has(k)) vendorMap.set(k, []);
      vendorMap.get(k)!.push(row);
    });
    return Array.from(vendorMap.entries()).map(([id, vRows]) => {
      // Agrupar por venda dentro do vendedor
      const saleMap = new Map<number, EnrichedRow[]>();
      vRows.forEach((row) => {
        const sk = row.VendaId ?? 0;
        if (!saleMap.has(sk)) saleMap.set(sk, []);
        saleMap.get(sk)!.push(row);
      });
      const saleGroups: SaleGroup[] = Array.from(saleMap.entries())
        .map(([vendaId, sRows]) => {
          const sorted = [...sRows].sort((a, b) => a.DataPagamento.localeCompare(b.DataPagamento) || a.RecebimentoId - b.RecebimentoId);
          return {
            vendaId,
            tipoVenda: sRows[0].TipoVenda ?? "",
            rows: sorted,
            subtotalRecebido: sRows.reduce((s, r) => s + r.ValorRecebidoLiquido, 0),
            subtotalComissao: sRows.reduce((s, r) => s + r.ComissaoPaga, 0),
            subtotalLiquido:  sRows.reduce((s, r) => s + r.ValorLiquidoEmpresa, 0),
          };
        })
        // Ordenar grupos pela data mais antiga da venda
        .sort((a, b) => a.rows[0].DataPagamento.localeCompare(b.rows[0].DataPagamento));

      return {
        vendedorId: id,
        nome: vRows[0].NomeVendedor ?? "Sem vendedor",
        saleGroups,
        subtotalRecebido: vRows.reduce((s, r) => s + r.ValorRecebidoLiquido, 0),
        subtotalComissao: vRows.reduce((s, r) => s + r.ComissaoPaga, 0),
        subtotalLiquido:  vRows.reduce((s, r) => s + r.ValorLiquidoEmpresa, 0),
      };
    });
  }, [enrichedRows]);

  // ── Expansão dos grupos ──────────────────────────────────────────────────
  const [openVendors, setOpenVendors] = useState<Set<number>>(new Set());
  // Vendas colapsadas dentro de um vendedor aberto (default: todas abertas)
  const [closedSales, setClosedSales] = useState<Set<string>>(new Set());
  const [openSemVinculo, setOpenSemVinculo] = useState(false);

  const toggleVendor = (id: number) =>
    setOpenVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSale = (vendedorId: number, vendaId: number) => {
    const key = `${vendedorId}-${vendaId}`;
    setClosedSales((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const lojaNome = lojasDisponiveis.find((l) => l.id === lojaId)?.name ?? "";

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

  // Colunas da tabela (sem Vendedor no corpo — está no cabeçalho do grupo)
  const TABLE_HEAD = [
    "Data",
    "Tipo",
    "Vlr. Venda",
    "Forma de Pgto",
    "Vlr. Recebido",
    "Vlr. Produtos",
    "Comissão %",
    "Vlr. Comissão",
    "Vlr. Líq.",
  ];

  const tipoLabel = (row: EnrichedRow) =>
    row.VendaId ? `${row.TipoVenda ?? ""} ${row.VendaId}` : "Sem vínculo";

  const rowToArray = (row: EnrichedRow) => [
    fmtData(row.DataPagamento),
    tipoLabel(row),
    row.SemVinculo ? "-" : fmtMoeda(row.ValorTotalVenda),
    row.TipoPagamento,
    fmtMoeda(row.ValorRecebidoLiquido),
    row.SemVinculo ? "-" : fmtMoeda(row.ValorProdutosRecebimento),
    fmtPct(row.PercentualAplicado),
    fmtMoeda(row.ComissaoPaga),
    fmtMoeda(row.ValorLiquidoEmpresa),
  ];

  // Carrega logo MaxData do public (null se não encontrada)
  const loadLogo = async (): Promise<string | null> => {
    try {
      const res = await fetch("/logmaxdataimp.png");
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // ── Geração do PDF — retrato, resumido ou detalhado ─────────────────────
  const buildPdf = async (mode: "resumido" | "detalhado") => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    // Retrato A4: 210 × 297mm — economiza papel
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const logo = await loadLogo();
    const LOGO_W = 44;
    const LOGO_H = 17;
    const TEXT_X = logo ? 14 + LOGO_W + 5 : 14;
    const HEADER_H = 30;
    const periodStr = `${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}`;
    const geradoEm = new Date().toLocaleDateString("pt-BR");

    const drawPageHeader = () => {
      if (logo) doc.addImage(logo, "PNG", 14, 6, LOGO_W, LOGO_H);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text("Comissão por Recebimento", TEXT_X, 13);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text(`Loja: ${lojaNome}`, TEXT_X, 19);
      doc.text(`Período: ${periodStr}   |   Gerado em: ${geradoEm}`, TEXT_X, 24);

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(14, HEADER_H, pageW - 14, HEADER_H);
      doc.setTextColor(0, 0, 0);
    };

    const drawPageNumber = () => {
      const pg = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${pg}`, pageW - 14, pageH - 6, { align: "right" });
      doc.setTextColor(0, 0, 0);
    };

    drawPageHeader();

    // ── RESUMIDO: tabela de totais por vendedor ────────────────────────────
    if (mode === "resumido") {
      const label = mode === "resumido" ? "RESUMO — COMISSÃO POR VENDEDOR" : "";
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(label, 14, HEADER_H + 7);

      if (multiVendedor) {
        const resumoHead = [["Vendedor", "Recebimentos", "Recebido Líquido", "Comissão"]];
        const resumoBody = vendorGroups.map((g) => {
          const totalRec = g.saleGroups.reduce((s, sg) => s + sg.rows.length, 0);
          return [g.nome, String(totalRec), fmtMoeda(g.subtotalRecebido), fmtMoeda(g.subtotalComissao)];
        });
        resumoBody.push([
          "TOTAL GERAL",
          String(enrichedRows.length),
          fmtMoeda(totalRecebido),
          fmtMoeda(totalComissao),
        ]);

        autoTable(doc, {
          head: resumoHead,
          body: resumoBody,
          startY: HEADER_H + 11,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: "center", cellWidth: 28 },
            2: { halign: "right", cellWidth: 40 },
            3: { halign: "right", fontStyle: "bold", cellWidth: 34 },
          },
          didDrawPage: drawPageNumber,
        });
      } else {
        const nomeVendedor = enrichedRows[0]?.NomeVendedor ?? "";
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`Vendedor: ${nomeVendedor}`, 14, HEADER_H + 16);

        autoTable(doc, {
          head: [["Recebimentos", "Recebido Líquido", "Comissão"]],
          body: [[String(enrichedRows.length), fmtMoeda(totalRecebido), fmtMoeda(totalComissao)]],
          startY: HEADER_H + 20,
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
          columnStyles: {
            0: { halign: "center", cellWidth: 36 },
            1: { halign: "right", cellWidth: 50 },
            2: { halign: "right", fontStyle: "bold", cellWidth: 50 },
          },
          didDrawPage: drawPageNumber,
        });
      }

      return doc;
    }

    // ── DETALHADO: todas as linhas agrupadas por vendedor ─────────────────
    // cols: 0=Data,1=Tipo,2=VlrVenda,3=FormaPgto,4=VlrRecebido,5=VlrProdutos,6=Comissao%,7=VlrComissao,8=VlrLiq
    const colStyles: Record<number, object> = {
      2: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
      8: { halign: "right", fontStyle: "bold" },
    };

    if (multiVendedor) {
      let curY = HEADER_H + 4;

      vendorGroups.forEach((group, gi) => {
        if (gi > 0) {
          doc.addPage();
          drawPageHeader();
          curY = HEADER_H + 4;
        }

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text(group.nome, 14, curY + 6);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        const allGroupRows = group.saleGroups.flatMap((sg) => sg.rows);
        doc.text(
          `${allGroupRows.length} recebimento${allGroupRows.length !== 1 ? "s" : ""}   |   Recebido: ${fmtMoeda(group.subtotalRecebido)}   |   Comissão: ${fmtMoeda(group.subtotalComissao)}   |   Líq.: ${fmtMoeda(group.subtotalLiquido)}`,
          14, curY + 11
        );
        doc.setTextColor(0, 0, 0);

        const bodyRows = [
          ...allGroupRows.map(rowToArray),
          [`Subtotal — ${group.nome}`, "", "", "", fmtMoeda(group.subtotalRecebido), "", "", fmtMoeda(group.subtotalComissao), fmtMoeda(group.subtotalLiquido)],
        ];

        autoTable(doc, {
          head: [TABLE_HEAD],
          body: bodyRows,
          startY: curY + 14,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: colStyles,
          didDrawPage: drawPageNumber,
        });

        curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      });

      // Total geral ao final
      if (curY + 12 > pageH - 15) { doc.addPage(); drawPageHeader(); curY = HEADER_H + 4; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text(
        `TOTAL GERAL (${enrichedRows.length} recebimentos)   |   Recebido: ${fmtMoeda(totalRecebido)}   |   Comissão: ${fmtMoeda(totalComissao)}   |   Líq.: ${fmtMoeda(totalLiquido)}`,
        14, curY + 6
      );

    } else {
      const nomeVendedor = enrichedRows[0]?.NomeVendedor ?? "";
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text(`Vendedor: ${nomeVendedor}`, 14, HEADER_H + 7);

      const bodyRows = [
        ...enrichedRows.map(rowToArray),
        [`TOTAL (${enrichedRows.length} recebimentos)`, "", "", "", fmtMoeda(totalRecebido), "", "", fmtMoeda(totalComissao), fmtMoeda(totalLiquido)],
      ];

      autoTable(doc, {
        head: [TABLE_HEAD],
        body: bodyRows,
        startY: HEADER_H + 12,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: colStyles,
        didDrawPage: drawPageNumber,
      });
    }

    return doc;
  };

  // ── Imprimir (dropdown resumido / detalhado) ──────────────────────────────
  const [printOpen, setPrintOpen]   = useState(false);
  const [printing, setPrinting]     = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (printRef.current && !printRef.current.contains(e.target as Node)) setPrintOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handlePrint = async (mode: "resumido" | "detalhado") => {
    setPrintOpen(false);
    setPrinting(true);
    try {
      const doc = await buildPdf(mode);
      doc.autoPrint();
      const blobUrl = URL.createObjectURL(doc.output("blob"));
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    } finally {
      setPrinting(false);
    }
  };

  const handleExportXlsx = async () => {
    setExportOpen(false);
    const XLSX = await import("xlsx");

    const wsData: (string | number)[][] = [];

    if (multiVendedor) {
      vendorGroups.forEach((group) => {
        const allGroupRows = group.saleGroups.flatMap((sg) => sg.rows);
        wsData.push([group.nome.toUpperCase()]);
        wsData.push(TABLE_HEAD);
        allGroupRows.forEach((row) => wsData.push(rowToArray(row)));
        wsData.push([
          `Subtotal — ${group.nome} (${allGroupRows.length} recebimentos)`,
          "", "", "", group.subtotalRecebido, "", "",
          group.subtotalComissao, group.subtotalLiquido,
        ]);
        wsData.push([]);
      });
      wsData.push([
        `TOTAL GERAL (${enrichedRows.length} recebimentos)`,
        "", "", "", totalRecebido, "", "",
        totalComissao, totalLiquido,
      ]);
    } else {
      wsData.push(TABLE_HEAD);
      enrichedRows.forEach((row) => wsData.push(rowToArray(row)));
      wsData.push([]);
      wsData.push([
        `TOTAL (${enrichedRows.length} recebimentos)`,
        "", "", "", totalRecebido, "", "",
        totalComissao, totalLiquido,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 14 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comissões");
    XLSX.writeFile(wb, `comissao-recebimento-${periodLabel}.xlsx`);
  };

  const handleExportPdf = async (mode: "resumido" | "detalhado") => {
    setExportOpen(false);
    const doc = await buildPdf(mode);
    doc.save(`comissao-recebimento-${mode}-${periodLabel}.pdf`);
  };

  // ── Células da tabela (reutilizado em flat e grouped) ─────────────────────
  const renderRowCells = (row: EnrichedRow) => {
    const isSem = row.SemVinculo === 1;
    const mutedColor = isSem ? "#f87171" : "var(--text-secondary)";
    return (
      <>
        {/* 1 — Data */}
        <td style={{ padding: "8px 12px", fontSize: 12, color: mutedColor, whiteSpace: "nowrap" }}>
          {fmtData(row.DataPagamento)}
        </td>
        {/* 2 — Tipo (OS/VE + número ou alerta) */}
        <td style={{ padding: "8px 12px" }}>
          {isSem ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
              Sem vínculo
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                background: row.TipoVenda === "OS" ? "rgba(99,102,241,0.15)" : "rgba(34,197,94,0.12)",
                color: row.TipoVenda === "OS" ? "#818cf8" : "#4ade80",
              }}>
                {row.TipoVenda}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.VendaId}</span>
            </span>
          )}
        </td>
        {/* 3 — Vlr. Venda */}
        <td style={{ padding: "8px 12px", fontSize: 12, color: isSem ? "#f87171" : "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
          {isSem ? "—" : fmtMoeda(row.ValorTotalVenda)}
        </td>
        {/* 4 — Forma de Pgto */}
        <td style={{ padding: "8px 12px", fontSize: 12, color: mutedColor, whiteSpace: "nowrap" }}>
          {row.TipoPagamento}
        </td>
        {/* 5 — Vlr. Recebido */}
        <td style={{ padding: "8px 12px", fontSize: 12, color: isSem ? "#f87171" : "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
          {fmtMoeda(row.ValorRecebidoLiquido)}
        </td>
        {/* 6 — Vlr. Produtos */}
        <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>
          {isSem ? "—" : fmtMoeda(row.ValorProdutosRecebimento)}
        </td>
        {/* 7 — Comissão % */}
        <td style={{ padding: "8px 12px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
          <span style={{ color: (!isSem && row.PercentualAplicado > 0) ? "var(--accent-cyan)" : "var(--text-muted)", fontWeight: (!isSem && row.PercentualAplicado > 0) ? 600 : 400 }}>
            {isSem ? "—" : fmtPct(row.PercentualAplicado)}
          </span>
        </td>
        {/* 8 — Vlr. Comissão */}
        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: isSem ? "var(--text-muted)" : "var(--accent-cyan)", textAlign: "right", whiteSpace: "nowrap" }}>
          {isSem ? "—" : fmtMoeda(row.ComissaoPaga)}
        </td>
        {/* 9 — Vlr. Líq. (empresa) */}
        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: isSem ? "#f87171" : "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
          {isSem ? fmtMoeda(row.ValorRecebidoLiquido) : fmtMoeda(row.ValorLiquidoEmpresa)}
        </td>
      </>
    );
  };

  return (
    <div className="comissao-page" style={{ padding: "24px" }}>

      {/* ── Cabeçalho de impressão (só aparece ao imprimir) ───────────── */}
      <div className="print-header" style={{ display: "none", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Comissão por Recebimento</h1>
            <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
              {lojaNome && `${lojaNome} — `}
              Período: {fmtData(start)} a {fmtData(end)}
            </p>
          </div>
          <p style={{ fontSize: 11, color: "#777", margin: 0 }}>
            Gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <hr style={{ margin: "12px 0", borderColor: "#ddd" }} />
      </div>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="no-print" style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Comissão por Recebimento
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Comissões calculadas sobre os valores efetivamente recebidos, por forma de pagamento
          </p>
        </div>

        {generated && enrichedRows.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Botão imprimir — dropdown resumido / detalhado */}
            <div ref={printRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => !printing && setPrintOpen((o) => !o)}
                disabled={printing}
                style={{
                  height: 36, padding: "0 14px",
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 8, border: "1px solid var(--border-subtle)",
                  background: "var(--bg-card)", color: printing ? "var(--text-muted)" : "var(--text-primary)",
                  fontSize: 13, fontWeight: 500, cursor: printing ? "not-allowed" : "pointer",
                  opacity: printing ? 0.7 : 1,
                }}
                onMouseEnter={(e) => { if (!printing) e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
              >
                {printing
                  ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                  : <Printer style={{ width: 14, height: 14 }} />}
                {printing ? "Gerando…" : "Imprimir"}
                {!printing && <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)" }} />}
              </button>

              {printOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0,
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
                  overflow: "hidden", zIndex: 50, minWidth: 190,
                }}>
                  {(["resumido", "detalhado"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handlePrint(mode)}
                      style={{
                        width: "100%", padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: 10,
                        fontSize: 13, color: "var(--text-primary)",
                        background: "transparent", cursor: "pointer", textAlign: "left",
                        borderBottom: mode === "resumido" ? "1px solid var(--border-subtle)" : "none",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Printer style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {mode === "resumido" ? "Resumido" : "Detalhado"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {mode === "resumido" ? "Totais por vendedor" : "Todas as vendas"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botão exportar */}
            <div ref={exportRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                style={{
                  height: 36, padding: "0 14px",
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 8, border: "1px solid var(--border-subtle)",
                  background: "var(--bg-card)", color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
              >
                <Download style={{ width: 14, height: 14 }} />
                Exportar
                <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
              </button>

              {exportOpen && (
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
                    overflow: "hidden", zIndex: 50, minWidth: 180,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleExportXlsx}
                    style={{
                      width: "100%", padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 13, color: "var(--text-primary)",
                      background: "transparent", cursor: "pointer",
                      textAlign: "left", borderBottom: "1px solid var(--border-subtle)",
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
                    onClick={() => handleExportPdf("resumido")}
                    style={{
                      width: "100%", padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 13, color: "var(--text-primary)",
                      background: "transparent", cursor: "pointer", textAlign: "left",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <FilePdf style={{ width: 15, height: 15, color: "#ef4444" }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>PDF Resumido</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Totais por vendedor</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportPdf("detalhado")}
                    style={{
                      width: "100%", padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 13, color: "var(--text-primary)",
                      background: "transparent", cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-item-hover-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <FilePdf style={{ width: 15, height: 15, color: "#ef4444" }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>PDF Detalhado</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Todas as vendas</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div
        className="no-print"
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: 16, marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          {/* Seletor de loja */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Loja</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Store style={{ position: "absolute", left: 10, width: 14, height: 14, color: "var(--text-muted)", pointerEvents: "none" }} />
              <select
                value={lojaId}
                onChange={(e) => setLojaId(e.target.value)}
                style={{
                  height: 36, paddingLeft: 30, paddingRight: 28, borderRadius: 8,
                  border: `1px solid ${!lojaId ? "rgba(239,68,68,0.5)" : "var(--border-subtle)"}`,
                  background: "var(--bg-card)",
                  color: lojaId ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 13, minWidth: 180, appearance: "none", cursor: "pointer",
                }}
              >
                <option value="">Selecione uma loja…</option>
                {lojasDisponiveis.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown style={{ position: "absolute", right: 8, width: 13, height: 13, color: "var(--text-muted)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Data inicial */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Data inicial</label>
            <input
              type="date" value={start} onChange={(e) => setStart(e.target.value)}
              style={{ height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
          </div>

          {/* Data final */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Data final</label>
            <input
              type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              style={{ height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
            />
          </div>

          {/* Vendedores */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Vendedores</label>
            <VendedoresSelect vendedores={vendedores} selecionados={vendedoresSel} onChange={setVendedoresSel} />
          </div>

          {/* Botão gerar */}
          <button
            type="button"
            onClick={handleGerar}
            disabled={loading || !lojaId}
            style={{
              height: 36, padding: "0 20px", borderRadius: 8,
              background: (loading || !lojaId) ? "var(--sidebar-item-active-bg)" : "var(--accent-cyan)",
              color: (loading || !lojaId) ? "var(--text-muted)" : "#000",
              fontSize: 13, fontWeight: 600,
              cursor: (loading || !lojaId) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, border: "none",
            }}
          >
            {loading ? (
              <>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                Gerando…
              </>
            ) : "Gerar Relatório"}
          </button>
        </div>

        <ComissaoConfig rates={rates} onChange={handleRateChange} />
      </div>

      {/* ── Erro ─────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="no-print"
          style={{
            padding: "12px 16px", borderRadius: 8,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171", fontSize: 13, marginBottom: 16,
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
            gap: 12, marginBottom: 16,
          }}
        >
          {[
            { label: "Total Recebido",    value: fmtMoeda(totalRecebido), icon: <Receipt style={{ width: 16, height: 16 }} /> },
            { label: "Total de Comissão", value: fmtMoeda(totalComissao), icon: <TrendingUp style={{ width: 16, height: 16 }} />, accent: true },
            { label: "Vlr. Líq. Empresa", value: fmtMoeda(totalLiquido),  icon: <TrendingUp style={{ width: 16, height: 16 }} /> },
            { label: "% Médio",           value: fmtPct(pctMedio),        icon: <SlidersHorizontal style={{ width: 16, height: 16 }} /> },
            { label: "Vendas/O.S.",        value: String(totalVendas),      icon: <Receipt style={{ width: 16, height: 16 }} /> },
            ...(totalSemVinculoQtd > 0 ? [{
              label: "Sem vínculo",
              value: `${totalSemVinculoQtd} (${fmtMoeda(totalSemVinculoValor)})`,
              icon: <Receipt style={{ width: 16, height: 16 }} />,
              alert: true,
            }] : []),
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${"alert" in card && card.alert ? "rgba(239,68,68,0.5)" : card.accent ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                borderRadius: 10, padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: "alert" in card && card.alert ? "#f87171" : card.accent ? "var(--accent-cyan)" : "var(--text-muted)",
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.05em", marginBottom: 6,
                }}
              >
                {card.icon}
                {card.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "alert" in card && card.alert ? "#f87171" : card.accent ? "var(--accent-cyan)" : "var(--text-primary)" }}>
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
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: 12, padding: "48px 24px",
              textAlign: "center", color: "var(--text-muted)", fontSize: 14,
            }}
          >
            Nenhum recebimento encontrado no período.
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: 12, overflow: "hidden",
            }}
          >
            <div className="relatorio-table-wrapper">
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>

              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {TABLE_HEAD.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: ["Vlr. Venda", "Vlr. Recebido", "Vlr. Produtos", "Comissão %", "Vlr. Comissão", "Vlr. Líq."].includes(h) ? "right" : "left",
                        fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* ── Vendedor único: mostra só grupos de venda, sem cabeçalho de vendedor ── */}
                {!multiVendedor && vendorGroups.flatMap((group) =>
                  group.saleGroups.flatMap((sg, sgIdx) => {
                    const saleKey = `${group.vendedorId}-${sg.vendaId}`;
                    const isSaleOpen = !closedSales.has(saleKey);
                    const sgBg = sgIdx % 2 === 0 ? "transparent" : "var(--sidebar-item-hover-bg, rgba(255,255,255,0.02))";
                    return [
                      <tr
                        key={`sg-${saleKey}`}
                        onClick={() => toggleSale(group.vendedorId, sg.vendaId)}
                        style={{ cursor: "pointer", borderTop: sgIdx > 0 ? "1px solid var(--border-subtle)" : "none", background: "var(--sidebar-item-active-bg)", userSelect: "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "brightness(1.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "none"; }}
                      >
                        <td colSpan={5} style={{ padding: "8px 12px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: sg.tipoVenda === "OS" ? "rgba(99,102,241,0.2)" : "rgba(34,197,94,0.15)", color: sg.tipoVenda === "OS" ? "#818cf8" : "#4ade80" }}>{sg.tipoVenda}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{sg.vendaId}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— {sg.rows.length} parcela{sg.rows.length !== 1 ? "s" : ""}</span>
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{fmtMoeda(sg.subtotalRecebido)}</td>
                        <td colSpan={2} style={{ padding: "8px 12px", fontSize: 11, color: "var(--accent-cyan)", textAlign: "right" }}>{fmtMoeda(sg.subtotalComissao)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtMoeda(sg.subtotalLiquido)}</span>
                            <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0, transform: isSaleOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                          </span>
                        </td>
                      </tr>,
                      ...(isSaleOpen ? sg.rows.map((row, rIdx) => (
                        <tr key={row.RecebimentoId} style={{ borderBottom: rIdx < sg.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: sgBg }}>
                          {renderRowCells(row)}
                        </tr>
                      )) : []),
                    ];
                  })
                )}

                {/* ── Multi-vendedor: grupos de vendedor ── */}
                {multiVendedor && vendorGroups.flatMap((group) => {
                  const isVendorOpen = openVendors.has(group.vendedorId);
                  const totalRows = group.saleGroups.reduce((s, sg) => s + sg.rows.length, 0);
                  return [
                    /* Linha-resumo do vendedor */
                    <tr
                      key={`vh-${group.vendedorId}`}
                      onClick={() => toggleVendor(group.vendedorId)}
                      style={{
                        cursor: "pointer",
                        borderTop: "1px solid var(--border-subtle)",
                        borderBottom: isVendorOpen ? "none" : "1px solid var(--border-subtle)",
                        background: "var(--sidebar-item-active-bg)",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "brightness(1.12)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "none"; }}
                    >
                      <td colSpan={7} style={{ padding: "10px 12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Users style={{ width: 13, height: 13, color: "var(--accent-cyan)", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{group.nome}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                            — {group.saleGroups.length} venda{group.saleGroups.length !== 1 ? "s" : ""} · {totalRows} recebimento{totalRows !== 1 ? "s" : ""}
                          </span>
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtMoeda(group.subtotalComissao)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmtMoeda(group.subtotalLiquido)}</span>
                          <ChevronDown style={{ width: 15, height: 15, color: "var(--text-muted)", flexShrink: 0, transform: isVendorOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                        </span>
                      </td>
                    </tr>,

                    /* Grupos de venda (dentro do vendedor expandido) */
                    ...(isVendorOpen ? group.saleGroups.flatMap((sg, sgIdx) => {
                      const saleKey = `${group.vendedorId}-${sg.vendaId}`;
                      const isSaleOpen = !closedSales.has(saleKey);
                      const sgBg = sgIdx % 2 === 0
                        ? "rgba(255,255,255,0.015)"
                        : "rgba(255,255,255,0.035)";
                      return [
                        /* Mini-cabeçalho da venda */
                        <tr
                          key={`sg-${saleKey}`}
                          onClick={() => toggleSale(group.vendedorId, sg.vendaId)}
                          style={{
                            cursor: "pointer",
                            borderTop: "1px solid var(--border-subtle)",
                            background: sgBg,
                            userSelect: "none",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "brightness(1.15)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "none"; }}
                        >
                          <td colSpan={5} style={{ padding: "6px 12px 6px 28px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                                background: sg.tipoVenda === "OS" ? "rgba(99,102,241,0.2)" : "rgba(34,197,94,0.15)",
                                color: sg.tipoVenda === "OS" ? "#818cf8" : "#4ade80",
                              }}>
                                {sg.tipoVenda}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{sg.vendaId}</span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                — {sg.rows.length} parcela{sg.rows.length !== 1 ? "s" : ""}
                              </span>
                            </span>
                          </td>
                          <td style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                            {fmtMoeda(sg.subtotalRecebido)}
                          </td>
                          <td colSpan={2} style={{ padding: "6px 12px", fontSize: 11, color: "var(--accent-cyan)", textAlign: "right" }}>
                            {fmtMoeda(sg.subtotalComissao)}
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtMoeda(sg.subtotalLiquido)}</span>
                              <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0, transform: isSaleOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                            </span>
                          </td>
                        </tr>,

                        /* Linhas de pagamento da venda */
                        ...(isSaleOpen ? sg.rows.map((row, rIdx) => (
                          <tr
                            key={row.RecebimentoId}
                            style={{
                              borderBottom: rIdx < sg.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "1px solid var(--border-subtle)",
                              background: sgBg,
                            }}
                          >
                            {renderRowCells(row)}
                          </tr>
                        )) : []),
                      ];
                    }) : []),
                  ];
                })}

                {/* ── Seção "Sem vínculo" ── */}
                {semVinculoRows.length > 0 && (
                  <>
                    <tr
                      onClick={() => setOpenSemVinculo((o) => !o)}
                      style={{
                        cursor: "pointer",
                        borderTop: "2px solid rgba(239,68,68,0.4)",
                        borderBottom: openSemVinculo ? "none" : "1px solid rgba(239,68,68,0.3)",
                        background: "rgba(239,68,68,0.06)",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "brightness(1.1)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.filter = "none"; }}
                    >
                      <td colSpan={7} style={{ padding: "10px 12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>Sem vínculo de venda/O.S.</span>
                          <span style={{ fontSize: 11, color: "#f87171", opacity: 0.7 }}>
                            — {semVinculoRows.length} recebimento{semVinculoRows.length !== 1 ? "s" : ""}
                          </span>
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }} />
                      <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{fmtMoeda(totalSemVinculoValor)}</span>
                          <ChevronDown style={{ width: 15, height: 15, color: "#f87171", flexShrink: 0, transform: openSemVinculo ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                        </span>
                      </td>
                    </tr>
                    {openSemVinculo && semVinculoRows.map((row, idx) => (
                      <tr
                        key={row.RecebimentoId}
                        style={{
                          borderBottom: idx < semVinculoRows.length - 1 ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(239,68,68,0.3)",
                          background: "rgba(239,68,68,0.07)",
                        }}
                      >
                        {renderRowCells(row)}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>

              {/* Total geral */}
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-subtle)" }}>
                  <td colSpan={7} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {multiVendedor ? "Total Geral" : "Total"} ({enrichedRows.length} recebimentos)
                    {totalSemVinculoQtd > 0 && (
                      <span style={{ marginLeft: 12, color: "#f87171", fontSize: 11, fontWeight: 500, textTransform: "none" }}>
                        — {totalSemVinculoQtd} sem vínculo
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtMoeda(totalComissao)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtMoeda(totalLiquido)}
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

        @media print {
          @page { margin: 12mm 10mm; size: landscape; }

          aside,
          header,
          .no-print { display: none !important; }

          .print-header { display: flex !important; flex-direction: column; }

          body, html { background: white !important; }

          .comissao-page {
            margin-left: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }

          table { width: 100% !important; font-size: 10px !important; }

          td, th {
            padding: 5px 8px !important;
            color: black !important;
            border-color: #ccc !important;
          }

          thead tr { background: #f0f0f0 !important; }

          [style*="--accent-cyan"] { color: #0077aa !important; }
          [style*="--bg-card"] { background: white !important; }
          [style*="--sidebar-item-active-bg"] { background: #f5f5f5 !important; }
          [style*="--text-muted"] { color: #666 !important; }
          [style*="--text-secondary"] { color: #444 !important; }
          [style*="--text-primary"] { color: #111 !important; }
        }
      `}</style>
    </div>
  );
}

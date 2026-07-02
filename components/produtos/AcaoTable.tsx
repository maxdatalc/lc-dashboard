"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, X, Download, Flame } from "lucide-react";
import type { ProdutoAcao, StatusEstoque } from "@/lib/db/produtos-estoque";
import { STATUS_META, fmtMoeda, fmtInt, fmtPct, fmtGiroDias } from "./utils";

type SortKey = "nome" | "estoqueAtual" | "estoqueMinimo" | "diferenca" | "valorCusto" | "valorVenda" | "margemPct" | "status" | "giroDias" | "valorSugestao";
const PAGE_SIZE = 10;

function StatusBadge({ status, rupturaAtiva }: { status: StatusEstoque; rupturaAtiva?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1">
      {rupturaAtiva && (
        <Flame style={{ width: 12, height: 12, color: "#dc2626" }} aria-label="Ruptura ativa — vende e está zerado" />
      )}
      <span style={{
        display: "inline-block", fontSize: 10.5, fontWeight: 600, padding: "2px 8px",
        borderRadius: 999, background: m.bg, color: m.color, whiteSpace: "nowrap",
      }}>
        {m.label}
      </span>
    </span>
  );
}

function exportCsv(items: ProdutoAcao[]) {
  const head = ["Produto", "Codigo", "Marca", "Categoria", "Estoque", "Minimo", "Diferenca", "Giro (dias)", "Sugestao Compra", "Valor Sugestao", "Valor Custo", "Valor Venda", "Margem %", "Status"];
  const lines = [head.join(";")];
  for (const p of items) {
    lines.push([
      p.nome, p.codigo ?? "", p.marca, p.categoria, p.estoqueAtual.toFixed(0),
      p.estoqueMinimo?.toFixed(0) ?? "", p.diferenca?.toFixed(0) ?? "",
      p.giroDias?.toFixed(0) ?? "", p.sugestaoCompra?.toFixed(0) ?? "", p.valorSugestao?.toFixed(2) ?? "",
      p.valorCusto.toFixed(2), p.valorVenda.toFixed(2), p.margemPct?.toFixed(1) ?? "",
      STATUS_META[p.status].label,
    ].join(";"));
  }
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "produtos-exigem-acao.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AcaoTable({
  items, filiais,
}: {
  items: ProdutoAcao[];
  filiais: { empId: number; nome: string }[];
}) {
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [detalhe, setDetalhe] = useState<ProdutoAcao | null>(null);

  const multi = filiais.length > 1;
  const nomeLoja = (empId: number) => filiais.find((f) => f.empId === empId)?.nome ?? `Filial ${empId}`;

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    let arr = items;
    if (term) {
      arr = items.filter((p) =>
        p.nome.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term) ||
        (p.codigo ?? "").toLowerCase().includes(term));
    }
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      arr = [...arr].sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
        return ((av as number) - (bv as number)) * dir;
      });
    }
    return arr;
  }, [items, busca, sortKey, sortDir]);

  useEffect(() => { setPage(0); }, [busca, sortKey, sortDir, items]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "nome" || k === "status" ? "asc" : "desc"); }
  }

  const Th = ({ k, children, align = "left", w }: { k?: SortKey; children: React.ReactNode; align?: "left" | "right" | "center"; w?: number }) => (
    <th style={{
      padding: "8px 10px", textAlign: align, width: w,
      position: "sticky", top: 0, zIndex: 1,
      background: "var(--card-header-bg)", borderBottom: "1px solid var(--border-subtle)",
    }}>
      {k ? (
        <button type="button" onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 transition-colors"
          style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: sortKey === k ? "var(--accent-cyan)" : "var(--text-muted)", cursor: "pointer" }}>
          {children}
          <ArrowUpDown style={{ width: 11, height: 11, opacity: sortKey === k ? 1 : 0.4 }} />
        </button>
      ) : (
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{children}</span>
      )}
    </th>
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Busca — sempre visível */}
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, marca, código..."
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
            style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", color: "var(--text-primary)", width: 260 }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {fmtInt(filtrados.length)} {filtrados.length === 1 ? "item" : "itens"}
          </span>
          <button
            type="button"
            onClick={() => exportCsv(filtrados)}
            className="inline-flex items-center gap-1.5 rounded-lg transition-colors"
            style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            <Download style={{ width: 12, height: 12 }} /> Exportar
          </button>
        </div>
      </div>

      {/* Tabela — cabeçalho fixo, corpo rolável dentro da altura da linha */}
      <div className="custom-scroll flex-1 min-h-0 rounded-xl" style={{ border: "1px solid var(--border-subtle)", overflow: "auto" }}>
        {pageItems.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum produto exige ação para os filtros atuais.
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1020 }}>
            <thead>
              <tr>
                <Th k="nome">Produto</Th>
                {multi && <Th>Loja</Th>}
                <Th>Marca</Th>
                <Th>Categoria</Th>
                <Th k="estoqueAtual" align="right">Estoque</Th>
                <Th k="estoqueMinimo" align="right">Mínimo</Th>
                <Th k="diferenca" align="right">Difer.</Th>
                <Th k="giroDias" align="right">Giro</Th>
                <Th k="valorSugestao" align="right">Sugestão</Th>
                <Th k="valorCusto" align="right">Vlr Custo</Th>
                <Th k="valorVenda" align="right">Vlr Venda</Th>
                <Th k="margemPct" align="right">Margem</Th>
                <Th k="status" align="center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => (
                <tr
                  key={p.proId + "-" + p.empId + "-" + i}
                  onClick={() => setDetalhe(p)}
                  className="acao-row transition-colors"
                  style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", cursor: "pointer" }}
                >
                  <td style={{ padding: "8px 10px", maxWidth: 220 }}>
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)" }} title={p.nome}>{p.nome}</div>
                    {p.codigo && <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Cód: {p.codigo}</div>}
                  </td>
                  {multi && <td style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--text-secondary)" }}>{nomeLoja(p.empId)}</td>}
                  <td style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--text-secondary)", maxWidth: 120 }}><span className="truncate block">{p.marca}</span></td>
                  <td style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--text-secondary)", maxWidth: 120 }}><span className="truncate block">{p.categoria}</span></td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: p.estoqueAtual < 0 ? "#f43f5e" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmtInt(p.estoqueAtual)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{p.estoqueMinimo != null && p.estoqueMinimo > 0 ? fmtInt(p.estoqueMinimo) : "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, fontWeight: 600, color: p.diferenca == null ? "var(--text-muted)" : p.diferenca < 0 ? "#ef4444" : "#22c55e", fontVariantNumeric: "tabular-nums" }}>
                    {p.diferenca == null ? "—" : (p.diferenca > 0 ? "+" : "") + fmtInt(p.diferenca)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11.5, color: p.parado ? "#a78bfa" : "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {p.parado ? "Parado" : fmtGiroDias(p.giroDias)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11.5, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {p.sugestaoCompra == null ? "—" : `${fmtInt(p.sugestaoCompra)} un`}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11.5, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmtMoeda(p.valorCusto)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11.5, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmtMoeda(p.valorVenda)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11.5, fontWeight: 600, color: p.margemPct == null ? "var(--text-muted)" : p.margemPct < 0 ? "#f43f5e" : "#22c55e", fontVariantNumeric: "tabular-nums" }}>
                    {p.margemPct == null ? "—" : fmtPct(p.margemPct)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}><StatusBadge status={p.status} rupturaAtiva={p.rupturaAtiva} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação — sempre visível */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0">
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Página {page + 1} de {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <PagBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft style={{ width: 15, height: 15 }} /></PagBtn>
            <PagBtn disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}><ChevronRight style={{ width: 15, height: 15 }} /></PagBtn>
          </div>
        </div>
      )}

      {detalhe && <DetalheModal item={detalhe} loja={multi ? nomeLoja(detalhe.empId) : null} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function PagBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="flex items-center justify-center rounded-lg transition-colors"
      style={{ width: 30, height: 30, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-secondary)", opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}

// ── Modal de detalhe / orientação de resolução ─────────────────────────────────

const ORIENTACAO: Record<StatusEstoque, string> = {
  negativo: "Estoque negativo indica saída sem entrada registrada. Faça um acerto de inventário e verifique lançamentos de nota.",
  margemNeg: "O preço de venda está abaixo do custo. Revise a formação de preço ou o custo de entrada deste item.",
  abaixo: "Estoque abaixo do mínimo cadastrado. Gere um pedido de compra para repor a cobertura.",
  semMin: "Sem estoque mínimo definido — não é possível avaliar reposição. Cadastre o mínimo no ERP.",
  acima: "Estoque acima do mínimo. Avalie excesso de capital parado neste item.",
  regular: "Item dentro do parâmetro. Nenhuma ação imediata necessária.",
};

function DetalheModal({ item, loja, onClose }: { item: ProdutoAcao; loja: string | null; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const m = STATUS_META[item.status];

  const Linha = ({ label, valor, color }: { label: string; valor: string; color?: string }) => (
    <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{valor}</span>
    </div>
  );

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.15s ease-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--card-header-border)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "slideUp 0.2s ease-out", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <StatusBadge status={item.status} rupturaAtiva={item.rupturaAtiva} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, lineHeight: 1.3 }}>{item.nome}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
              {item.codigo ? `Cód: ${item.codigo} · ` : ""}{item.marca} · {item.categoria}{loja ? ` · ${loja}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 8, display: "flex" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ padding: "6px 20px 4px" }}>
          <Linha label="Estoque atual" valor={fmtInt(item.estoqueAtual)} color={item.estoqueAtual < 0 ? "#f43f5e" : undefined} />
          <Linha label="Estoque mínimo" valor={item.estoqueMinimo != null && item.estoqueMinimo > 0 ? fmtInt(item.estoqueMinimo) : "Não informado"} />
          <Linha label="Diferença" valor={item.diferenca == null ? "—" : (item.diferenca > 0 ? "+" : "") + fmtInt(item.diferenca)} color={item.diferenca != null && item.diferenca < 0 ? "#ef4444" : undefined} />
          <Linha label="Giro (cobertura)" valor={item.parado ? "Parado — sem venda na janela" : fmtGiroDias(item.giroDias)} color={item.parado ? "#a78bfa" : undefined} />
          {item.sugestaoCompra != null && (
            <Linha label="Sugestão de compra" valor={`${fmtInt(item.sugestaoCompra)} un · ${fmtMoeda(item.valorSugestao ?? 0)}`} color="var(--accent-cyan)" />
          )}
          <Linha label="Custo unitário" valor={fmtMoeda(item.custoUnit)} />
          <Linha label="Venda unitária" valor={fmtMoeda(item.vendaUnit)} />
          <Linha label="Valor em estoque (custo)" valor={fmtMoeda(item.valorCusto)} />
          <Linha label="Potencial de venda" valor={fmtMoeda(item.valorVenda)} />
          <Linha label="Margem" valor={item.margemPct == null ? "—" : fmtPct(item.margemPct)} color={item.margemPct != null && item.margemPct < 0 ? "#f43f5e" : "#22c55e"} />
        </div>

        <div style={{ margin: "10px 20px 18px", padding: "10px 12px", borderRadius: 10, background: `${m.color}10`, border: `1px solid ${m.color}30` }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: m.color, marginBottom: 4 }}>Como resolver</p>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{ORIENTACAO[item.status]}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

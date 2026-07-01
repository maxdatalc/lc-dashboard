"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

export interface AnaliseRow {
  empId: number;
  plcId: number | null;
  plcDesc: string;
  valor: number;
  vencido: number;
  aVencer: number;
}

type TabKey = "R" | "PAG" | "P";

interface Props {
  aReceber: AnaliseRow[];
  aPagar: AnaliseRow[];
  pagamentos: AnaliseRow[]; // realizados (vencido/aVencer = 0, colunas ocultas)
  filiais: { empId: number; nome: string }[];
  selectedFilial: number | null;
  onFilialClick: (empId: number | null) => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "R", label: "A Receber" },
  { key: "PAG", label: "Pagamentos" },
  { key: "P", label: "A Pagar" },
];

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number) {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

interface FilialGroup {
  empId: number;
  nome: string;
  total: number;
  vencido: number;
  aVencer: number;
  planos: AnaliseRow[];
}

export function FinAnaliseTable({ aReceber, aPagar, pagamentos, filiais, selectedFilial, onFilialClick }: Props) {
  const [tab, setTab] = useState<TabKey>("R");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const showVenc = tab !== "PAG";
  const accent = tab === "P" ? "var(--accent-yellow)" : tab === "PAG" ? "#ef4444" : "var(--accent-cyan)";

  const rows = tab === "R" ? aReceber : tab === "P" ? aPagar : pagamentos;
  const nomeDe = (empId: number) => filiais.find((f) => f.empId === empId)?.nome ?? `Filial ${empId}`;

  const { groups, totalGeral, totalVencido, totalAVencer } = useMemo(() => {
    const map = new Map<number, FilialGroup>();
    for (const r of rows) {
      let g = map.get(r.empId);
      if (!g) { g = { empId: r.empId, nome: nomeDe(r.empId), total: 0, vencido: 0, aVencer: 0, planos: [] }; map.set(r.empId, g); }
      g.planos.push(r);
      g.total += r.valor; g.vencido += r.vencido; g.aVencer += r.aVencer;
    }
    const groups = [...map.values()].sort((a, b) => b.total - a.total);
    for (const g of groups) g.planos.sort((a, b) => b.valor - a.valor);
    const totalGeral = groups.reduce((s, g) => s + g.total, 0);
    const totalVencido = groups.reduce((s, g) => s + g.vencido, 0);
    const totalAVencer = groups.reduce((s, g) => s + g.aVencer, 0);
    return { groups, totalGeral, totalVencido, totalAVencer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filiais]);

  function toggle(empId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  }

  function exportCsv() {
    const head = showVenc
      ? ["Filial", "Plano de Contas", "Valor", "Participacao %", "Vencido", "A Vencer"]
      : ["Filial", "Plano de Contas", "Valor", "Participacao %"];
    const lines = [head.join(";")];
    for (const g of groups) {
      for (const p of g.planos) {
        const pct = totalGeral > 0 ? (p.valor / totalGeral) * 100 : 0;
        const base = [g.nome, p.plcDesc, p.valor.toFixed(2), pct.toFixed(2)];
        lines.push((showVenc ? [...base, p.vencido.toFixed(2), p.aVencer.toFixed(2)] : base).join(";"));
      }
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-${TABS.find((t) => t.key === tab)?.label.toLowerCase().replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Colunas numéricas com largura mínima garantida para os valores completos nunca cortarem.
  const gridCols = showVenc
    ? "minmax(128px,1.5fr) minmax(120px,1.3fr) minmax(104px,1fr) minmax(96px,1.1fr) minmax(104px,1fr) minmax(96px,1fr)"
    : "minmax(150px,1.8fr) minmax(140px,1.7fr) minmax(104px,1fr) minmax(110px,1.4fr)";

  return (
    <div>
      {/* Cabeçalho: abas + exportar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "inline-flex", background: "var(--bg-card-hover)", borderRadius: 10, padding: 3, gap: 2 }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "all .15s",
                  background: on ? "var(--accent-cyan)" : "transparent",
                  color: on ? "#0d1117" : "var(--text-secondary)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={exportCsv}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)",
          }}
        >
          <Download size={14} /> Exportar
        </button>
      </div>

      {/* Área rolável: garante valores completos sem corte em telas estreitas */}
      <div style={{ overflowX: "auto" }}>
      {/* Cabeçalho de colunas */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <span style={thStyle}>Filial</span>
        <span style={thStyle}>Plano de Contas</span>
        <span style={{ ...thStyle, textAlign: "right" }}>Valor (R$)</span>
        <span style={thStyle}>Participação</span>
        {showVenc && <span style={{ ...thStyle, textAlign: "right" }}>Vencido (R$)</span>}
        {showVenc && <span style={{ ...thStyle, textAlign: "right" }}>A Vencer (R$)</span>}
      </div>

      {groups.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Sem dados para este filtro</div>
      ) : (
        groups.map((g) => {
          const isOpen = expanded.has(g.empId);
          const gPct = totalGeral > 0 ? (g.total / totalGeral) * 100 : 0;
          const filialActive = selectedFilial === g.empId;
          return (
            <div key={g.empId}>
              {/* Linha da filial */}
              <div
                style={{
                  display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "10px 12px", alignItems: "center",
                  background: filialActive ? "rgba(127,127,127,0.06)" : "transparent",
                  borderLeft: `2px solid ${filialActive ? accent : "transparent"}`,
                  transition: "background .15s",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <button onClick={() => toggle(g.empId)} style={iconBtn} aria-label={isOpen ? "Recolher" : "Expandir"}>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <button
                    onClick={() => onFilialClick(filialActive ? null : g.empId)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "left", wordBreak: "break-word", lineHeight: 1.25 }}
                    title="Filtrar por esta filial"
                  >
                    {g.nome}
                  </button>
                </span>
                <span />
                <span style={tdNum(true)}>{fmt(g.total)}</span>
                <ParticipacaoBar pct={gPct} accent={accent} bold />
                {showVenc && <span style={{ ...tdNum(), color: g.vencido > 0 ? "#ef4444" : "var(--text-muted)" }}>{fmt(g.vencido)}</span>}
                {showVenc && <span style={tdNum()}>{fmt(g.aVencer)}</span>}
              </div>

              {/* Planos da filial */}
              {isOpen && g.planos.map((p, i) => {
                const pPct = totalGeral > 0 ? (p.valor / totalGeral) * 100 : 0;
                return (
                  <div key={`${g.empId}-${p.plcId}-${i}`} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "7px 12px", alignItems: "center", borderTop: "1px solid var(--border-subtle)" }}>
                    <span />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", wordBreak: "break-word", lineHeight: 1.3, paddingLeft: 22 }} title={p.plcDesc}>{p.plcDesc}</span>
                    <span style={tdNum()}>{fmt(p.valor)}</span>
                    <ParticipacaoBar pct={pPct} accent={accent} />
                    {showVenc && <span style={{ ...tdNum(), color: p.vencido > 0 ? "#ef4444" : "var(--text-muted)" }}>{fmt(p.vencido)}</span>}
                    {showVenc && <span style={tdNum()}>{fmt(p.aVencer)}</span>}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Total geral */}
      {groups.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "12px", alignItems: "center", borderTop: `2px solid var(--border-subtle)`, marginTop: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Total Geral</span>
          <span />
          <span style={{ ...tdNum(true), fontWeight: 800 }}>{fmt(totalGeral)}</span>
          <ParticipacaoBar pct={100} accent={accent} bold />
          {showVenc && <span style={{ ...tdNum(true), color: "#ef4444" }}>{fmt(totalVencido)}</span>}
          {showVenc && <span style={tdNum(true)}>{fmt(totalAVencer)}</span>}
        </div>
      )}
      </div>
    </div>
  );
}

function ParticipacaoBar({ pct, accent, bold }: { pct: number; accent: string; bold?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11.5, fontWeight: bold ? 700 : 600, color: "var(--text-secondary)", minWidth: 46 }}>{fmtPct(pct)}</span>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-card-hover)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.min(pct, 100)}%`, background: accent, borderRadius: 3, transition: "width .6s cubic-bezier(.22,.61,.36,1)" }} />
      </span>
    </span>
  );
}

const thStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" };
const iconBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", display: "flex", flexShrink: 0 };
function tdNum(strong?: boolean): React.CSSProperties {
  return { fontSize: 11.5, fontWeight: strong ? 700 : 500, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" };
}

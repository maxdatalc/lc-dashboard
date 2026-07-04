"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, ListTree } from "lucide-react";

export interface AnaliseRow {
  empId: number;
  plcId: number | null;
  plcDesc: string;
  spcId: number | null;
  spcDesc: string;
  valor: number;
}

type TabKey = "R" | "P";

interface Props {
  aReceber: AnaliseRow[];
  aPagar: AnaliseRow[];
  filiais: { empId: number; nome: string }[];
  selectedFilial: number | null;
  onFilialClick: (empId: number | null) => void;
}

const TABS: { key: TabKey; label: string; accent: string }[] = [
  { key: "R", label: "A Receber", accent: "var(--accent-cyan)" },
  { key: "P", label: "A Pagar", accent: "var(--accent-yellow)" },
];

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number) {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

// ─── Estrutura em árvore: Filial → Plano → Subplano ───────────────────────────

interface SubGroup { spcId: number | null; spcDesc: string; valor: number; }
interface PlanoGroup { plcId: number | null; plcDesc: string; valor: number; subs: SubGroup[]; }
interface FilialGroup { empId: number; nome: string; valor: number; planos: PlanoGroup[]; }

export function FinAnaliseTable({ aReceber, aPagar, filiais, selectedFilial, onFilialClick }: Props) {
  const [tab, setTab] = useState<TabKey>("R");
  const [openFiliais, setOpenFiliais] = useState<Set<number>>(new Set());
  const [openPlanos, setOpenPlanos] = useState<Set<string>>(new Set());

  const accent = TABS.find((t) => t.key === tab)!.accent;
  const rows = tab === "R" ? aReceber : aPagar;
  const nomeDe = (empId: number) => filiais.find((f) => f.empId === empId)?.nome ?? `Filial ${empId}`;

  const { groups, totalGeral } = useMemo(() => {
    const fMap = new Map<number, FilialGroup>();
    for (const r of rows) {
      let fg = fMap.get(r.empId);
      if (!fg) { fg = { empId: r.empId, nome: nomeDe(r.empId), valor: 0, planos: [] }; fMap.set(r.empId, fg); }
      fg.valor += r.valor;

      const pKey = r.plcId ?? -1;
      let pg = fg.planos.find((p) => (p.plcId ?? -1) === pKey);
      if (!pg) { pg = { plcId: r.plcId, plcDesc: r.plcDesc, valor: 0, subs: [] }; fg.planos.push(pg); }
      pg.valor += r.valor;

      const sKey = r.spcId ?? -1;
      let sg = pg.subs.find((s) => (s.spcId ?? -1) === sKey);
      if (!sg) { sg = { spcId: r.spcId, spcDesc: r.spcDesc, valor: 0 }; pg.subs.push(sg); }
      sg.valor += r.valor;
    }
    const groups = [...fMap.values()].sort((a, b) => b.valor - a.valor);
    for (const g of groups) {
      g.planos.sort((a, b) => b.valor - a.valor);
      for (const p of g.planos) p.subs.sort((a, b) => b.valor - a.valor);
    }
    const totalGeral = groups.reduce((s, g) => s + g.valor, 0);
    return { groups, totalGeral };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filiais]);

  // Uma filial → já abre. Muitas → começa recolhido. Reseta ao trocar aba/dados.
  const groupKey = groups.map((g) => g.empId).join(",");
  useEffect(() => {
    if (groups.length === 1) setOpenFiliais(new Set([groups[0].empId]));
    else setOpenFiliais(new Set());
    setOpenPlanos(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, tab]);

  const allOpen = groups.length > 0 && openFiliais.size >= groups.length;
  function toggleAll() {
    if (allOpen) { setOpenFiliais(new Set()); setOpenPlanos(new Set()); }
    else {
      setOpenFiliais(new Set(groups.map((g) => g.empId)));
      const pk = new Set<string>();
      for (const g of groups) for (const p of g.planos) pk.add(`${g.empId}:${p.plcId ?? -1}`);
      setOpenPlanos(pk);
    }
  }
  const toggleFilial = (empId: number) => setOpenFiliais((prev) => {
    const n = new Set(prev); if (n.has(empId)) n.delete(empId); else n.add(empId); return n;
  });
  const togglePlano = (key: string) => setOpenPlanos((prev) => {
    const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n;
  });

  function exportCsv() {
    const head = ["Filial", "Plano de Contas", "Subplano de Contas", "Valor", "Participacao %"];
    const lines = [head.join(";")];
    for (const g of groups) for (const p of g.planos) for (const s of p.subs) {
      const pct = totalGeral > 0 ? (s.valor / totalGeral) * 100 : 0;
      lines.push([g.nome, p.plcDesc, s.spcDesc, s.valor.toFixed(2), pct.toFixed(2)].join(";"));
    }
    const csv = "﻿" + lines.join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-${tab === "R" ? "a-receber" : "a-pagar"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Cabeçalho: abas + ações */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "inline-flex", background: "var(--bg-card-hover)", borderRadius: 10, padding: 3, gap: 2 }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "6px 18px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "all .15s",
                  background: on ? t.accent : "transparent",
                  color: on ? "#0d1117" : "var(--text-secondary)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleAll} style={actionBtn} title={allOpen ? "Recolher todas as filiais" : "Expandir todas as filiais"}>
            <ListTree size={14} /> {allOpen ? "Recolher tudo" : "Expandir tudo"}
          </button>
          <button onClick={exportCsv} style={actionBtn} title="Exportar CSV com filial, plano e subplano">
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* Cabeçalho de colunas */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", minWidth: 560 }}>
          <span style={thStyle}>Filial · Plano · Subplano</span>
          <span style={{ ...thStyle, textAlign: "right" }}>Valor (R$)</span>
          <span style={thStyle}>Participação</span>
        </div>

        {groups.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {tab === "R" ? "Nenhum recebimento no período." : "Nenhum pagamento no período."}
          </div>
        ) : (
          <div style={{ minWidth: 560 }}>
            {groups.map((g) => {
              const fOpen = openFiliais.has(g.empId);
              const gPct = totalGeral > 0 ? (g.valor / totalGeral) * 100 : 0;
              const active = selectedFilial === g.empId;
              return (
                <div key={g.empId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {/* Nível 0 — Filial */}
                  <div
                    style={{
                      display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "10px 12px", alignItems: "center",
                      background: active ? "color-mix(in srgb, var(--accent-cyan) 7%, transparent)" : "transparent",
                      borderLeft: `3px solid ${active ? accent : "transparent"}`,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <button onClick={() => toggleFilial(g.empId)} style={chevronBtn} aria-label={fOpen ? "Recolher filial" : "Expandir filial"}>
                        {fOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <button
                        onClick={() => onFilialClick(active ? null : g.empId)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: active ? accent : "var(--text-primary)", textAlign: "left", wordBreak: "break-word", lineHeight: 1.25 }}
                        title="Clique para filtrar todo o painel por esta filial"
                      >
                        {g.nome}
                      </button>
                    </span>
                    <span style={tdNum(700)}>{fmt(g.valor)}</span>
                    <ParticipacaoBar pct={gPct} accent={accent} bold />
                  </div>

                  {/* Nível 1 — Planos */}
                  {fOpen && g.planos.map((p) => {
                    const pKey = `${g.empId}:${p.plcId ?? -1}`;
                    const pOpen = openPlanos.has(pKey);
                    const pPct = totalGeral > 0 ? (p.valor / totalGeral) * 100 : 0;
                    const hasSubs = p.subs.length > 0;
                    return (
                      <div key={pKey}>
                        <div
                          style={{
                            display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "8px 12px 8px 0", alignItems: "center",
                            background: "color-mix(in srgb, var(--text-muted) 4%, transparent)",
                            borderTop: "1px solid var(--border-subtle)",
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, paddingLeft: 30 }}>
                            <button onClick={() => hasSubs && togglePlano(pKey)} style={{ ...chevronBtn, visibility: hasSubs ? "visible" : "hidden" }} aria-label={pOpen ? "Recolher plano" : "Expandir plano"}>
                              {pOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", wordBreak: "break-word", lineHeight: 1.25 }} title={p.plcDesc}>{p.plcDesc}</span>
                          </span>
                          <span style={tdNum(600)}>{fmt(p.valor)}</span>
                          <ParticipacaoBar pct={pPct} accent={accent} />
                        </div>

                        {/* Nível 2 — Subplanos */}
                        {pOpen && p.subs.map((s, i) => {
                          const sPct = totalGeral > 0 ? (s.valor / totalGeral) * 100 : 0;
                          return (
                            <div key={`${pKey}:${s.spcId ?? -1}:${i}`} style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "6px 12px 6px 0", alignItems: "center", borderTop: "1px solid color-mix(in srgb, var(--border-subtle) 55%, transparent)" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, paddingLeft: 64 }}>
                                <span style={{ width: 5, height: 5, borderRadius: 999, background: accent, opacity: 0.55, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-word", lineHeight: 1.25 }} title={s.spcDesc}>{s.spcDesc}</span>
                              </span>
                              <span style={tdNum(500)}>{fmt(s.valor)}</span>
                              <ParticipacaoBar pct={sPct} accent={accent} subtle />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Total geral */}
            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "12px", alignItems: "center", borderTop: "2px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Total Geral</span>
              <span style={tdNum(800)}>{fmt(totalGeral)}</span>
              <ParticipacaoBar pct={100} accent={accent} bold />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParticipacaoBar({ pct, accent, bold, subtle }: { pct: number; accent: string; bold?: boolean; subtle?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: bold ? 700 : 600, color: "var(--text-secondary)", minWidth: 52, flexShrink: 0 }}>{fmtPct(pct)}</span>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-card-hover)", overflow: "hidden", minWidth: 40 }}>
        <span style={{ display: "block", height: "100%", width: `${Math.min(pct, 100)}%`, background: accent, opacity: subtle ? 0.6 : 1, borderRadius: 3, transition: "width .6s cubic-bezier(.22,.61,.36,1)" }} />
      </span>
    </span>
  );
}

const GRID = "minmax(280px, 3fr) minmax(140px,1fr) minmax(200px,1.5fr)";
const thStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" };
const chevronBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", display: "flex", flexShrink: 0 };
const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
  fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)",
};
function tdNum(weight: number): React.CSSProperties {
  return { fontSize: 12.5, fontWeight: weight, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" };
}

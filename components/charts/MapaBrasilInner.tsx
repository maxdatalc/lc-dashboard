"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoIdentity, geoPath } from "d3-geo";
import { MapPin, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, X, Users, DollarSign, Receipt, Loader2 } from "lucide-react";
import { fetchMalhaEstados, fetchMalhaMunicipios, normNome, UF_INFO, CODE_TO_UF, type GeoFC, type GeoFeature } from "@/lib/utils/ibge-malhas";
import { CliGeoRanking, cidadeKey } from "./CliGeoRanking";
import type { CliGeoItem } from "./CliGeoRanking";

interface GeoStat { receita: number; vendas: number; }

interface Props {
  data: CliGeoItem[];
  totalBase: number;
  selectedCidade: string | null;
  onSelect: (cidade: string | null) => void;
  geoStats?: Record<string, GeoStat>;
}

interface UFAgg { clientes: number; receita: number; vendas: number; cidades: CliGeoItem[]; }
interface MunSel { codarea: string; nome: string; key: string | null; }
interface Hover { x: number; y: number; flip: boolean; title: string; lines: string[]; }

const W = 880;
const H = 600;
const MAP_H = 430;

function num(v: number) { return v.toLocaleString("pt-BR"); }
function brl(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000)     return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Intensidade do preenchimento coroplético (0 clientes = sem cor). */
function fillOpacity(qtde: number, max: number): number {
  if (qtde <= 0 || max <= 0) return 0;
  return 0.14 + 0.72 * Math.sqrt(qtde / max);
}

const panelLabel: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
};

export default function MapaBrasilInner({ data, totalBase, selectedCidade, onSelect, geoStats }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [estadosFC, setEstadosFC] = useState<GeoFC | null>(null);
  const [erro, setErro] = useState(false);
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [mun, setMun] = useState<{ malha: GeoFC; nomes: Record<string, string> } | null>(null);
  const [loadingMun, setLoadingMun] = useState(false);
  const [munSel, setMunSel] = useState<MunSel | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  // ── Malha dos estados (1x) ──────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    fetchMalhaEstados()
      .then((fc) => { if (vivo) setEstadosFC(fc); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, []);

  // ── Malha dos municípios da UF selecionada ──────────────────────────────
  useEffect(() => {
    if (!ufSel) { setMun(null); return; }
    let vivo = true;
    setLoadingMun(true);
    setMun(null);
    fetchMalhaMunicipios(ufSel)
      .then((r) => { if (vivo) setMun(r); })
      .catch(() => { /* sem malha: painel do estado continua funcionando */ })
      .finally(() => { if (vivo) setLoadingMun(false); });
    return () => { vivo = false; };
  }, [ufSel]);

  // Se o cross-filter for limpo/alterado por fora (chips, ranking), solta o município
  useEffect(() => {
    if (munSel?.key && selectedCidade !== munSel.key) setMunSel(null);
  }, [selectedCidade, munSel]);

  // ── Agregados por UF ────────────────────────────────────────────────────
  const porUF = useMemo(() => {
    const m = new Map<string, UFAgg>();
    for (const d of data) {
      const uf = (d.uf || "").toUpperCase().trim();
      if (!UF_INFO[uf]) continue;
      let e = m.get(uf);
      if (!e) { e = { clientes: 0, receita: 0, vendas: 0, cidades: [] }; m.set(uf, e); }
      e.clientes += d.qtde;
      const st = geoStats?.[cidadeKey(d.cidade)];
      if (st && d.cidade) { e.receita += st.receita; e.vendas += st.vendas; }
      if (d.cidade) e.cidades.push(d);
    }
    return m;
  }, [data, geoStats]);

  const totais = useMemo(() => {
    let receita = 0, vendas = 0;
    for (const st of Object.values(geoStats ?? {})) { receita += st.receita; vendas += st.vendas; }
    return { receita, vendas };
  }, [geoStats]);

  const maxUF = useMemo(() => Math.max(1, ...[...porUF.values()].map((e) => e.clientes)), [porUF]);
  const semCidade = useMemo(() => data.filter((d) => !d.cidade).reduce((s, d) => s + d.qtde, 0), [data]);

  // Estatísticas por município da UF ativa (nome normalizado → dados do ERP)
  const munStats = useMemo(() => {
    const m = new Map<string, { item: CliGeoItem; receita: number; vendas: number }>();
    if (!ufSel) return m;
    for (const d of porUF.get(ufSel)?.cidades ?? []) {
      const st = geoStats?.[cidadeKey(d.cidade)];
      m.set(normNome(d.cidade), { item: d, receita: st?.receita ?? 0, vendas: st?.vendas ?? 0 });
    }
    return m;
  }, [ufSel, porUF, geoStats]);

  const codareaByNorm = useMemo(() => {
    const m = new Map<string, string>();
    if (mun) for (const [cod, nome] of Object.entries(mun.nomes)) m.set(normNome(nome), cod);
    return m;
  }, [mun]);

  const maxMun = useMemo(() => Math.max(1, ...[...munStats.values()].map((e) => e.item.qtde)), [munStats]);

  // ── Projeção + zoom ─────────────────────────────────────────────────────
  const path = useMemo(() => {
    if (!estadosFC) return null;
    // geoIdentity (planar) em vez de geoMercator: as malhas do IBGE têm
    // polígonos com winding invertido, o que faz o geoMercator (esférico)
    // renderizá-los como "o resto da esfera" — enchendo o mapa. A projeção
    // planar ignora winding/clipping esférico. reflectY corrige o eixo Y do SVG.
    const proj = geoIdentity().reflectY(true);
    proj.fitExtent([[10, 10], [W - 10, H - 10]], estadosFC as never);
    return geoPath(proj);
  }, [estadosFC]);

  const zoom = useMemo(() => {
    if (!ufSel || !path || !estadosFC) return { k: 1, tx: 0, ty: 0 };
    const code = UF_INFO[ufSel].code;
    const f = estadosFC.features.find((ft) => ft.properties.codarea === code);
    if (!f) return { k: 1, tx: 0, ty: 0 };
    const [[x0, y0], [x1, y1]] = path.bounds(f as never);
    const k = Math.min(14, 0.9 * Math.min((W * 0.60) / (x1 - x0), (H * 0.92) / (y1 - y0)));
    return { k, tx: W * 0.34 - k * (x0 + x1) / 2, ty: H * 0.5 - k * (y0 + y1) / 2 };
  }, [ufSel, path, estadosFC]);

  // ── Interações ──────────────────────────────────────────────────────────
  function reset() {
    if (munSel?.key) onSelect(null);
    setUfSel(null);
    setMunSel(null);
  }

  function clickEstado(sigla: string) {
    if (ufSel === sigla) { reset(); return; }
    if (munSel?.key) onSelect(null);
    setMunSel(null);
    setUfSel(sigla);
  }

  function clickMunicipio(codarea: string) {
    const nome = mun?.nomes[codarea] ?? codarea;
    const st = munStats.get(normNome(nome));
    const key = st ? cidadeKey(st.item.cidade) : null;
    if (munSel?.codarea === codarea) {
      setMunSel(null);
      if (munSel.key) onSelect(null);
    } else {
      setMunSel({ codarea, nome, key });
      if (key) onSelect(key);
      else if (munSel?.key) onSelect(null);
    }
  }

  function moveHover(e: React.MouseEvent, title: string, lines: string[]) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    setHover({ x, y, flip: x > r.width * 0.58, title, lines });
  }

  // ── Fallback: IBGE fora do ar ───────────────────────────────────────────
  if (erro) {
    return (
      <div className="flex flex-col gap-3">
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "8px 10px", borderRadius: 8, background: "color-mix(in srgb, var(--accent-yellow) 8%, transparent)" }}>
          Não foi possível carregar o mapa (malhas do IBGE indisponíveis). Exibindo o ranking por cidade.
        </div>
        <CliGeoRanking data={data} totalBase={totalBase} selectedCidade={selectedCidade} onSelect={onSelect} />
      </div>
    );
  }

  const ufAgg = ufSel ? porUF.get(ufSel) : null;
  const munDet = munSel ? munStats.get(normNome(munSel.nome)) : null;
  const topMun = ufAgg ? [...ufAgg.cidades].sort((a, b) => b.qtde - a.qtde).slice(0, 7) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{`
        @keyframes mapFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mapSlideIn { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: translateX(0) } }
        @media (prefers-reduced-motion: reduce) {
          .mapa-br-zoom { transition: none !important; }
          .mapa-br-anim { animation: none !important; }
        }
      `}</style>

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <div ref={wrapRef} style={{ position: "relative", height: MAP_H, borderRadius: 12, overflow: "hidden", background: "color-mix(in srgb, var(--text-muted) 3%, transparent)", border: "1px solid var(--border-subtle)" }}>
        {!estadosFC ? (
          <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
            <g
              className="mapa-br-zoom"
              style={{
                transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.k})`,
                transformOrigin: "0 0",
                transition: "transform 0.7s cubic-bezier(0.33, 1, 0.35, 1)",
              }}
            >
              {/* Estados */}
              {estadosFC.features.map((f) => {
                const sigla = CODE_TO_UF[f.properties.codarea];
                const agg = porUF.get(sigla);
                const q = agg?.clientes ?? 0;
                const op = fillOpacity(q, maxUF);
                const isSel = ufSel === sigla;
                const dim = ufSel !== null && !isSel;
                return (
                  <path
                    key={f.properties.codarea}
                    d={path!(f as never) ?? undefined}
                    fill={q > 0 ? "var(--accent-cyan)" : "color-mix(in srgb, var(--text-muted) 8%, transparent)"}
                    fillOpacity={q > 0 ? (dim ? op * 0.3 : op) : (dim ? 0.4 : 1)}
                    stroke="color-mix(in srgb, var(--text-muted) 45%, transparent)"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: "pointer", transition: "fill-opacity 0.35s ease" }}
                    onClick={() => clickEstado(sigla)}
                    onMouseMove={(e) => moveHover(e, `${UF_INFO[sigla]?.nome ?? sigla} · ${sigla}`, [
                      `${num(q)} cliente${q === 1 ? "" : "s"}`,
                      ...(agg && agg.receita > 0 ? [`${brl(agg.receita)} em vendas`] : []),
                      isSel ? "Clique para voltar ao Brasil" : "Clique para explorar",
                    ])}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}

              {/* Municípios da UF ativa */}
              {ufSel && mun && (
                <g key={ufSel} className="mapa-br-anim" style={{ animation: "mapFade 0.45s ease-out both" }}>
                  {mun.malha.features.map((f: GeoFeature) => {
                    const nome = mun.nomes[f.properties.codarea] ?? "";
                    const st = munStats.get(normNome(nome));
                    const q = st?.item.qtde ?? 0;
                    const op = fillOpacity(q, maxMun);
                    const isSel = munSel?.codarea === f.properties.codarea;
                    return (
                      <path
                        key={f.properties.codarea}
                        d={path!(f as never) ?? undefined}
                        fill={q > 0 ? "var(--accent-cyan)" : "var(--bg-card)"}
                        fillOpacity={q > 0 ? Math.min(1, op + (isSel ? 0.18 : 0)) : 0.55}
                        stroke={isSel ? "var(--text-primary)" : "color-mix(in srgb, var(--text-muted) 55%, transparent)"}
                        strokeWidth={isSel ? 2 : 0.5}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); clickMunicipio(f.properties.codarea); }}
                        onMouseMove={(e) => moveHover(e, nome, [
                          q > 0 ? `${num(q)} cliente${q === 1 ? "" : "s"}` : "Sem clientes na base",
                          ...(st && st.receita > 0 ? [`${brl(st.receita)} em vendas`] : []),
                        ])}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                </g>
              )}

              {/* Contorno reforçado do estado selecionado */}
              {ufSel && (() => {
                const f = estadosFC.features.find((ft) => ft.properties.codarea === UF_INFO[ufSel].code);
                return f ? (
                  <path d={path!(f as never) ?? undefined} fill="none" stroke="var(--accent-cyan)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                ) : null;
              })()}

              {/* Siglas + contagem por estado (só no nível Brasil) */}
              <g style={{ opacity: ufSel ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
                {estadosFC.features.map((f) => {
                  const sigla = CODE_TO_UF[f.properties.codarea];
                  const q = porUF.get(sigla)?.clientes ?? 0;
                  const [cx, cy] = path!.centroid(f as never);
                  if (!isFinite(cx)) return null;
                  return (
                    <g key={`lbl-${f.properties.codarea}`}>
                      <text x={cx} y={q > 0 ? cy - 1 : cy + 3} textAnchor="middle"
                        style={{ fontSize: 10.5, fontWeight: 700, fill: q > 0 ? "var(--text-primary)" : "var(--text-muted)", paintOrder: "stroke", stroke: "var(--bg-card)", strokeWidth: 2.5, strokeLinejoin: "round" }}>
                        {sigla}
                      </text>
                      {q > 0 && (
                        <text x={cx} y={cy + 10} textAnchor="middle"
                          style={{ fontSize: 8.5, fontWeight: 600, fill: "var(--text-secondary)", fontFamily: "var(--font-numeric, monospace)", paintOrder: "stroke", stroke: "var(--bg-card)", strokeWidth: 2.5, strokeLinejoin: "round" }}>
                          {num(q)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* Breadcrumb */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, background: "color-mix(in srgb, var(--bg-card) 85%, transparent)", backdropFilter: "blur(6px)", border: "1px solid var(--border-subtle)", fontSize: 11, fontWeight: 600 }}>
          <button onClick={reset} style={{ background: "none", border: "none", padding: 0, cursor: ufSel ? "pointer" : "default", color: ufSel ? "var(--accent-cyan)" : "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>
            Brasil
          </button>
          {ufSel && (
            <>
              <span style={{ color: "var(--text-muted)" }}>›</span>
              <span style={{ color: "var(--text-primary)" }}>{UF_INFO[ufSel].nome}</span>
            </>
          )}
        </div>

        {/* Legenda */}
        <div style={{ position: "absolute", bottom: 10, left: 10, padding: "8px 11px", borderRadius: 10, background: "color-mix(in srgb, var(--bg-card) 85%, transparent)", backdropFilter: "blur(6px)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
            Concentração de clientes
          </div>
          <div style={{ width: 110, height: 6, borderRadius: 3, background: "linear-gradient(to right, color-mix(in srgb, var(--accent-cyan) 15%, transparent), var(--accent-cyan))" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "var(--text-muted)" }}>
            <span>Menor</span><span>Maior</span>
          </div>
        </div>

        {/* Carregando municípios */}
        {loadingMun && (
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "color-mix(in srgb, var(--bg-card) 88%, transparent)", backdropFilter: "blur(6px)", border: "1px solid var(--border-subtle)", fontSize: 10.5, color: "var(--text-secondary)" }}>
            <Loader2 size={12} className="animate-spin" /> Carregando municípios…
          </div>
        )}

        {/* Tooltip */}
        {hover && (
          <div style={{
            position: "absolute", left: hover.x, top: hover.y, zIndex: 30, pointerEvents: "none",
            transform: hover.flip ? "translate(calc(-100% - 12px), 12px)" : "translate(12px, 12px)",
            background: "color-mix(in srgb, var(--bg-card) 94%, transparent)", backdropFilter: "blur(6px)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "7px 10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)", maxWidth: 200,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{hover.title}</div>
            {hover.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: i === hover.lines.length - 1 ? "var(--accent-cyan)" : "var(--text-secondary)", lineHeight: 1.5 }}>{l}</div>
            ))}
          </div>
        )}

        {/* ── Painel de detalhes ─────────────────────────────────────────── */}
        {ufSel && (
          <div className="custom-scroll mapa-br-anim" style={{
            position: "absolute", top: 10, right: 10, bottom: 10, width: 244, zIndex: 20,
            background: "color-mix(in srgb, var(--bg-card) 90%, transparent)", backdropFilter: "blur(10px)",
            border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 13,
            overflowY: "auto", animation: "mapSlideIn 0.28s ease-out both",
            display: "flex", flexDirection: "column", gap: 11,
          }}>
            {munSel ? (
              /* ── Detalhe do município ── */
              <>
                <button onClick={() => { if (munSel.key) onSelect(null); setMunSel(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10.5, fontWeight: 600, color: "var(--accent-cyan)", width: "fit-content" }}>
                  <ChevronLeft size={12} /> {UF_INFO[ufSel].nome}
                </button>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}>
                    {munSel.nome}
                    <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11, marginLeft: 5 }}>/ {ufSel}</span>
                  </div>
                  <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }} aria-label="Fechar">
                    <X size={13} />
                  </button>
                </div>

                {munSel.key && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-cyan)", padding: "3px 9px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)", width: "fit-content" }}>
                    Filtrando o painel
                  </span>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={panelLabel}><Users size={9} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />Clientes</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-numeric, monospace)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {num(munDet?.item.qtde ?? 0)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {totalBase > 0 ? (((munDet?.item.qtde ?? 0) / totalBase) * 100).toFixed(1) : "0"}% da base ativa
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 9 }}>
                    <div style={panelLabel}><DollarSign size={9} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />Faturamento no período</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-numeric, monospace)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                      {brl(munDet?.receita ?? 0)}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 9 }}>
                    <div style={panelLabel}><Receipt size={9} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />Vendas / OS no período</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-purple)", fontFamily: "var(--font-numeric, monospace)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                      {num(munDet?.vendas ?? 0)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ── Resumo do estado ── */
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))" }}>
                    {ufSel}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {UF_INFO[ufSel].nome}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Selecionado</div>
                  </div>
                  <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }} aria-label="Fechar">
                    <X size={13} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ padding: "8px 9px", borderRadius: 9, background: "color-mix(in srgb, var(--accent-cyan) 8%, transparent)" }}>
                    <div style={panelLabel}>Clientes</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-numeric, monospace)", lineHeight: 1 }}>
                      {num(ufAgg?.clientes ?? 0)}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {totalBase > 0 ? (((ufAgg?.clientes ?? 0) / totalBase) * 100).toFixed(1) : "0"}% do total
                    </div>
                  </div>
                  <div style={{ padding: "8px 9px", borderRadius: 9, background: "color-mix(in srgb, var(--accent-green) 8%, transparent)" }}>
                    <div style={panelLabel}>Vendas</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-numeric, monospace)", lineHeight: 1.2 }}>
                      {brl(ufAgg?.receita ?? 0)}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {totais.receita > 0 ? (((ufAgg?.receita ?? 0) / totais.receita) * 100).toFixed(1) : "0"}% do total
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 9px", borderRadius: 9, background: "color-mix(in srgb, var(--accent-purple) 8%, transparent)" }}>
                  <span style={{ ...panelLabel, marginBottom: 0 }}>Vendas / OS</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--accent-purple)", fontFamily: "var(--font-numeric, monospace)" }}>
                    {num(ufAgg?.vendas ?? 0)}
                  </span>
                </div>

                {topMun.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 9 }}>
                    <div style={{ ...panelLabel, marginBottom: 7 }}>Por município</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {topMun.map((c, i) => {
                        const cod = codareaByNorm.get(normNome(c.cidade));
                        const barra = Math.min(100, (c.qtde / (topMun[0]?.qtde || 1)) * 100);
                        return (
                          <button key={c.cidade + i}
                            onClick={() => cod && clickMunicipio(cod)}
                            disabled={!cod}
                            style={{ textAlign: "left", background: "none", border: "none", padding: "5px 2px", cursor: cod ? "pointer" : "default", borderBottom: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cidade}</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-numeric, monospace)", flexShrink: 0 }}>{num(c.qtde)}</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" }}>
                              <div style={{ width: `${barra}%`, height: "100%", borderRadius: 2, background: "var(--accent-cyan)", opacity: 0.8 }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 9.5, color: "var(--text-muted)", textAlign: "center", marginTop: "auto", paddingTop: 6 }}>
                  Clique num município para ver detalhes e filtrar o painel
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Barra de stats + toggle ranking ──────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "0 2px" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} />
          {num(porUF.size)} estado{porUF.size !== 1 ? "s" : ""} com clientes
        </span>
        {semCidade > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-yellow)", display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-yellow) 12%, transparent)" }}>
            <AlertTriangle size={10} /> {num(semCidade)} sem cidade
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>Malhas: IBGE</span>
        <button onClick={() => setShowRanking((v) => !v)}
          style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--accent-cyan)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0 }}>
          {showRanking ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showRanking ? "Ocultar" : "Ver"} ranking
        </button>
      </div>

      {showRanking && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          <CliGeoRanking data={data} totalBase={totalBase} selectedCidade={selectedCidade} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

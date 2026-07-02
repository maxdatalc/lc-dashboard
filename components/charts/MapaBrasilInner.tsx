"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { geoIdentity, geoPath } from "d3-geo";
import { MapPin, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, X, Loader2, Plus, Minus } from "lucide-react";
import { fetchMalhaEstados, fetchMalhaMunicipios, normNome, UF_INFO, CODE_TO_UF, type GeoFC, type GeoFeature } from "@/lib/utils/ibge-malhas";
import { CliGeoRanking, cidadeKey } from "./CliGeoRanking";
import type { CliGeoItem } from "./CliGeoRanking";
import type { ClienteVenda } from "./MapaClientesCard";

interface Props {
  data: CliGeoItem[];
  totalBase: number;
  selectedCidade: string | null;
  onSelect: (cidade: string | null) => void;
  clientesAgg?: ClienteVenda[];
}

interface MunAgg { nome: string; uf: string; clientes: number; receita: number; vendas: number; }
interface UFAgg { clientes: number; receita: number; vendas: number; municipios: Map<string, MunAgg>; }
interface MunSel { codarea: string; nome: string; key: string | null; }
interface Hover { x: number; y: number; flip: boolean; title: string; lines: string[]; }
interface View { k: number; tx: number; ty: number; }
type PanelTab = "municipios" | "clientes";

const W = 880;
const H = 600;
const MAP_H = 430;
const HOME_VIEW: View = { k: 1, tx: 0, ty: 0 };
const MIN_K = 1;
const MAX_K = 45;
const ZOOM_STEP = 1.6;
/** Margem de arrasto: fração da dimensão escalada que ainda pode sair da tela. */
const PAN_SLACK = 0.85;

function clampView(v: View): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  const maxX = k * W * PAN_SLACK, maxY = k * H * PAN_SLACK;
  return { k, tx: Math.min(maxX, Math.max(-maxX, v.tx)), ty: Math.min(maxY, Math.max(-maxY, v.ty)) };
}
/** Zoom em torno de um ponto fixo do viewport (screen-space, já em coordenadas
 *  do viewBox), preservando esse ponto na tela — usado pelos botões +/− (centro
 *  fixo) e pela roda do mouse (ponto sob o cursor). */
function zoomAround(v: View, factor: number, cx: number, cy: number): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
  const r = k / v.k;
  return clampView({ k, tx: cx * (1 - r) + v.tx * r, ty: cy * (1 - r) + v.ty * r });
}
/** Fator de crescimento visual do rótulo em função do zoom: sub-linear e com
 *  teto, para crescer perceptivelmente sem "inflar" junto com o mapa. */
const LABEL_MAX_GROWTH = 2.4;
const LABEL_GROWTH_EXP = 0.38;
function labelGrowth(k: number): number {
  return Math.min(LABEL_MAX_GROWTH, Math.pow(k, LABEL_GROWTH_EXP));
}

function num(v: number) { return v.toLocaleString("pt-BR"); }
function brl(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000)     return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function ticketMedio(receita: number, vendas: number): string {
  return vendas > 0 ? brl(receita / vendas) : "—";
}
function pctStr(parte: number, total: number): string {
  return total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—";
}

// ── Escala de calor do coroplético: amarelo pálido (poucos clientes) até
// laranja profundo (muitos), em vez do cyan monocromático anterior. Os tons
// diferem por tema — o modo escuro usa um laranja mais claro/vibrante (para
// não escurecer contra o card quase-preto), o claro usa um laranja mais
// profundo/saturado (para não desbotar contra o card branco) — seguindo a
// mesma convenção já usada pelos outros tokens de --accent-* do app.
const HEAT_LIGHT = ["#FDE68A", "#FB923C", "#C2410C"] as const;
const HEAT_DARK  = ["#FDE047", "#FB923C", "#F97316"] as const;

/** Posição 0..1 na escala de calor (curva em raiz para distinguir melhor a
 *  cauda longa de municípios com poucos clientes; 0 clientes = sem dado). */
function heatT(qtde: number, max: number): number {
  if (qtde <= 0 || max <= 0) return 0;
  return Math.sqrt(qtde / max);
}
/** Opacidade da escala: no claro, um véu suave sobre o branco já lê bem como
 *  "fraco → forte". No escuro, amarelo translúcido sobre o navy quase-preto
 *  desatura para um tom oliva/acastanhado (a cor de fundo "vaza" através do
 *  alpha) — por isso o piso de opacidade é bem mais alto, deixando a cor
 *  resistir ao fundo e ler como amarelo de verdade. */
function heatOpacity(t: number, dark: boolean): number {
  return dark ? 0.85 + 0.15 * t : 0.55 + 0.4 * t;
}
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function heatColor(stops: readonly [string, string, string], t: number): string {
  const tt = Math.min(1, Math.max(0, t));
  const [c0, c1, c2] = stops.map(hexToRgb);
  const [a, b] = tt <= 0.5 ? [c0, c1] : [c1, c2];
  const localT = tt <= 0.5 ? tt * 2 : (tt - 0.5) * 2;
  const r = lerp(a[0], b[0], localT), g = lerp(a[1], b[1], localT), bl = lerp(a[2], b[2], localT);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)})`;
}

const panelLabel: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
};

function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: "8px 9px", borderRadius: 9, background: `color-mix(in srgb, ${color} 8%, transparent)`, minWidth: 0 }}>
      <div style={panelLabel}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "var(--font-numeric, monospace)", lineHeight: 1.2, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, fontSize: 10.5, fontWeight: 700, padding: "6px 8px", borderRadius: 7,
        border: "none", cursor: "pointer",
        color: active ? "var(--accent-cyan)" : "var(--text-muted)",
        background: active ? "color-mix(in srgb, var(--accent-cyan) 12%, transparent)" : "transparent",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function TopClienteRow({ rank, nome, cidade, vendas, receita, participacao }: {
  rank: number; nome: string; cidade?: string; vendas: number; receita: number; participacao: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", width: 13, flexShrink: 0, fontFamily: "var(--font-numeric, monospace)" }}>
        {rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nome}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", display: "flex", gap: 5, overflow: "hidden" }}>
          {cidade && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cidade} ·</span>}
          <span style={{ flexShrink: 0 }}>{num(vendas)} venda{vendas === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-green)", fontFamily: "var(--font-numeric, monospace)" }}>
          {brl(receita)}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{participacao.toFixed(1)}%</div>
      </div>
    </div>
  );
}

function EmptyTopClientes() {
  return (
    <div style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", padding: "16px 8px" }}>
      Nenhum cliente com compras no período selecionado.
    </div>
  );
}

export default function MapaBrasilInner({ data, totalBase, selectedCidade, onSelect, clientesAgg }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const heatStops = isDark ? HEAT_DARK : HEAT_LIGHT;
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [estadosFC, setEstadosFC] = useState<GeoFC | null>(null);
  const [erro, setErro] = useState(false);
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [mun, setMun] = useState<{ malha: GeoFC; nomes: Record<string, string> } | null>(null);
  const [loadingMun, setLoadingMun] = useState(false);
  const [munSel, setMunSel] = useState<MunSel | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("municipios");

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

  // ── Índice central: clientes + vendas agregados por estado e por município.
  // Único ponto "pesado" — depende só de (data, clientesAgg), ou seja, recalcula
  // apenas quando o período/filtros globais mudam a base carregada; trocar de
  // estado/município é O(1) (lookup em Map + slice de array pequeno). ────────
  const index = useMemo(() => {
    const porUF = new Map<string, UFAgg>();
    const clientesPorUF = new Map<string, ClienteVenda[]>();
    const clientesPorMun = new Map<string, ClienteVenda[]>();

    for (const d of data) {
      const uf = (d.uf || "").toUpperCase().trim();
      if (!UF_INFO[uf]) continue;
      let e = porUF.get(uf);
      if (!e) { e = { clientes: 0, receita: 0, vendas: 0, municipios: new Map() }; porUF.set(uf, e); }
      e.clientes += d.qtde;
      if (d.cidade) {
        const mk = normNome(d.cidade);
        let m = e.municipios.get(mk);
        if (!m) { m = { nome: d.cidade, uf, clientes: 0, receita: 0, vendas: 0 }; e.municipios.set(mk, m); }
        m.clientes += d.qtde;
      }
    }

    for (const c of clientesAgg ?? []) {
      const uf = (c.uf || "").toUpperCase().trim();
      if (!UF_INFO[uf]) continue;
      const e = porUF.get(uf);
      if (e) { e.receita += c.receita; e.vendas += c.vendas; }

      let listaUF = clientesPorUF.get(uf);
      if (!listaUF) { listaUF = []; clientesPorUF.set(uf, listaUF); }
      listaUF.push(c);

      if (c.cidade) {
        const mk = normNome(c.cidade);
        const m = e?.municipios.get(mk);
        if (m) { m.receita += c.receita; m.vendas += c.vendas; }
        const ck = `${uf}|${mk}`;
        let listaMun = clientesPorMun.get(ck);
        if (!listaMun) { listaMun = []; clientesPorMun.set(ck, listaMun); }
        listaMun.push(c);
      }
    }

    return { porUF, clientesPorUF, clientesPorMun };
  }, [data, clientesAgg]);

  const totais = useMemo(() => {
    let clientes = 0, receita = 0, vendas = 0;
    for (const e of index.porUF.values()) { clientes += e.clientes; receita += e.receita; vendas += e.vendas; }
    return { clientes, receita, vendas };
  }, [index]);

  const maxUF = useMemo(() => Math.max(1, ...[...index.porUF.values()].map((e) => e.clientes)), [index]);
  const semCidade = useMemo(() => data.filter((d) => !d.cidade).reduce((s, d) => s + d.qtde, 0), [data]);

  const ufAgg = ufSel ? index.porUF.get(ufSel) : null;
  const maxMun = useMemo(() => Math.max(1, ...[...(ufAgg?.municipios.values() ?? [])].map((e) => e.clientes)), [ufAgg]);

  const topMun = useMemo(() => {
    if (!ufAgg) return [];
    return [...ufAgg.municipios.values()].filter((m) => m.clientes > 0).sort((a, b) => b.clientes - a.clientes).slice(0, 10);
  }, [ufAgg]);

  const topClientesEstado = useMemo(() => {
    if (!ufSel) return [];
    return [...(index.clientesPorUF.get(ufSel) ?? [])].sort((a, b) => b.receita - a.receita).slice(0, 10);
  }, [ufSel, index]);

  const munAgg = ufSel && munSel ? ufAgg?.municipios.get(normNome(munSel.nome)) ?? null : null;
  const munListKey = ufSel && munSel ? `${ufSel}|${normNome(munSel.nome)}` : null;
  const topClientesMunicipio = useMemo(() => {
    if (!munListKey) return [];
    return [...(index.clientesPorMun.get(munListKey) ?? [])].sort((a, b) => b.receita - a.receita).slice(0, 10);
  }, [munListKey, index]);

  const codareaByNorm = useMemo(() => {
    const m = new Map<string, string>();
    if (mun) for (const [cod, nome] of Object.entries(mun.nomes)) m.set(normNome(nome), cod);
    return m;
  }, [mun]);

  // ── Projeção + zoom ─────────────────────────────────────────────────────
  // geoIdentity (planar) em vez de geoMercator: as malhas do IBGE têm
  // polígonos com winding invertido, o que faz o geoMercator (esférico)
  // renderizá-los como "o resto da esfera" — enchendo o mapa. A projeção
  // planar ignora winding/clipping esférico. reflectY corrige o eixo Y do SVG.
  const path = useMemo(() => {
    if (!estadosFC) return null;
    const proj = geoIdentity().reflectY(true);
    proj.fitExtent([[10, 10], [W - 10, H - 10]], estadosFC as never);
    return geoPath(proj);
  }, [estadosFC]);

  // ── Câmera: view = { k, tx, ty } controla zoom/pan como um todo. Ao
  // selecionar um estado, a câmera anima até o enquadramento automático
  // (mesma matemática de antes); a partir daí o usuário pode aproximar,
  // afastar e arrastar livremente por cima, estilo Google Maps. ────────────
  const [view, setView] = useState<View>(HOME_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, startTx: 0, startTy: 0, pointerId: 0 });
  const justDraggedRef = useRef(false);

  useEffect(() => {
    if (!ufSel || !path || !estadosFC) { setView(HOME_VIEW); return; }
    const code = UF_INFO[ufSel].code;
    const f = estadosFC.features.find((ft) => ft.properties.codarea === code);
    if (!f) { setView(HOME_VIEW); return; }
    const [[x0, y0], [x1, y1]] = path.bounds(f as never);
    const k = Math.min(14, 0.9 * Math.min((W * 0.60) / (x1 - x0), (H * 0.92) / (y1 - y0)));
    setView({ k, tx: W * 0.34 - k * (x0 + x1) / 2, ty: H * 0.5 - k * (y0 + y1) / 2 });
  }, [ufSel, path, estadosFC]);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => zoomAround(v, factor, W / 2, H / 2));
  }, []);

  // Zoom pela roda do mouse, centrado no ponto sob o cursor (estilo Google Maps).
  // Listener nativo com passive:false: o onWheel sintético do React não garante
  // que preventDefault() impeça o scroll da página em todos os navegadores —
  // com ele "passive", o evento é despachado mas o scroll da página acontece
  // de qualquer forma. Anexar manualmente com passive:false resolve isso.
  //
  // Por ser um listener nativo anexado num ancestral (wrapRef), ele dispara
  // durante a fase de bubble REAL do DOM — ou seja, antes do React sequer
  // processar o onWheel sintético do painel lateral (que só roda quando o
  // evento alcança o listener delegado do React, mais acima na árvore).
  // Por isso stopPropagation() no painel não impede este listener; a
  // checagem precisa ser feita aqui, vendo se o alvo está dentro do painel.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const s = Math.min(rect.width / W, rect.height / H) || 1;
      const offsetX = (rect.width - s * W) / 2, offsetY = (rect.height - s * H) / 2;
      const px = (e.clientX - rect.left - offsetX) / s;
      const py = (e.clientY - rect.top - offsetY) / s;
      const dy = Math.max(-120, Math.min(120, e.deltaY));
      const factor = Math.pow(1.0012, -dy);
      setHover(null);
      setView((v) => zoomAround(v, factor, px, py));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onPointerDownMap = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Não captura o ponteiro aqui: um clique simples (down+up sem mover) não
    // pode passar por setPointerCapture, senão o pointerup "pertence" a este
    // wrapper em vez do <path> clicado e o navegador nunca sintetiza o click
    // nativo — o estado/município fica impossível de selecionar. A captura só
    // acontece em onPointerMoveMap, quando um arrasto de verdade é confirmado.
    dragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty, pointerId: e.pointerId };
  }, [view.tx, view.ty]);

  const onPointerMoveMap = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setIsDragging(true);
      setHover(null);
      wrapRef.current?.setPointerCapture(d.pointerId);
    }
    if (d.moved) {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = Math.min(rect.width / W, rect.height / H) || 1;
      setView((v) => clampView({ k: v.k, tx: d.startTx + dx / s, ty: d.startTy + dy / s }));
    }
  }, []);

  const onPointerUpMap = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d.active && d.moved) {
      justDraggedRef.current = true;
      wrapRef.current?.releasePointerCapture(e.pointerId);
    }
    d.active = false;
    setIsDragging(false);
  }, []);

  // ── Interações ──────────────────────────────────────────────────────────
  function reset() {
    if (munSel?.key) onSelect(null);
    setUfSel(null);
    setMunSel(null);
    setPanelTab("municipios");
  }

  function clickEstado(sigla: string) {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
    if (ufSel === sigla) { reset(); return; }
    if (munSel?.key) onSelect(null);
    setMunSel(null);
    setPanelTab("municipios");
    setUfSel(sigla);
  }

  function clickMunicipio(codarea: string) {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
    const nome = mun?.nomes[codarea] ?? codarea;
    const m = ufAgg?.municipios.get(normNome(nome));
    const key = m && m.clientes > 0 ? cidadeKey(m.nome) : null;
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
    if (dragRef.current.moved) return;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{`
        @keyframes mapFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mapSlideIn { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: translateX(0) } }
        .mapa-br-zoombtn:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-cyan) 10%, transparent) !important; }
        @media (prefers-reduced-motion: reduce) {
          .mapa-br-zoom { transition: none !important; }
          .mapa-br-anim { animation: none !important; }
        }
      `}</style>

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <div
        ref={wrapRef}
        style={{
          position: "relative", height: MAP_H, borderRadius: 12, overflow: "hidden",
          background: "color-mix(in srgb, var(--text-muted) 3%, transparent)", border: "1px solid var(--border-subtle)",
          cursor: isDragging ? "grabbing" : "default", touchAction: "none", userSelect: "none",
        }}
        onPointerDown={onPointerDownMap}
        onPointerMove={onPointerMoveMap}
        onPointerUp={onPointerUpMap}
        onPointerCancel={onPointerUpMap}
      >
        {!estadosFC ? (
          <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
            <g
              className="mapa-br-zoom"
              style={{
                transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`,
                transformOrigin: "0 0",
                transition: isDragging ? "none" : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Estados */}
              {estadosFC.features.map((f) => {
                const sigla = CODE_TO_UF[f.properties.codarea];
                const agg = index.porUF.get(sigla);
                const q = agg?.clientes ?? 0;
                const t = heatT(q, maxUF);
                const op = heatOpacity(t, isDark);
                const isSel = ufSel === sigla;
                const dim = ufSel !== null && !isSel;
                return (
                  <path
                    key={f.properties.codarea}
                    d={path!(f as never) ?? undefined}
                    fill={q > 0 ? heatColor(heatStops, t) : "color-mix(in srgb, var(--text-muted) 8%, transparent)"}
                    fillOpacity={q > 0 ? (dim ? op * 0.35 : op) : (dim ? 0.4 : 1)}
                    stroke="color-mix(in srgb, var(--text-muted) 45%, transparent)"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                    style={{ transition: "fill-opacity 0.35s ease" }}
                    onClick={() => clickEstado(sigla)}
                    onMouseMove={(e) => moveHover(e, `${UF_INFO[sigla]?.nome ?? sigla} · ${sigla}`, [
                      `${num(q)} cliente${q === 1 ? "" : "s"}`,
                      `${num(agg?.vendas ?? 0)} venda${(agg?.vendas ?? 0) === 1 ? "" : "s"}/OS`,
                      `${brl(agg?.receita ?? 0)} em faturamento`,
                      isSel ? "Clique para voltar ao Brasil" : "Clique para ver municípios",
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
                    const m = ufAgg?.municipios.get(normNome(nome));
                    const q = m?.clientes ?? 0;
                    const t = heatT(q, maxMun);
                    const op = heatOpacity(t, isDark);
                    const isSel = munSel?.codarea === f.properties.codarea;
                    return (
                      <path
                        key={f.properties.codarea}
                        d={path!(f as never) ?? undefined}
                        fill={q > 0 ? heatColor(heatStops, t) : "var(--bg-card)"}
                        fillOpacity={q > 0 ? Math.min(1, op + (isSel ? 0.18 : 0)) : 0.55}
                        stroke={isSel ? "var(--text-primary)" : "color-mix(in srgb, var(--text-muted) 55%, transparent)"}
                        strokeWidth={isSel ? 2 : 0.5}
                        vectorEffect="non-scaling-stroke"
                        onClick={(e) => { e.stopPropagation(); clickMunicipio(f.properties.codarea); }}
                        onMouseMove={(e) => moveHover(e, `${nome} / ${ufSel}`, [
                          `${num(q)} cliente${q === 1 ? "" : "s"}`,
                          `${num(m?.vendas ?? 0)} venda${(m?.vendas ?? 0) === 1 ? "" : "s"}/OS`,
                          `${brl(m?.receita ?? 0)} em faturamento`,
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

              {/* Siglas + contagem por estado (só no nível Brasil). Cada rótulo é
                  contra-escalado em torno do seu próprio centróide com crescimento
                  amortecido (labelGrowth): cresce visivelmente ao dar zoom — para não
                  "sumir" dentro de uma região ampliada — mas com teto, sem inflar
                  proporcionalmente ao zoom do mapa, como em mapas profissionais. */}
              <g style={{ opacity: ufSel ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: "none" }}>
                {estadosFC.features.map((f) => {
                  const sigla = CODE_TO_UF[f.properties.codarea];
                  const q = index.porUF.get(sigla)?.clientes ?? 0;
                  const [cx, cy] = path!.centroid(f as never);
                  if (!isFinite(cx)) return null;
                  const inv = labelGrowth(view.k) / view.k;
                  return (
                    <g key={`lbl-${f.properties.codarea}`} transform={`translate(${cx},${cy}) scale(${inv})`}>
                      <text x={0} y={q > 0 ? -1 : 3} textAnchor="middle"
                        style={{ fontSize: 10.5, fontWeight: 700, fill: q > 0 ? "var(--text-primary)" : "var(--text-muted)", paintOrder: "stroke", stroke: "var(--bg-card)", strokeWidth: 2.5, strokeLinejoin: "round" }}>
                        {sigla}
                      </text>
                      {q > 0 && (
                        <text x={0} y={10} textAnchor="middle"
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
              <button onClick={() => setMunSel(null)} style={{ background: "none", border: "none", padding: 0, cursor: munSel ? "pointer" : "default", color: munSel ? "var(--accent-cyan)" : "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>
                {UF_INFO[ufSel].nome}
              </button>
            </>
          )}
          {munSel && (
            <>
              <span style={{ color: "var(--text-muted)" }}>›</span>
              <span style={{ color: "var(--text-primary)" }}>{munSel.nome}</span>
            </>
          )}
        </div>

        {/* Legenda */}
        <div style={{ position: "absolute", bottom: 10, left: 10, padding: "8px 11px", borderRadius: 10, background: "color-mix(in srgb, var(--bg-card) 85%, transparent)", backdropFilter: "blur(6px)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
            Concentração de clientes
          </div>
          <div style={{ width: 110, height: 6, borderRadius: 3, background: `linear-gradient(to right, ${heatStops[0]}, ${heatStops[1]}, ${heatStops[2]})` }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "var(--text-muted)" }}>
            <span>Fraco</span><span>Forte</span>
          </div>
        </div>

        {/* Controles de zoom (estilo Google Maps) — desliza para não colidir com o painel */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", bottom: 10, right: ufSel ? 268 : 10, zIndex: 25,
            display: "flex", flexDirection: "column", borderRadius: 9, overflow: "hidden",
            border: "1px solid var(--border-subtle)", background: "color-mix(in srgb, var(--bg-card) 92%, transparent)",
            backdropFilter: "blur(6px)", boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
            transition: "right 0.3s ease",
          }}
        >
          <button
            className="mapa-br-zoombtn"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={view.k >= MAX_K}
            aria-label="Aproximar"
            style={{
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "none", cursor: view.k >= MAX_K ? "default" : "pointer",
              color: view.k >= MAX_K ? "var(--text-muted)" : "var(--text-primary)", opacity: view.k >= MAX_K ? 0.4 : 1,
            }}
          >
            <Plus size={15} />
          </button>
          <div style={{ height: 1, background: "var(--border-subtle)" }} />
          <button
            className="mapa-br-zoombtn"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={view.k <= MIN_K}
            aria-label="Afastar"
            style={{
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "none", cursor: view.k <= MIN_K ? "default" : "pointer",
              color: view.k <= MIN_K ? "var(--text-muted)" : "var(--text-primary)", opacity: view.k <= MIN_K ? 0.4 : 1,
            }}
          >
            <Minus size={15} />
          </button>
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
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)", maxWidth: 210,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{hover.title}</div>
            {hover.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: i === hover.lines.length - 1 ? "var(--accent-cyan)" : "var(--text-secondary)", lineHeight: 1.5 }}>{l}</div>
            ))}
          </div>
        )}

        {/* ── Painel de detalhes ─────────────────────────────────────────── */}
        {ufSel && (
          <div
            ref={panelRef}
            className="custom-scroll mapa-br-anim"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 10, right: 10, bottom: 10, width: 258, zIndex: 20,
              background: "color-mix(in srgb, var(--bg-card) 90%, transparent)", backdropFilter: "blur(10px)",
              border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 13,
              overflowY: "auto", animation: "mapSlideIn 0.28s ease-out both",
              display: "flex", flexDirection: "column", gap: 10,
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

                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {(munAgg?.clientes ?? 0) > 0
                    ? `${pctStr(munAgg?.clientes ?? 0, totalBase)} da base ativa · ${pctStr(munAgg?.receita ?? 0, ufAgg?.receita ?? 0)} do faturamento do estado`
                    : "Selecionado"}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <StatTile label="Clientes" value={num(munAgg?.clientes ?? 0)} color="var(--accent-cyan)" />
                  <StatTile label="Faturamento" value={brl(munAgg?.receita ?? 0)} color="var(--accent-green)" />
                  <StatTile label="Vendas / OS" value={num(munAgg?.vendas ?? 0)} color="var(--accent-purple)" />
                  <StatTile label="Ticket médio" value={ticketMedio(munAgg?.receita ?? 0, munAgg?.vendas ?? 0)} color="var(--accent-yellow)" />
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 9 }}>
                  <div style={{ ...panelLabel, marginBottom: 4 }}>Top 10 Clientes do Município</div>
                  {topClientesMunicipio.length === 0 ? (
                    <EmptyTopClientes />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {topClientesMunicipio.map((c, i) => (
                        <TopClienteRow
                          key={c.cliId}
                          rank={i + 1}
                          nome={c.nome}
                          vendas={c.vendas}
                          receita={c.receita}
                          participacao={munAgg && munAgg.receita > 0 ? (c.receita / munAgg.receita) * 100 : 0}
                        />
                      ))}
                    </div>
                  )}
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
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Selecionado · {pctStr(ufAgg?.clientes ?? 0, totalBase)} da base
                    </div>
                  </div>
                  <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }} aria-label="Fechar">
                    <X size={13} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <StatTile label="Clientes" value={num(ufAgg?.clientes ?? 0)} color="var(--accent-cyan)" />
                  <StatTile label="Faturamento" value={brl(ufAgg?.receita ?? 0)} color="var(--accent-green)" sub={`${pctStr(ufAgg?.receita ?? 0, totais.receita)} do total`} />
                  <StatTile label="Vendas / OS" value={num(ufAgg?.vendas ?? 0)} color="var(--accent-purple)" />
                  <StatTile label="Ticket médio" value={ticketMedio(ufAgg?.receita ?? 0, ufAgg?.vendas ?? 0)} color="var(--accent-yellow)" />
                </div>

                <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 9, background: "color-mix(in srgb, var(--text-muted) 6%, transparent)" }}>
                  <TabButton active={panelTab === "municipios"} onClick={() => setPanelTab("municipios")}>Por Município</TabButton>
                  <TabButton active={panelTab === "clientes"} onClick={() => setPanelTab("clientes")}>Top Clientes</TabButton>
                </div>

                {panelTab === "municipios" ? (
                  topMun.length === 0 ? (
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", padding: "12px 6px" }}>
                      Nenhum município identificado no mapa.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {topMun.map((mLoc, i) => {
                        const cod = codareaByNorm.get(normNome(mLoc.nome));
                        const barra = Math.min(100, (mLoc.clientes / (topMun[0]?.clientes || 1)) * 100);
                        return (
                          <button key={mLoc.nome + i}
                            onClick={() => cod && clickMunicipio(cod)}
                            disabled={!cod}
                            style={{ textAlign: "left", background: "none", border: "none", padding: "5px 2px", cursor: cod ? "pointer" : "default", borderBottom: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mLoc.nome}</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-numeric, monospace)", flexShrink: 0 }}>{num(mLoc.clientes)}</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" }}>
                              <div style={{ width: `${barra}%`, height: "100%", borderRadius: 2, background: "var(--accent-cyan)", opacity: 0.8 }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  topClientesEstado.length === 0 ? (
                    <EmptyTopClientes />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {topClientesEstado.map((c, i) => (
                        <TopClienteRow
                          key={c.cliId}
                          rank={i + 1}
                          nome={c.nome}
                          cidade={c.cidade}
                          vendas={c.vendas}
                          receita={c.receita}
                          participacao={ufAgg && ufAgg.receita > 0 ? (c.receita / ufAgg.receita) * 100 : 0}
                        />
                      ))}
                    </div>
                  )
                )}

                <div style={{ fontSize: 9.5, color: "var(--text-muted)", textAlign: "center", marginTop: "auto", paddingTop: 4 }}>
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
          {num(index.porUF.size)} estado{index.porUF.size !== 1 ? "s" : ""} com clientes
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

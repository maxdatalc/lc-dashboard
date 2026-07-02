"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapPin, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { buscarCoordenadas } from "@/lib/utils/cidades-coords";
import { CliGeoRanking, cidadeKey } from "./CliGeoRanking";
import type { CliGeoItem } from "./CliGeoRanking";

interface CidadeComCoords extends CliGeoItem {
  lat: number;
  lng: number;
  key: string;
}

interface GeoStat { receita: number; vendas: number; }

interface Props {
  data: CliGeoItem[];
  totalBase: number;
  selectedCidade: string | null;
  onSelect: (cidade: string | null) => void;
  geoStats?: Record<string, GeoStat>;
}

function corPorPercentil(rank: number, total: number): string {
  if (total <= 1) return "#22d3ee";
  const p = rank / (total - 1);
  if (p >= 0.88) return "#ef4444";
  if (p >= 0.68) return "#fb923c";
  if (p >= 0.45) return "#facc15";
  if (p >= 0.22) return "#4ade80";
  return "#22d3ee";
}

function raio(qtde: number, max: number): number {
  if (max <= 0) return 6;
  return 5 + Math.sqrt(qtde / max) * 22;
}

function num(v: number) { return v.toLocaleString("pt-BR"); }

function brl(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000)     return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function AutoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (points.length === 0 || done.current) return;
    done.current = true;
    const bounds = L.latLngBounds(points);
    if (points.length === 1) {
      map.setView(points[0], 9, { animate: false });
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 10, animate: false });
    }
  }, [map, points]);

  return null;
}

export default function MapaClientesCardInner({ data, totalBase, selectedCidade, onSelect, geoStats }: Props) {
  const [showRanking, setShowRanking] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [popup, setPopup] = useState<CidadeComCoords | null>(null);

  const comCoords: CidadeComCoords[] = data
    .filter((d) => d.cidade)
    .flatMap((d) => {
      const c = buscarCoordenadas(d.cidade, d.uf);
      if (!c) return [];
      return [{ ...d, lat: c[0], lng: c[1], key: cidadeKey(d.cidade) }];
    });

  const semCoords = data.filter((d) => d.cidade && !buscarCoordenadas(d.cidade, d.uf)).length;
  const semCidade = data.filter((d) => !d.cidade).reduce((s, d) => s + d.qtde, 0);

  const sorted = [...comCoords].sort((a, b) => a.qtde - b.qtde);
  const rankMap = new Map(sorted.map((c, i) => [c.key, i]));
  const maxQtde = Math.max(...comCoords.map((c) => c.qtde), 1);
  const points: [number, number][] = comCoords.map((c) => [c.lat, c.lng]);

  function handleCircleClick(cidade: CidadeComCoords) {
    const isSel = selectedCidade === cidade.key;
    if (isSel) {
      setPopup(null);
      onSelect(null);
    } else {
      setPopup(cidade);
      onSelect(cidade.key);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Mapa */}
      <div style={{ position: "relative", height: 310, borderRadius: 10, overflow: "hidden" }}>
        <MapContainer
          center={[-14.235, -51.925]}
          zoom={4}
          style={{ height: "100%", width: "100%", background: "#0d1117" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />

          {comCoords.map((cidade) => {
            const rank = rankMap.get(cidade.key) ?? 0;
            const cor = corPorPercentil(rank, sorted.length);
            const r = raio(cidade.qtde, maxQtde);
            const isSel = selectedCidade === cidade.key;
            const isHov = hoveredKey === cidade.key;

            return (
              <CircleMarker
                key={cidade.key}
                center={[cidade.lat, cidade.lng]}
                radius={isSel ? r + 3 : r}
                pathOptions={{
                  fillColor: cor,
                  fillOpacity: isSel ? 1 : isHov ? 0.85 : 0.62,
                  color: isSel ? "#fff" : cor,
                  weight: isSel ? 2 : 0.8,
                  opacity: 1,
                }}
                eventHandlers={{
                  mouseover: () => setHoveredKey(cidade.key),
                  mouseout: () => setHoveredKey(null),
                  click: () => handleCircleClick(cidade),
                }}
              />
            );
          })}

          <AutoBounds points={points} />
        </MapContainer>

        {/* Legenda de densidade */}
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 1000,
          background: "rgba(10,12,17,0.88)", borderRadius: 8, padding: "7px 10px",
          backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {[
            { color: "#ef4444", label: "Alta" },
            { color: "#fb923c", label: "" },
            { color: "#facc15", label: "" },
            { color: "#4ade80", label: "" },
            { color: "#22d3ee", label: "Baixa" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
              {item.label && <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.65)", lineHeight: 1 }}>{item.label}</span>}
            </div>
          ))}
        </div>

        {/* Card de popup ao clicar na cidade */}
        {popup && (() => {
          const stat = geoStats?.[popup.key];
          return (
            <div style={{
              position: "absolute", bottom: 10, left: 10, zIndex: 1000,
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: 10, padding: "12px 14px", minWidth: 190,
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
              animation: "fadeInUp 0.18s ease-out both",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                  {popup.cidade}
                  {popup.uf && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>/ {popup.uf}</span>}
                </div>
                <button
                  onClick={() => { setPopup(null); onSelect(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, flexShrink: 0 }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Clientes</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {num(popup.qtde)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {totalBase > 0 ? ((popup.qtde / totalBase) * 100).toFixed(1) : "0"}% da base ativa
                  </div>
                </div>

                {stat && (
                  <>
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 7 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Faturamento no período</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {brl(stat.receita)}
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 7 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Vendas / OS no período</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent-purple)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {num(stat.vendas)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Barra de stats + toggle ranking */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "0 2px" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} />
          {num(comCoords.length)} cidade{comCoords.length !== 1 ? "s" : ""} no mapa
        </span>
        {semCoords > 0 && (
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            · {num(semCoords)} não localizad{semCoords !== 1 ? "as" : "a"}
          </span>
        )}
        {semCidade > 0 && (
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: "var(--accent-yellow)",
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 8px", borderRadius: 20,
            background: "color-mix(in srgb, var(--accent-yellow) 12%, transparent)",
          }}>
            <AlertTriangle size={10} /> {num(semCidade)} sem cidade
          </span>
        )}
        <button
          onClick={() => setShowRanking((v) => !v)}
          style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 600,
            color: "var(--accent-cyan)", background: "none", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
            padding: 0,
          }}
        >
          {showRanking ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showRanking ? "Ocultar" : "Ver"} ranking
        </button>
      </div>

      {/* Ranking colapsável */}
      {showRanking && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          <CliGeoRanking
            data={data}
            totalBase={totalBase}
            selectedCidade={selectedCidade}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}

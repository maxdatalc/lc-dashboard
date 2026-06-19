"use client";

import { type ReactNode, useState, useEffect, useRef } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  animationDelay?: number;
  info?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  animationDelay = 0,
  info,
}: ChartCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  function handleInfoClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = rect.right - 280;
    if (left < 8) left = 8;
    if (left + 280 > vw - 8) left = vw - 288;
    setPopupStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left,
      zIndex: 300,
      width: 280,
    });
    setShowInfo((v) => !v);
  }

  useEffect(() => {
    if (!showInfo) return;
    function handleOutside(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showInfo]);

  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        animation: "fadeInUp 0.4s ease-out both",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0"
        style={{
          padding: "10px 16px 8px",
          background: "var(--card-header-bg)",
          borderBottom: "1px solid var(--card-header-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--card-title-color)",
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "2px",
                lineHeight: 1.4,
                margin: "2px 0 0",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {info && (
          <button
            ref={btnRef}
            onClick={handleInfoClick}
            style={{
              flexShrink: 0,
              marginTop: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 3,
              color: showInfo ? "var(--accent-cyan)" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            title="Como analisar este gráfico"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div className="px-4 py-3 flex-1">{children}</div>

      {/* Popup — renderizado com position:fixed para escapar do overflow:hidden */}
      {showInfo && info && (
        <div
          ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            ...popupStyle,
            background: "var(--bg-card)",
            border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-cyan)" }}>
              Como analisar
            </span>
            <button
              onClick={() => setShowInfo(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: "var(--text-secondary)", margin: 0 }}>
            {info}
          </p>
        </div>
      )}
    </div>
  );
}

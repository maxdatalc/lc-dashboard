"use client";

import { type ReactNode, type CSSProperties, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  animationDelay?: number;
  info?: string;
  /** Estilo extra aplicado ao container de conteúdo (ex: altura fixa + scroll interno). */
  bodyStyle?: CSSProperties;
  /** Classe extra aplicada ao container de conteúdo (ex: "custom-scroll"). */
  bodyClassName?: string;
}

function InfoModal({ title, info, onClose }: { title: string; info: string; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--card-header-border)",
          borderRadius: 16,
          padding: "24px 28px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
          animation: "slideUp 0.2s ease-out",
        }}
      >
        {/* Header do modal */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
          <div>
            <span style={{
              display: "block", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--accent-cyan)", marginBottom: 4,
            }}>
              Como analisar
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer", color: "var(--text-muted)",
              padding: 6, borderRadius: 8, display: "flex",
              transition: "background 0.15s",
            }}
            title="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 16 }} />

        {/* Texto */}
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)", margin: 0 }}>
          {info}
        </p>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>,
    document.body
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  animationDelay = 0,
  info,
  bodyStyle,
  bodyClassName = "",
}: ChartCardProps) {
  const [showInfo, setShowInfo] = useState(false);

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
              color: "var(--text-primary)",
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
                color: "var(--text-secondary)",
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
            onClick={() => setShowInfo(true)}
            style={{
              flexShrink: 0,
              marginTop: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 3,
              color: "var(--text-muted)",
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
      <div className={`px-4 py-3 flex-1 ${bodyClassName}`} style={bodyStyle}>{children}</div>

      {/* Modal centralizado */}
      {showInfo && info && (
        <InfoModal title={title} info={info} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}

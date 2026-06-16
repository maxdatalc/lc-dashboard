"use client";

import { type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  animationDelay?: number;
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  animationDelay = 0,
}: ChartCardProps) {
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
      {/* Header — tint azul no light, sutil cyan no dark */}
      <div
        className="flex-shrink-0"
        style={{
          padding: "10px 16px 8px",
          background: "var(--card-header-bg)",
          borderBottom: "1px solid var(--card-header-border)",
        }}
      >
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

      {/* Conteúdo */}
      <div className="px-4 py-3 flex-1">{children}</div>
    </div>
  );
}

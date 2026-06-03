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
      className={`rounded-2xl flex flex-col gap-0 overflow-hidden ${className}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        animation: `fadeInUp 0.4s ease-out both`,
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Divisor sutil */}
      <div style={{ height: 1, backgroundColor: "var(--border-subtle)" }} />

      {/* Conteúdo */}
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

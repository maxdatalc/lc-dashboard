"use client";

import { useState, useId } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Dica contextual discreta ("?") que revela uma explicação curta ao passar o
 * mouse ou focar via teclado. Usada com parcimônia — apenas onde o cálculo de
 * uma métrica não é óbvio.
 */
export function InfoHint({ text, label = "Como é calculado" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full transition-colors"
        style={{ color: "var(--text-muted)", width: 16, height: 16 }}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg px-3 py-2 text-xs leading-relaxed shadow-xl pointer-events-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

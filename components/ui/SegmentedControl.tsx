"use client";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Rótulo acessível do grupo (ex.: "Período do gráfico"). */
  ariaLabel?: string;
}

/**
 * Toggle de 2-4 opções (ex.: Mensal/Semanal/Hoje). A pílula ativa usa tinta
 * invertida (fundo --text-primary, texto --bg-card). Para 4+ opções em espaço
 * apertado, prefira o padrão <select> mobile do Header.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              background: active ? "var(--text-primary)" : "transparent",
              color: active ? "var(--bg-card)" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

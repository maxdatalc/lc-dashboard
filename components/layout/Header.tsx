"use client";

import { usePathname } from "next/navigation";
import {
  Sun, Moon, CalendarDays, Building2, ChevronDown, Check,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import { usePeriod, type Period } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/financeiro": "Financeiro",
  "/dashboard/clientes": "Clientes",
  "/dashboard/produtos": "Produtos & Estoque",
  "/dashboard/vendas": "Vendas",
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7d" },
  { value: "month", label: "Mês atual" },
  { value: "3m", label: "3m" },
  { value: "year", label: "Ano" },
  { value: "prev-year", label: "Ano ant." },
];

// Estilo dos inputs de data para combinar com o tema dark
const DATE_INPUT_STYLE: React.CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "12px",
  width: "100%",
  outline: "none",
};

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function LojaMultiSelect() {
  const { lojasDisponiveis, lojasSelecionadas, setLojasSelecionadas } = useLoja();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Não exibir se só há uma loja
  if (lojasDisponiveis.length <= 1) return null;

  const allSelected = lojasSelecionadas.length === 0;
  const label = allSelected
    ? "Todas as lojas"
    : lojasSelecionadas.length === 1
    ? (lojasDisponiveis.find((l) => l.id === lojasSelecionadas[0])?.name ?? "1 loja")
    : `${lojasSelecionadas.length} lojas`;

  function toggleLoja(id: string) {
    if (lojasSelecionadas.includes(id)) {
      const next = lojasSelecionadas.filter((l) => l !== id);
      setLojasSelecionadas(next);
    } else {
      setLojasSelecionadas([...lojasSelecionadas, id]);
    }
  }

  function toggleAll() {
    setLojasSelecionadas([]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        style={{
          backgroundColor: !allSelected ? "rgba(0,229,255,0.12)" : "transparent",
          color: !allSelected ? "#00e5ff" : "var(--text-secondary)",
          border: `1px solid ${!allSelected ? "rgba(0,229,255,0.3)" : "var(--border-subtle)"}`,
        }}
      >
        <Building2 className="h-3 w-3 flex-shrink-0" />
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown
          className="h-3 w-3 flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 z-50 rounded-xl shadow-xl py-1.5 flex flex-col"
          style={{
            backgroundColor: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            minWidth: 200,
            right: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Opção "Todas" */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
            style={{
              color: allSelected ? "var(--text-primary)" : "var(--text-secondary)",
              backgroundColor: allSelected ? "rgba(255,255,255,0.04)" : "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = allSelected ? "rgba(255,255,255,0.04)" : "transparent")}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded"
              style={{
                width: 14, height: 14,
                border: allSelected ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                backgroundColor: allSelected ? "#00e5ff" : "transparent",
              }}
            >
              {allSelected && <Check style={{ width: 10, height: 10, color: "#0d1117", strokeWidth: 3 }} />}
            </div>
            <span className="font-medium">Todas as lojas</span>
          </button>

          <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", margin: "4px 0" }} />

          {/* Lista de lojas */}
          {lojasDisponiveis.map((loja) => {
            const checked = lojasSelecionadas.includes(loja.id);
            return (
              <button
                key={loja.id}
                onClick={() => toggleLoja(loja.id)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
                style={{
                  color: checked ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: checked ? "rgba(255,255,255,0.04)" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = checked ? "rgba(255,255,255,0.04)" : "transparent")}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded"
                  style={{
                    width: 14, height: 14,
                    border: checked ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                    backgroundColor: checked ? "#00e5ff" : "transparent",
                  }}
                >
                  {checked && <Check style={{ width: 10, height: 10, color: "#0d1117", strokeWidth: 3 }} />}
                </div>
                <span className="truncate max-w-[160px]">{loja.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { period, setPeriod, customRange, setCustomRange } = usePeriod();
  const { selectedLoja } = useLoja();

  // Estado do popover de período personalizado
  const [mounted, setMounted] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const hoje = new Date();
  const hojeStr = toISODate(hoje);
  const [tempStart, setTempStart] = useState(hojeStr);
  const [tempEnd, setTempEnd] = useState(hojeStr);

  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  // Label do pill "Personalizado": mostra intervalo quando ativo
  const customLabel =
    period === "custom" && customRange
      ? `${formatShortDate(customRange.start)} - ${formatShortDate(customRange.end)}`
      : "Personalizado";

  function openCustomPopover() {
    // Preenche com intervalo existente ou hoje
    if (customRange) {
      setTempStart(toISODate(customRange.start));
      setTempEnd(toISODate(customRange.end));
    } else {
      setTempStart(hojeStr);
      setTempEnd(hojeStr);
    }
    setCustomOpen(true);
  }

  function handleApplyCustom() {
    if (!tempStart || !tempEnd) return;
    const start = new Date(tempStart + "T00:00:00");
    const end = new Date(tempEnd + "T23:59:59");
    if (start > end) return;
    setCustomRange({ start, end });
    setPeriod("custom");
    setCustomOpen(false);
  }

  function handleCancelCustom() {
    setCustomOpen(false);
  }

  // Estilo dos pills de período
  const activePillStyle: React.CSSProperties = {
    backgroundColor: "var(--accent-cyan)",
    color: "#0d1117",
    fontWeight: 600,
  };
  const inactivePillStyle: React.CSSProperties = {
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-subtle)",
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center px-4 gap-4"
      style={{
        left: "var(--sidebar-width)",
        height: "var(--header-height)",
        backgroundColor: "var(--bg-card)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Esquerda — título + badge loja */}
      <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
        <h1
          className="text-sm font-semibold whitespace-nowrap"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {selectedLoja && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap truncate max-w-[140px]"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {selectedLoja.name}
          </span>
        )}
      </div>

      {/* Multi-select de lojas */}
      <LojaMultiSelect />

      {/* Centro — seletor de período */}
      <div className="flex-1 flex items-center justify-center gap-1">
        {/* Mobile: dropdown compacto */}
        <select
          className="md:hidden text-xs px-2 py-1 rounded-lg"
          style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            outline: "none",
          }}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          <option value="today">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="month">Mês atual</option>
          <option value="3m">3 meses</option>
          <option value="year">Ano</option>
          <option value="prev-year">Ano ant.</option>
          <option value="custom">Personalizado</option>
        </select>

        {/* Desktop: pills normais */}
        <div className="hidden md:flex items-center gap-1 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={period === p.value ? activePillStyle : inactivePillStyle}
            >
              {p.label}
            </button>
          ))}

          {/* Pill "Personalizado" com popover de calendário */}
          <div className="relative">
            <button
              onClick={openCustomPopover}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
              style={period === "custom" ? activePillStyle : inactivePillStyle}
            >
              <CalendarDays className="h-3 w-3" />
              {customLabel}
            </button>

          {customOpen && (
            <>
              {/* Overlay transparente para fechar ao clicar fora */}
              <div
                className="fixed inset-0 z-40"
                onClick={handleCancelCustom}
              />


              {/* Popover de seleção de datas */}
              <div
                className="absolute top-full mt-2 z-50 rounded-xl shadow-xl p-4 flex flex-col gap-3"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  minWidth: "220px",
                  right: 0,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Período personalizado
                </p>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    De:
                  </label>
                  <input
                    type="date"
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    style={DATE_INPUT_STYLE}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Até:
                  </label>
                  <input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    style={DATE_INPUT_STYLE}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleApplyCustom}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: "var(--accent-cyan)",
                      color: "#0d1117",
                    }}
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={handleCancelCustom}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Direita — tema */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Renderizar o toggle só após montar no cliente para evitar hydration mismatch */}
        {mounted ? (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            aria-label="Alternar tema"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <div className="w-8 h-8" aria-hidden />
        )}
      </div>
    </header>
  );
}

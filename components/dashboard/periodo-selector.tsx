"use client";

// Seletor de período para os KPIs do dashboard
// Presets de período + calendário de range customizado

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";

interface Props {
  periodoAtivo: string;
  customDe?: string;
  customAte?: string;
}

const PRESETS = [
  { valor: "hoje",   label: "Hoje" },
  { valor: "7dias",  label: "7 dias" },
  { valor: "mes",    label: "Mês" },
  { valor: "3meses", label: "3 meses" },
  { valor: "6meses", label: "6 meses" },
  { valor: "ano",    label: "Ano" },
];

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Formata YYYY-MM-DD como DD/MM/AA para exibição compacta no botão
function formatShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// Formata YYYY-MM-DD como DD/MM/AAAA para exibição detalhada
function formatarDataDisplay(dateStr?: string): string {
  if (!dateStr) return "selecione";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PeriodoSelector({ periodoAtivo, customDe, customAte }: Props) {
  const router = useRouter();
  const [openCalendario, setOpenCalendario] = useState(false);

  // Inicializar range com datas custom existentes
  const [range, setRange] = useState<DateRange | undefined>(
    customDe && customAte
      ? {
          from: new Date(customDe + "T12:00:00"),
          to: new Date(customAte + "T12:00:00"),
        }
      : undefined
  );

  function handlePreset(valor: string) {
    router.push(`/dashboard?periodo=${valor}`);
  }

  function handleAplicarCustom() {
    if (!range?.from || !range?.to) return;
    const de = toDateStr(range.from);
    const ate = toDateStr(range.to);
    router.push(`/dashboard?periodo=custom&de=${de}&ate=${ate}`);
    setOpenCalendario(false);
  }

  // Texto do botão do calendário personalizado
  const labelCustom =
    periodoAtivo === "custom" && customDe && customAte
      ? `${formatShort(customDe)} – ${formatShort(customAte)}`
      : "Personalizado";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Botões de período preset */}
      {PRESETS.map((p) => (
        <Button
          key={p.valor}
          size="sm"
          variant={periodoAtivo === p.valor && periodoAtivo !== "custom" ? "default" : "outline"}
          onClick={() => handlePreset(p.valor)}
        >
          {p.label}
        </Button>
      ))}

      {/* Separador vertical */}
      <div className="w-px h-6 bg-slate-200" />

      {/* Popover de calendário customizado */}
      <Popover open={openCalendario} onOpenChange={setOpenCalendario}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={periodoAtivo === "custom" ? "default" : "outline"}
            className="gap-2"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {labelCustom}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
            locale={ptBR}
          />

          {/* Rodapé do popover */}
          <div className="border-t p-3 space-y-2">
            {range?.from && range?.to && (
              <p className="text-xs text-slate-500 text-center">
                {formatarDataDisplay(toDateStr(range.from))} →{" "}
                {formatarDataDisplay(toDateStr(range.to))}
              </p>
            )}
            <Button
              variant="default"
              className="w-full"
              disabled={!range?.from || !range?.to}
              onClick={handleAplicarCustom}
            >
              Aplicar período
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { KpiCard, type KpiCardProps } from "./kpi-card";
import { cn } from "@/lib/utils";

interface KpiItem extends KpiCardProps {
  id: string;
  detalhe: {
    titulo: string;
    descricao: string;
    linhas: { label: string; valor: string; destaque?: boolean }[];
  };
}

interface KpiSecaoProps {
  cards: KpiItem[];
}

export function KpiSecao({ cards }: KpiSecaoProps) {
  const [aberto, setAberto] = useState<string | null>(null);
  const cardAberto = cards.find((c) => c.id === aberto);

  return (
    <>
      {/* Grid de KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map((card) => (
          <KpiCard
            key={card.id}
            {...card}
            onClick={() => setAberto(card.id)}
          />
        ))}
      </div>

      {/* Overlay de drill-down */}
      {aberto && cardAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center
            justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setAberto(null)}
        >
          <div
            className={cn(
              "w-full max-w-lg bg-card border border-border rounded-2xl",
              "shadow-2xl p-6 animate-in fade-in-0 zoom-in-95",
              "duration-200"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest
                  text-muted-foreground mb-0.5">
                  {cardAberto.label}
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {cardAberto.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {cardAberto.detalhe.descricao}
                </p>
              </div>
              <button
                onClick={() => setAberto(null)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground
                  hover:text-foreground transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Linhas de detalhe */}
            <div className="space-y-1">
              {cardAberto.detalhe.linhas.map((linha, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between py-2.5 px-3 rounded-lg text-sm",
                    linha.destaque
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-background hover:bg-accent/50 transition-colors"
                  )}
                >
                  <span className={cn(
                    linha.destaque ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {linha.label}
                  </span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    linha.destaque ? "text-primary" : "text-foreground"
                  )}>
                    {linha.valor}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
              Clique fora para fechar · Mais detalhes em breve
            </p>
          </div>
        </div>
      )}
    </>
  );
}

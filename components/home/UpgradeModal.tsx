"use client";

import { useEffect } from "react";
import { Lock, X, CheckCircle2 } from "lucide-react";

// ─── Benefícios por módulo ────────────────────────────────────────────────────

const MODULE_BENEFITS: Record<string, string[]> = {
  modulo_vendas: [
    "Dashboard completo de vendas e metas",
    "Análise de tempo médio por venda",
    "Comparativo com períodos anteriores",
    "Filtros por vendedor, produto e cliente",
  ],
  modulo_financeiro: [
    "Análise completa de inadimplência",
    "Fluxo de caixa e contas a receber",
    "Indicadores de margem e custo detalhados",
    "Projeções financeiras",
  ],
  modulo_clientes: [
    "Mapa completo da base de clientes",
    "Identificação do maior cliente",
    "Análise de churn e retenção",
    "Segmentação PJ/PF detalhada",
  ],
  modulo_produtos: [
    "Estoque crítico e alertas automáticos",
    "Análise por fabricante e grupo",
    "Mix de produtos e curva ABC",
    "Sugestão de compra inteligente",
  ],
  modulo_os: [
    "Gestão completa de ordens de serviço",
    "Controle de técnicos e atendimentos",
    "Histórico de OS por cliente e veículo",
    "Relatórios de produtividade",
  ],
  modulo_relatorios: [
    "Relatório de comissão por recebimento",
    "Exportação em PDF e Excel",
    "Filtros avançados por período",
    "Dashboard de equipe",
  ],
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureKey: string;
  moduleTitle: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function UpgradeModal({ isOpen, onClose, featureKey, moduleTitle }: UpgradeModalProps) {
  const benefits = MODULE_BENEFITS[featureKey] ?? [];

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Travar scroll do body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const waText = encodeURIComponent(
    `Olá! Tenho interesse em desbloquear o módulo "${moduleTitle}" no LC Dashboard.`
  );
  const waHref = `https://wa.me/5562999999999?text=${waText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 transition-colors hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label="Fechar modal"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ background: "#22c55e20", width: 56, height: 56 }}
          >
            <Lock size={24} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Desbloqueie {moduleTitle}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Acesse todos os dados e análises do módulo
            </p>
          </div>
        </div>

        {/* Lista de benefícios */}
        <ul className="flex flex-col gap-2.5">
          {benefits.map((benefit, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {benefit}
              </span>
            </li>
          ))}
        </ul>

        {/* Ações */}
        <div className="flex flex-col gap-2.5 mt-1">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#22c55e" }}
          >
            Solicitar acesso
          </a>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl py-3 text-sm font-medium transition-colors hover:opacity-70"
            style={{
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
              background: "transparent",
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

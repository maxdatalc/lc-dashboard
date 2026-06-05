"use client";

// Modal de sincronização inicial com 3 abas independentes: Vendas, O.S. e Produtos.
// Cada aba controla seu próprio ciclo de sync — período compartilhado, execução separada.

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Wrench,
  Package,
  FileText,
  ArrowRight,
  AlertTriangle,
  Users,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  lojaId: string;
  nomeLoja: string;
  syncServicesEnabled: boolean;
  onConcluido: () => void;
  onCancelar: () => void;
}

type AbaId = "vendas" | "os" | "produtos" | "itens" | "atendente";
type StatusSync = "idle" | "rodando" | "concluido" | "erro";
type StatusMes = "pendente" | "atual" | "concluido" | "erro";

interface EstadoAbaMensal {
  status: StatusSync;
  statusMeses: Record<string, StatusMes>;
  mesAtual: string | null;
  totalItens: number;
  erros: string[];
}

interface EstadoProdutos {
  status: StatusSync;
  paginaAtual: number;
  totalPaginas: number;
  produtosSalvos: number;
  erro: string | null;
}

interface EstadoItens {
  status: StatusSync;
  offset: number;
  itensSalvos: number;
  pagamentosSalvos: number;
  erros: string[];
}

interface SyncQueueJob {
  id: string;
  loja_id: string;
  tipo: string;
  data_ini: string;
  data_fim: string;
  pagina_atual: number;
  total_paginas: number | null;
  registros_salvos: number;
  status: string;
}

interface SyncQueueStatus {
  jobs: SyncQueueJob[];
  resumo: {
    total: number;
    concluidos: number;
    erros: number;
    pendentes: number;
    processando: number;
    registros: number;
  };
}

// ── Presets de período ────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Hoje", dias: 0 },
  { label: "7d", dias: 7 },
  { label: "30d", dias: 30 },
  { label: "3m", dias: 90 },
  { label: "6m", dias: 180 },
  { label: "13m", dias: 395 },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOJE = new Date();

interface MesPeriodo {
  dataInicial: string; // primeiro dia do mês: "2025-05-01"
  dataFinal: string;   // último dia do mês: "2025-05-31"
  label: string;       // "Mai/25"
}

const NOMES_MESES = ["Jan","Fev","Mar","Abr","Mai","Jun",
                     "Jul","Ago","Set","Out","Nov","Dez"];

// Divide um intervalo em meses completos para envio à rota de sync
function calcularMeses(inicio: string, fim: string): MesPeriodo[] {
  const meses: MesPeriodo[] = [];
  const d = new Date(inicio + "T12:00:00");
  const f = new Date(fim + "T12:00:00");

  while (d <= f) {
    const ano = d.getFullYear();
    const mes = d.getMonth();

    // Respeitar as datas exatas do período selecionado nas extremidades
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const dataIni =
      primeiroDia < new Date(inicio + "T12:00:00")
        ? inicio
        : primeiroDia.toISOString().split("T")[0];

    const dataFim =
      ultimoDia > f
        ? fim
        : ultimoDia.toISOString().split("T")[0];

    const label = `${NOMES_MESES[mes]}/${String(ano).slice(2)}`;

    meses.push({ dataInicial: dataIni, dataFinal: dataFim, label });

    // Avançar para o primeiro dia do próximo mês
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
  }

  return meses;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function subDias(d: Date, dias: number): Date {
  return new Date(d.getTime() - dias * 86400000);
}

function badgeDeStatus(status: StatusSync): { cor: string; label: string } {
  switch (status) {
    case "rodando":  return { cor: "var(--accent-cyan, #00e5ff)", label: "Rodando..." };
    case "concluido": return { cor: "#10b981", label: "Concluído" };
    case "erro":     return { cor: "#ef4444", label: "Erro" };
    default:         return { cor: "var(--text-muted)", label: "Aguardando" };
  }
}

// ── Sub-componente: grade de meses com status colorido ────────────────────────

function GridMeses({
  statusMeses,
}: {
  statusMeses: Record<string, StatusMes>;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {Object.entries(statusMeses).map(([mes, status]) => (
        <div
          key={mes}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs"
          style={{
            background:
              status === "concluido" ? "rgba(16,185,129,0.1)"
              : status === "erro"     ? "rgba(239,68,68,0.1)"
              : status === "atual"    ? "rgba(0,229,255,0.08)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${
              status === "concluido" ? "rgba(16,185,129,0.25)"
              : status === "erro"     ? "rgba(239,68,68,0.25)"
              : status === "atual"    ? "rgba(0,229,255,0.25)"
              : "var(--border-subtle)"
            }`,
          }}
        >
          {status === "concluido" && (
            <CheckCircle className="h-3 w-3 flex-shrink-0 text-emerald-500" />
          )}
          {status === "erro" && (
            <XCircle className="h-3 w-3 flex-shrink-0 text-red-500" />
          )}
          {status === "atual" && (
            <Loader2
              className="h-3 w-3 flex-shrink-0 animate-spin"
              style={{ color: "var(--accent-cyan, #00e5ff)" }}
            />
          )}
          {status === "pendente" && <span className="w-3 h-3 flex-shrink-0" />}
          <span
            className="truncate"
            style={{
              color:
                status === "concluido" ? "#10b981"
                : status === "erro"     ? "#ef4444"
                : status === "atual"    ? "var(--accent-cyan, #00e5ff)"
                : "var(--text-muted)",
            }}
          >
            {mes}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sub-componente: resumo pós-sync de aba mensal ─────────────────────────────

function ResumoSyncComp({
  totalItens,
  erros,
  mesesOk,
  totalMeses,
  labelItens,
}: {
  totalItens: number;
  erros: string[];
  mesesOk: number;
  totalMeses: number;
  labelItens: string;
}) {
  return (
    <div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>Meses processados</span>
          <span
            className="font-medium font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {mesesOk}/{totalMeses}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>{labelItens}</span>
          <span
            className="font-medium font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {totalItens.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
      {erros.length > 0 && (
        <div
          className="rounded-lg p-3 border"
          style={{
            borderColor: "rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.05)",
          }}
        >
          <p className="text-xs font-semibold text-red-500 mb-1.5">
            {erros.length} {erros.length === 1 ? "erro" : "erros"}
          </p>
          <ul className="space-y-1">
            {erros.map((e, i) => (
              <li
                key={i}
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {typeof e === "string" ? e : JSON.stringify(e)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: conteúdo para abas Vendas e O.S. (mês a mês) ─────────────

function SyncAbaContent({
  estado,
  mesesPreview,
  labelItens,
  disabled,
  disabledMsg,
  onIniciar,
}: {
  estado: EstadoAbaMensal;
  mesesPreview: string[];
  labelItens: string;
  disabled?: boolean;
  disabledMsg?: string;
  onIniciar: () => void;
}) {
  const totalMeses = Object.keys(estado.statusMeses).length;
  const mesesOk = Object.values(estado.statusMeses).filter(
    (s) => s === "concluido"
  ).length;

  if (disabled) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <Wrench className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
        </div>
        <p
          className="text-sm text-center max-w-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {disabledMsg ?? "Funcionalidade não habilitada para esta loja."}
        </p>
      </div>
    );
  }

  if (estado.status === "idle") {
    return (
      <div>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          {mesesPreview.length > 0
            ? `${mesesPreview.length} ${
                mesesPreview.length === 1
                  ? "mês será sincronizado"
                  : "meses serão sincronizados"
              } — estimativa: ~${mesesPreview.length} min`
            : "Selecione um período acima para continuar."}
        </p>
        <button
          onClick={onIniciar}
          disabled={mesesPreview.length === 0}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--accent-cyan, #00e5ff)", color: "#0a0f1e" }}
        >
          Iniciar sincronização
        </button>
      </div>
    );
  }

  if (estado.status === "rodando") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Loader2
            className="h-4 w-4 animate-spin flex-shrink-0"
            style={{ color: "var(--accent-cyan, #00e5ff)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {mesesOk} de {totalMeses} meses
            {estado.mesAtual ? ` — processando ${estado.mesAtual}` : ""}
          </span>
        </div>
        <GridMeses statusMeses={estado.statusMeses} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {estado.status === "concluido" ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {estado.status === "concluido"
            ? "Sincronização concluída"
            : "Sincronização com erros"}
        </span>
      </div>
      <ResumoSyncComp
        totalItens={estado.totalItens}
        erros={estado.erros}
        mesesOk={mesesOk}
        totalMeses={totalMeses}
        labelItens={labelItens}
      />
    </div>
  );
}

// ── Sub-componente: conteúdo da aba Produtos (página a página) ────────────────

function SyncProdutosContent({
  estado,
  onIniciar,
}: {
  estado: EstadoProdutos;
  onIniciar: () => void;
}) {
  if (estado.status === "idle") {
    return (
      <div>
        <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
          Sincroniza o catálogo completo de produtos página por página (100
          produtos/página).
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
          O período selecionado acima não se aplica aos produtos — o catálogo
          inteiro será importado.
        </p>
        <button
          onClick={onIniciar}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: "var(--accent-cyan, #00e5ff)", color: "#0a0f1e" }}
        >
          Iniciar sincronização
        </button>
      </div>
    );
  }

  if (estado.status === "rodando") {
    const progresso =
      estado.totalPaginas > 0
        ? Math.round((estado.paginaAtual / estado.totalPaginas) * 100)
        : 0;

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Loader2
              className="h-4 w-4 animate-spin flex-shrink-0"
              style={{ color: "var(--accent-cyan, #00e5ff)" }}
            />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Página {estado.paginaAtual.toLocaleString("pt-BR")}
              {estado.totalPaginas > 0
                ? ` de ${estado.totalPaginas.toLocaleString("pt-BR")}`
                : ""}
            </span>
          </div>
          {estado.totalPaginas > 0 && (
            <span
              className="text-xs font-mono"
              style={{ color: "var(--accent-cyan, #00e5ff)" }}
            >
              {progresso}%
            </span>
          )}
        </div>
        {/* Barra de progresso gradiente */}
        <div
          className="rounded-full h-1.5 overflow-hidden mb-3"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progresso}%`,
              background:
                "linear-gradient(90deg, var(--accent-cyan, #00e5ff), #0088ff)",
            }}
          />
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {estado.produtosSalvos.toLocaleString("pt-BR")} produtos salvos até
          agora
        </p>
      </div>
    );
  }

  if (estado.status === "concluido") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Catálogo sincronizado
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--text-muted)" }}>
              Produtos importados
            </span>
            <span
              className="font-medium font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {estado.produtosSalvos.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--text-muted)" }}>
              Páginas processadas
            </span>
            <span
              className="font-medium font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {estado.totalPaginas.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // status === "erro"
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <XCircle className="h-4 w-4 text-red-500" />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Erro na sincronização
        </span>
      </div>
      <p
        className="text-xs rounded-lg p-3 border"
        style={{
          borderColor: "rgba(239,68,68,0.25)",
          background: "rgba(239,68,68,0.05)",
          color: "#ef4444",
        }}
      >
        {estado.erro}
      </p>
    </div>
  );
}

// ── Sub-componente: conteúdo da aba Itens & Pagamentos ───────────────────────

function SyncItensContent({
  estado,
  onIniciar,
  onReiniciar,
}: {
  estado: EstadoItens;
  onIniciar: () => void;
  onReiniciar: () => void;
}) {
  if (estado.status === "idle") {
    return (
      <div>
        <div
          className="rounded-lg p-3 mb-3 text-xs"
          style={{
            background: "rgba(0,229,255,0.06)",
            border: "1px solid rgba(0,229,255,0.15)",
            color: "var(--accent-cyan, #00e5ff)",
          }}
        >
          <p className="font-semibold mb-1">⚡ Por que sincronizar itens?</p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Busca os produtos e formas de pagamento de cada venda.
            Necessário para os gráficos de{" "}
            <strong>Top Produtos</strong> e{" "}
            <strong>Formas de Pagamento</strong> funcionarem.
          </p>
        </div>
        <div
          className="rounded-lg p-3 mb-4 text-xs"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
            color: "#f59e0b",
          }}
        >
          ⏱️ Esta etapa pode demorar dependendo do volume de vendas.
          Não feche esta janela durante o processo.
        </div>
        <button
          onClick={onIniciar}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: "var(--accent-cyan, #00e5ff)", color: "#0a0f1e" }}
        >
          Iniciar sincronização
        </button>
      </div>
    );
  }

  if (estado.status === "rodando") {
    const loteAtual = Math.floor(estado.offset / 50) + 1;

    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Loader2
            className="h-4 w-4 animate-spin flex-shrink-0"
            style={{ color: "var(--accent-cyan, #00e5ff)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Buscando itens e pagamentos — lote {loteAtual}...
          </span>
        </div>

        {/* Contadores em tempo real */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-lg p-3 text-center"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              className="text-xl font-semibold mb-0.5 tabular-nums"
              style={{
                color: "var(--accent-cyan, #00e5ff)",
                fontFamily: "DM Serif Display, serif",
              }}
            >
              {estado.itensSalvos.toLocaleString("pt-BR")}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              itens sincronizados
            </div>
          </div>
          <div
            className="rounded-lg p-3 text-center"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              className="text-xl font-semibold mb-0.5 tabular-nums"
              style={{
                color: "#7c3aed",
                fontFamily: "DM Serif Display, serif",
              }}
            >
              {estado.pagamentosSalvos.toLocaleString("pt-BR")}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              pagamentos sincronizados
            </div>
          </div>
        </div>

        {/* Barra indeterminada */}
        <div
          className="rounded-full h-1.5 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full w-2/5 rounded-full shimmer"
            style={{
              background:
                "linear-gradient(90deg, var(--accent-cyan, #00e5ff), #7c3aed)",
            }}
          />
        </div>

        <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
          ⚠️ Não feche esta janela durante a sincronização
        </p>
      </div>
    );
  }

  // concluido ou erro
  const sucesso = estado.status === "concluido";

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {sucesso ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {sucesso ? "Itens sincronizados com sucesso!" : "Concluído com erros"}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>Itens de venda</span>
          <span className="font-medium font-mono" style={{ color: "var(--text-primary)" }}>
            {estado.itensSalvos.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-muted)" }}>Pagamentos</span>
          <span className="font-medium font-mono" style={{ color: "var(--text-primary)" }}>
            {estado.pagamentosSalvos.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>

      {estado.erros.length > 0 && (
        <div
          className="rounded-lg p-3 border mb-4"
          style={{
            borderColor: "rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.05)",
          }}
        >
          <p className="text-xs font-semibold text-red-500 mb-1.5">
            {estado.erros.length} erro(s) — podem ser vendas sem itens no ERP
          </p>
          <ul className="space-y-1">
            {estado.erros.slice(0, 5).map((e, i) => (
              <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onReiniciar}
        className="text-sm px-4 py-2 rounded-lg transition-colors"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
      >
        Rodar novamente
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SyncInicialModal({
  lojaId,
  nomeLoja,
  syncServicesEnabled,
  onConcluido,
  onCancelar,
}: Props) {
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("vendas");
  const [dataInicio, setDataInicio] = useState(toInputDate(subDias(HOJE, 395)));
  const [dataFim, setDataFim] = useState(toInputDate(HOJE));

  const [estadoVendas, setEstadoVendas] = useState<EstadoAbaMensal>({
    status: "idle",
    statusMeses: {},
    mesAtual: null,
    totalItens: 0,
    erros: [],
  });
  const [estadoOs, setEstadoOs] = useState<EstadoAbaMensal>({
    status: "idle",
    statusMeses: {},
    mesAtual: null,
    totalItens: 0,
    erros: [],
  });
  const [estadoProdutos, setEstadoProdutos] = useState<EstadoProdutos>({
    status: "idle",
    paginaAtual: 0,
    totalPaginas: 0,
    produtosSalvos: 0,
    erro: null,
  });

  const [estadoItens, setEstadoItens] = useState<EstadoItens>({
    status: "idle",
    offset: 0,
    itensSalvos: 0,
    pagamentosSalvos: 0,
    erros: [],
  });

  const [statusAtendente, setStatusAtendente] = useState<StatusSync>("idle");
  const [erroAtual, setErroAtual] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);

  const canceladoRef = useRef(false);

  // ── Modo background: sync via fila pg_cron ────────────────────────────────
  const [modoBackground, setModoBackground] = useState(false);
  const [jobsStatus, setJobsStatus] = useState<SyncQueueStatus | null>(null);

  // Na montagem: verificar jobs existentes e restaurar estado correto
  useEffect(() => {
    fetch(`/api/admin/sync-queue?lojaId=${lojaId}`)
      .then((r) => r.json() as Promise<SyncQueueStatus>)
      .then((data) => {
        // Sem jobs — estado idle é correto, não fazer nada
        if (data.resumo.total === 0) return;

        // Há jobs — sempre mostrar o painel de background
        setJobsStatus(data);
        setModoBackground(true);

        const temAtivos = data.resumo.pendentes > 0 || data.resumo.processando > 0;
        const todosOk = data.resumo.concluidos === data.resumo.total;
        const temErro = data.resumo.erros > 0;

        if (todosOk) {
          setEstadoVendas((prev) => ({ ...prev, status: "concluido" }));
        } else if (temErro && !temAtivos) {
          setEstadoVendas((prev) => ({ ...prev, status: "erro" }));
        } else {
          setEstadoVendas((prev) => ({ ...prev, status: "rodando" }));
        }
      })
      .catch(() => {}); // silencioso — falha não deve bloquear o modal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId]);

  // Polling a cada 5s quando em modo background
  useEffect(() => {
    if (!modoBackground) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/sync-queue?lojaId=${lojaId}`);
        if (!res.ok) return;
        const data = (await res.json()) as SyncQueueStatus;
        setJobsStatus(data);

        const temAtivos = data.resumo.pendentes > 0 || data.resumo.processando > 0;
        const todosOk = data.resumo.concluidos === data.resumo.total;
        const temErro = data.resumo.erros > 0;

        // Quando não há mais jobs ativos, definir status final e parar o polling
        if (!temAtivos) {
          if (todosOk) {
            setEstadoVendas((prev) => ({ ...prev, status: "concluido" }));
          } else if (temErro) {
            setEstadoVendas((prev) => ({ ...prev, status: "erro" }));
          }
        }
      } catch {
        // Erros de polling são silenciosos — próxima tentativa em 5s
      }
    };

    void poll(); // primeira chamada imediata
    const interval = setInterval(() => void poll(), 5000);
    return () => clearInterval(interval);
  }, [modoBackground, lojaId]);

  const aplicarPreset = (dias: number) => {
    setDataInicio(
      dias === 0 ? toInputDate(HOJE) : toInputDate(subDias(HOJE, dias))
    );
    setDataFim(toInputDate(HOJE));
  };

  // Meses do período selecionado — recalculado ao mudar datas
  const periodosPreview =
    dataInicio && dataFim ? calcularMeses(dataInicio, dataFim) : [];

  // Labels para o SyncAbaContent (mantém assinatura do componente)
  const mesesPreview = periodosPreview.map((m) => m.label);

  // ── Sync via fila pg_cron — exclusivo para aba Vendas ────────────────────

  const iniciarSyncVendas = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setEstadoVendas((prev) => ({ ...prev, status: "rodando" }));

    try {
      // Verificar se já existem jobs ativos para retomar monitoramento
      const statusRes = await fetch(`/api/admin/sync-queue?lojaId=${lojaId}`);
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as SyncQueueStatus;
        const temAtivos =
          statusData.resumo.pendentes > 0 || statusData.resumo.processando > 0;

        if (temAtivos) {
          setJobsStatus(statusData);
          setModoBackground(true);
          return;
        }
      }

      // Enfileirar todos os meses de uma vez
      const res = await fetch("/api/admin/sync-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lojaId,
          dataInicial: dataInicio,
          dataFinal: dataFim,
          tipo: "vendas",
        }),
      });

      const data = (await res.json()) as { sucesso?: boolean; error?: string };

      if (!res.ok) {
        setEstadoVendas((prev) => ({
          ...prev,
          status: "erro",
          erros: [data.error ?? "Erro ao enfileirar sync"],
        }));
        return;
      }

      // Ativar modo background — polling cuidará do progresso
      setModoBackground(true);
    } catch {
      setEstadoVendas((prev) => ({
        ...prev,
        status: "erro",
        erros: ["Erro de conexão ao enfileirar sync"],
      }));
    }
  }, [lojaId, dataInicio, dataFim]);

  // ── Sync completo: enfileira vendas + OS + produtos + itens de uma vez ────

  const iniciarSyncCompleto = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setEstadoVendas((prev) => ({ ...prev, status: "rodando" }));

    try {
      const res = await fetch("/api/admin/sync-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lojaId,
          dataInicial: dataInicio,
          dataFinal: dataFim,
          tipo: "completo",
        }),
      });

      const data = (await res.json()) as { sucesso?: boolean; error?: string };

      if (!res.ok) {
        setEstadoVendas((prev) => ({
          ...prev,
          status: "erro",
          erros: [data.error ?? "Erro ao enfileirar sync completo"],
        }));
        return;
      }

      setModoBackground(true);
    } catch {
      setEstadoVendas((prev) => ({
        ...prev,
        status: "erro",
        erros: ["Erro de conexão"],
      }));
    }
  }, [lojaId, dataInicio, dataFim]);

  // ── Retry: reseta jobs com erro para pendente e retoma do ponto salvo ─────

  const tentarNovamente = useCallback(async () => {
    setRetryLoading(true);
    try {
      const res = await fetch("/api/admin/sync-queue/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId }),
      });

      const data = (await res.json()) as { sucesso?: boolean; resetados?: number; error?: string };

      if (!res.ok) {
        console.error("Erro ao resetar jobs:", data.error);
        return;
      }

      // Jobs resetados — atualizar status local e forçar polling imediato
      if ((data.resetados ?? 0) > 0) {
        setEstadoVendas((prev) => ({ ...prev, status: "rodando" }));
        const statusRes = await fetch(`/api/admin/sync-queue?lojaId=${lojaId}`);
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as SyncQueueStatus;
          setJobsStatus(statusData);
        }
      }
    } catch (err) {
      console.error("Erro no retry:", err);
    } finally {
      setRetryLoading(false);
    }
  }, [lojaId]);

  // ── Sync de atendentes — job único enfileirado em background ─────────────

  const iniciarSyncAtendente = useCallback(async () => {
    setStatusAtendente("rodando");
    setErroAtual(null);

    try {
      const res = await fetch("/api/admin/sync-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lojaId,
          dataInicial: dataInicio,
          dataFinal: dataFim,
          tipo: "atendente",
        }),
      });

      const data = (await res.json()) as { sucesso?: boolean; error?: string };

      if (!res.ok) {
        setErroAtual(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setStatusAtendente("erro");
        return;
      }

      setModoBackground(true);
    } catch {
      setErroAtual("Erro de conexão");
      setStatusAtendente("erro");
    }
  }, [lojaId, dataInicio, dataFim]);

  // ── Sync mensal genérico — usado por Vendas e OS ──────────────────────────

  const iniciarSyncMensal = useCallback(
    async (
      meses: MesPeriodo[],
      setEstado: React.Dispatch<React.SetStateAction<EstadoAbaMensal>>
    ) => {
      if (meses.length === 0) return;

      // Aviso para períodos longos (> 6 meses)
      if (meses.length > 6) {
        const ok = window.confirm(
          `⚠️ Período de ${meses.length} meses.\n` +
          `Estimativa: ~${meses.length} minuto(s).\n\nContinuar?`
        );
        if (!ok) return;
      }

      canceladoRef.current = false;

      const statusInicial: Record<string, StatusMes> = {};
      for (const m of meses) statusInicial[m.label] = "pendente";

      setEstado({
        status: "rodando",
        statusMeses: statusInicial,
        mesAtual: null,
        totalItens: 0,
        erros: [],
      });

      let totalItens = 0;
      const erros: string[] = [];

      for (let i = 0; i < meses.length; i++) {
        if (canceladoRef.current) break;
        const mes = meses[i];

        setEstado((prev) => ({
          ...prev,
          mesAtual: mes.label,
          statusMeses: { ...prev.statusMeses, [mes.label]: "atual" },
        }));

        // Sincroniza um período completo — trata automaticamente meses com
        // muitas páginas que requerem múltiplos requests (pageLimit)
        const sincronizarPeriodo = async (
          dataIni: string,
          dataFim: string
        ): Promise<number> => {
          let totalSalvo = 0;
          let proximaPagina = 1;
          const MAX_CHUNKS = 20; // máximo de requests por mês (segurança)

          for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
            const res = await fetch("/api/admin/sync-inicial", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lojaId,
                dataInicial: dataIni,
                dataFinal: dataFim,
                pageLimit: 50,
                startPage: proximaPagina,
              }),
            });

            const data = (await res.json()) as {
              vendas_salvas?: number;
              concluido?: boolean;
              proxima_pagina?: number;
              error?: string;
            };

            if (!res.ok) {
              const msgErro =
                typeof data.error === "string"
                  ? data.error
                  : (JSON.stringify(data.error) ?? "Erro desconhecido");
              throw new Error(msgErro);
            }

            totalSalvo += data.vendas_salvas ?? 0;

            // Mês concluído — sair do loop de chunks
            if (data.concluido !== false) break;

            // Continuar da próxima página
            proximaPagina = data.proxima_pagina ?? proximaPagina + 150;

            // Pequeno delay entre chunks do mesmo mês
            await new Promise((r) => setTimeout(r, 200));
          }

          return totalSalvo;
        };

        try {
          const vendas = await sincronizarPeriodo(mes.dataInicial, mes.dataFinal);
          totalItens += vendas;
          setEstado((prev) => ({
            ...prev,
            statusMeses: { ...prev.statusMeses, [mes.label]: "concluido" },
            totalItens,
          }));
        } catch (e) {
          erros.push(
            `${mes.label}: ${e instanceof Error ? e.message : "Erro de rede"}`
          );
          setEstado((prev) => ({
            ...prev,
            statusMeses: { ...prev.statusMeses, [mes.label]: "erro" },
          }));
        }

        // Pausa entre meses
        await new Promise((r) => setTimeout(r, 300));
      }

      setEstado((prev) => ({
        ...prev,
        status: erros.length === meses.length ? "erro" : "concluido",
        mesAtual: null,
        totalItens,
        erros,
      }));
    },
    [lojaId]
  );

  // ── Sync de produtos: loop por página até concluido ───────────────────────

  const iniciarSyncProdutos = useCallback(async () => {
    canceladoRef.current = false;
    setEstadoProdutos({
      status: "rodando",
      paginaAtual: 1,
      totalPaginas: 0,
      produtosSalvos: 0,
      erro: null,
    });

    let pagina = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (canceladoRef.current) break;

      try {
        const res = await fetch("/api/admin/sync-produtos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lojaId, pagina }),
        });
        const data = (await res.json()) as {
          pagina_processada?: number;
          produtos_salvos?: number;
          proxima_pagina?: number | null;
          total_paginas?: number;
          concluido?: boolean;
          error?: string;
        };

        if (!res.ok) {
          setEstadoProdutos((prev) => ({
            ...prev,
            status: "erro",
            erro: data.error ?? "Erro desconhecido",
          }));
          break;
        }

        setEstadoProdutos((prev) => ({
          ...prev,
          paginaAtual: data.pagina_processada ?? pagina,
          totalPaginas: data.total_paginas ?? prev.totalPaginas,
          produtosSalvos: prev.produtosSalvos + (data.produtos_salvos ?? 0),
        }));

        if (data.concluido || !data.proxima_pagina) {
          setEstadoProdutos((prev) => ({ ...prev, status: "concluido" }));
          break;
        }

        pagina = data.proxima_pagina;
      } catch (e) {
        setEstadoProdutos((prev) => ({
          ...prev,
          status: "erro",
          erro: e instanceof Error ? e.message : "Erro de rede",
        }));
        break;
      }
    }
  }, [lojaId]);

  // ── Sync de itens e pagamentos: loop por offset até tem_mais = false ─────

  const iniciarSyncItens = useCallback(async () => {
    canceladoRef.current = false;
    setEstadoItens({
      status: "rodando",
      offset: 0,
      itensSalvos: 0,
      pagamentosSalvos: 0,
      erros: [],
    });

    const LIMIT = 50;
    let offset = 0;
    let itensSalvos = 0;
    let pagamentosSalvos = 0;
    const erros: string[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (canceladoRef.current) break;

      let tentativas = 0;
      let sucesso = false;

      while (tentativas < 3) {
        try {
          const res = await fetch(
            `/api/dashboard/resync-items?lojaId=${lojaId}&limit=${LIMIT}&offset=${offset}`
          );
          const data = (await res.json()) as {
            itens_sincronizados?: number;
            pagamentos_sincronizados?: number;
            erros?: string[];
            tem_mais?: boolean;
            error?: string;
          };

          if (!res.ok) {
            erros.push(`offset ${offset}: ${data.error ?? res.status}`);
            tentativas++;
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          itensSalvos += data.itens_sincronizados ?? 0;
          pagamentosSalvos += data.pagamentos_sincronizados ?? 0;

          if (data.erros && data.erros.length > 0) {
            erros.push(...data.erros.slice(0, 3));
          }

          setEstadoItens((prev) => ({
            ...prev,
            offset,
            itensSalvos,
            pagamentosSalvos,
          }));

          if (!data.tem_mais) {
            setEstadoItens((prev) => ({
              ...prev,
              status: erros.length > 0 ? "erro" : "concluido",
              erros,
            }));
            return;
          }

          offset += LIMIT;
          sucesso = true;
          break;
        } catch (e) {
          tentativas++;
          if (tentativas >= 3) {
            erros.push(
              `offset ${offset}: ${e instanceof Error ? e.message : "Erro de rede"}`
            );
          } else {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      if (!sucesso) break;

      // Pausa entre lotes para não sobrecarregar a API
      await new Promise((r) => setTimeout(r, 1000));
    }

    setEstadoItens((prev) => ({
      ...prev,
      status: erros.length > 0 ? "erro" : "concluido",
      erros,
    }));
  }, [lojaId]);

  // ── Status consolidado ────────────────────────────────────────────────────

  const abaStatus: Record<AbaId, StatusSync> = {
    vendas: estadoVendas.status,
    os: estadoOs.status,
    produtos: estadoProdutos.status,
    itens: estadoItens.status,
    atendente: statusAtendente,
  };

  // No modo background o sync continua no servidor — permitir fechar o modal
  const algumaRodando =
    !modoBackground && Object.values(abaStatus).some((s) => s === "rodando");
  const algumaConcluida = Object.values(abaStatus).some(
    (s) => s === "concluido"
  );

  const ABAS: {
    id: AbaId;
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }[] = [
    { id: "vendas", label: "Vendas", icon: ShoppingCart },
    { id: "os", label: "O.S.", icon: Wrench },
    { id: "produtos", label: "Produtos", icon: Package },
    { id: "itens", label: "Itens", icon: FileText },
    { id: "atendente", label: "Atendentes", icon: Users },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* ── Cabeçalho: título + seletor de período ─────────────────────── */}
        <div
          className="px-6 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Sincronização inicial — {nomeLoja}
              </h3>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Importe dados históricos do ERP por categoria
              </p>
            </div>
            {!algumaRodando && (
              <button
                onClick={onCancelar}
                className="p-1 rounded-md hover:opacity-60 transition-opacity ml-4 flex-shrink-0"
              >
                <XCircle
                  className="h-4 w-4"
                  style={{ color: "var(--text-muted)" }}
                />
              </button>
            )}
          </div>

          {/* Presets de período */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => aplicarPreset(p.dias)}
                disabled={algumaRodando}
                className="text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Inputs de data */}
          <div className="flex items-end gap-2 mb-3">
            <div className="flex-1">
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                De
              </label>
              <input
                type="date"
                value={dataInicio}
                max={dataFim}
                disabled={algumaRodando}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="pb-2 flex-shrink-0">
              <ArrowRight
                className="h-3.5 w-3.5"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
            <div className="flex-1">
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                Até
              </label>
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                max={toInputDate(HOJE)}
                disabled={algumaRodando}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Banner de consistência */}
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              background: "rgba(255,193,7,0.08)",
              border: "1px solid rgba(255,193,7,0.2)",
            }}
          >
            <AlertTriangle
              className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
              style={{ color: "#ffc107" }}
            />
            <span style={{ color: "#ffc107" }}>
              Para melhor consistência, recomendamos usar o mesmo período em
              Vendas, O.S. e Produtos
            </span>
          </div>

          {/* Sync Completo — enfileira tudo de uma vez em background */}
          {!modoBackground && estadoVendas.status === "idle" && (
            <div
              className="mt-3 p-4 rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(0,229,255,0.08), rgba(124,58,237,0.08))",
                border: "1px solid rgba(0,229,255,0.2)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    ⚡ Sync Completo
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Sincroniza vendas, OS, produtos e itens em background.
                    Pode fechar esta janela — o processo continua automaticamente.
                  </p>
                </div>
                <button
                  onClick={iniciarSyncCompleto}
                  disabled={!dataInicio || !dataFim}
                  className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--accent-cyan, #00e5ff)", color: "#0a0f1e", whiteSpace: "nowrap" }}
                >
                  Iniciar tudo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Navegação entre abas ───────────────────────────────────────── */}
        <div
          className="px-6 pt-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex gap-0.5">
            {ABAS.map(({ id, label, icon: Icon }) => {
              const s = abaStatus[id];
              const badge = badgeDeStatus(s);
              const isActive = abaAtiva === id;

              return (
                <button
                  key={id}
                  onClick={() => setAbaAtiva(id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-t-lg transition-colors"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.05)"
                      : "transparent",
                    color: isActive
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    borderBottom: isActive
                      ? "2px solid var(--accent-cyan, #00e5ff)"
                      : "2px solid transparent",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {s !== "idle" && (
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: badge.cor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Conteúdo da aba ativa ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[180px]">
          {abaAtiva === "vendas" && (
            modoBackground && jobsStatus ? (
              // ── UI de progresso em background ─────────────────────────────
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {estadoVendas.status === "concluido" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--accent-cyan, #00e5ff)" }}
                    />
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: estadoVendas.status === "concluido"
                        ? "#10b981"
                        : "var(--accent-cyan, #00e5ff)",
                    }}
                  >
                    {estadoVendas.status === "concluido"
                      ? "Sincronização concluída!"
                      : "Sincronizando em background..."}
                  </span>
                </div>

                {/* Barra de progresso geral */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {jobsStatus.resumo.concluidos}/{jobsStatus.resumo.total} jobs
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {jobsStatus.resumo.registros.toLocaleString("pt-BR")} registros
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      style={{
                        width: `${
                          jobsStatus.resumo.total > 0
                            ? (jobsStatus.resumo.concluidos / jobsStatus.resumo.total) * 100
                            : 0
                        }%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--accent-cyan, #00e5ff), #7c3aed)",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Progresso agrupado por tipo */}
                <div className="space-y-3">
                  {(["vendas", "os", "produtos", "itens", "atendente"] as const).map((tipo) => {
                    const jobsTipo = jobsStatus.jobs.filter((j: SyncQueueJob) => j.tipo === tipo);
                    if (jobsTipo.length === 0) return null;

                    const concluidos = jobsTipo.filter((j: SyncQueueJob) => j.status === "concluido").length;
                    const total = jobsTipo.length;
                    const registros = jobsTipo.reduce((s: number, j: SyncQueueJob) => s + (j.registros_salvos ?? 0), 0);
                    const temErro = jobsTipo.some((j: SyncQueueJob) => j.status === "erro");
                    const processando = jobsTipo.some((j: SyncQueueJob) => j.status === "processando");

                    const labels: Record<string, string> = {
                      vendas: "📊 Vendas",
                      os: "🔧 O.S.",
                      produtos: "📦 Produtos",
                      itens: "🧾 Itens & Pgtos",
                      atendente: "👤 Atendentes",
                    };

                    return (
                      <div key={tipo}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            {labels[tipo]}
                          </span>
                          <span className="text-xs" style={{
                            color: temErro ? "#ef4444" : concluidos === total ? "#10b981" : "var(--text-muted)",
                          }}>
                            {temErro
                              ? "⚠️ erro"
                              : concluidos === total
                              ? "✓ concluído"
                              : processando
                              ? "⟳ processando..."
                              : `${concluidos}/${total}`}
                            {registros > 0 && ` — ${registros.toLocaleString("pt-BR")} reg.`}
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            style={{
                              width: `${total > 0 ? (concluidos / total) * 100 : 0}%`,
                              height: "100%",
                              background: temErro
                                ? "#ef4444"
                                : "linear-gradient(90deg, var(--accent-cyan, #00e5ff), #7c3aed)",
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botão tentar novamente — aparece só quando há erros e nenhum job ativo */}
                {jobsStatus &&
                  jobsStatus.resumo.erros > 0 &&
                  jobsStatus.resumo.pendentes === 0 &&
                  jobsStatus.resumo.processando === 0 && (
                    <div
                      className="mt-4 pt-3"
                      style={{ borderTop: "1px solid var(--border-subtle)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium" style={{ color: "#f59e0b" }}>
                            ⚠️ {jobsStatus.resumo.erros} job(s) com erro
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            Provavelmente o servidor ficou offline. Retoma de onde parou.
                          </p>
                        </div>
                        <button
                          onClick={tentarNovamente}
                          disabled={retryLoading}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex-shrink-0"
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            color: "#f59e0b",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.25)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
                        >
                          {retryLoading ? (
                            <>
                              <div
                                className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                                style={{ borderColor: "#f59e0b" }}
                              />
                              Resetando...
                            </>
                          ) : (
                            "↺ Tentar novamente"
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                <p className="text-xs mt-3 text-center" style={{ color: "var(--text-muted)" }}>
                  ✅ Pode fechar esta janela — o sync continua em background
                </p>

                {/* Botão "Novo sync" aparece quando tudo concluiu */}
                {estadoVendas.status === "concluido" && (
                  <div className="flex justify-center mt-3">
                    <button
                      onClick={() => {
                        setModoBackground(false);
                        setJobsStatus(null);
                        setEstadoVendas({ status: "idle", statusMeses: {}, mesAtual: null, totalItens: 0, erros: [] });
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      ↺ Iniciar novo sync
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <SyncAbaContent
                estado={estadoVendas}
                mesesPreview={mesesPreview}
                labelItens="Vendas importadas"
                onIniciar={iniciarSyncVendas}
              />
            )
          )}
          {abaAtiva === "os" && (
            <SyncAbaContent
              estado={estadoOs}
              mesesPreview={mesesPreview}
              labelItens="Ordens de serviço importadas"
              disabled={!syncServicesEnabled}
              disabledMsg="Sync de O.S. não está habilitado para esta loja. Ative a opção nas configurações da loja para habilitar."
              onIniciar={() => iniciarSyncMensal(periodosPreview, setEstadoOs)}
            />
          )}
          {abaAtiva === "produtos" && (
            <SyncProdutosContent
              estado={estadoProdutos}
              onIniciar={iniciarSyncProdutos}
            />
          )}
          {abaAtiva === "itens" && (
            <SyncItensContent
              estado={estadoItens}
              onIniciar={iniciarSyncItens}
              onReiniciar={() =>
                setEstadoItens({
                  status: "idle",
                  offset: 0,
                  itensSalvos: 0,
                  pagamentosSalvos: 0,
                  erros: [],
                })
              }
            />
          )}
          {abaAtiva === "atendente" && (
            <div>
              {statusAtendente === "idle" && (
                <>
                  <div
                    className="p-3 rounded-lg mb-4 text-xs"
                    style={{
                      background: "rgba(0,229,255,0.06)",
                      border: "1px solid rgba(0,229,255,0.15)",
                      color: "var(--accent-cyan, #00e5ff)",
                    }}
                  >
                    <p className="font-semibold mb-1">👤 Por que sincronizar atendentes?</p>
                    <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
                      Vincula o vendedor responsável a cada venda histórica.
                      Necessário para o gráfico de{" "}
                      <strong>Top 10 Vendedores</strong> funcionar.
                      Processa em background — pode fechar esta janela.
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg mb-4 text-xs"
                    style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      color: "#f59e0b",
                    }}
                  >
                    ⏱️ Esta etapa pode demorar algumas horas dependendo
                    do volume de vendas. O processo continua em background.
                  </div>
                  <button
                    onClick={iniciarSyncAtendente}
                    className="w-full py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: "var(--accent-cyan, #00e5ff)", color: "#0a0f1e" }}
                  >
                    Iniciar Sync de Atendentes
                  </button>
                </>
              )}
              {statusAtendente === "rodando" && modoBackground && (
                <div className="text-center py-8">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
                    style={{ borderColor: "var(--accent-cyan, #00e5ff)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--accent-cyan, #00e5ff)" }}>
                    Sincronizando em background...
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                    ✅ Pode fechar esta janela
                  </p>
                </div>
              )}
              {statusAtendente === "erro" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium" style={{ color: "#ef4444" }}>
                      Erro ao enfileirar sync de atendentes
                    </span>
                  </div>
                  {erroAtual && (
                    <p
                      className="text-xs p-3 rounded-lg border"
                      style={{
                        borderColor: "rgba(239,68,68,0.25)",
                        background: "rgba(239,68,68,0.05)",
                        color: "#ef4444",
                      }}
                    >
                      {erroAtual}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Rodapé: status das 3 abas + botões de ação ────────────────── */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0 flex-wrap gap-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* Indicadores de status */}
          <div className="flex items-center gap-4 flex-wrap">
            {ABAS.map(({ id, label, icon: Icon }) => {
              const s = abaStatus[id];
              const badge = badgeDeStatus(s);
              return (
                <div key={id} className="flex items-center gap-1.5 text-xs">
                  <Icon className="h-3 w-3" style={{ color: badge.cor }} />
                  <span style={{ color: "var(--text-muted)" }}>{label}:</span>
                  <span style={{ color: badge.cor }}>{badge.label}</span>
                </div>
              );
            })}
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            {!algumaRodando && (
              <button
                onClick={onCancelar}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                {algumaConcluida ? "Fechar" : "Cancelar"}
              </button>
            )}
            {algumaConcluida && !algumaRodando && (
              <button
                onClick={onConcluido}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: "var(--accent-cyan, #00e5ff)",
                  color: "#0a0f1e",
                }}
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

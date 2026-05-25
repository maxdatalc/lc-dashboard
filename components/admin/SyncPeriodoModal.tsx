"use client";

import { useState, useRef } from "react";
import { Loader2, CheckCircle, XCircle, Calendar, ArrowRight } from "lucide-react";

interface Props {
  lojaId: string;
  nomeLoja: string;
  onConcluido: () => void;
  onCancelar: () => void;
}

type Estagio = "selecionar" | "sincronizando" | "concluido";
type StatusMes = "pendente" | "atual" | "concluido" | "erro";

interface ResumoSync {
  meses: string[];
  vendas_total: number;
  erros: string[];
  periodo: string;
}

// Gera array "YYYY-MM" entre duas datas (inclusivo)
function calcularMeses(inicio: Date, fim: Date): string[] {
  const meses: string[] = [];
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const end = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cur <= end) {
    meses.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return meses;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function subDias(d: Date, dias: number): Date {
  return new Date(d.getTime() - dias * 86400000);
}

const HOJE = new Date();

const PRESETS = [
  { label: "Hoje", dias: 0 },
  { label: "Ontem", dias: 1 },
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
  { label: "3 meses", dias: 90 },
  { label: "6 meses", dias: 180 },
  { label: "13 meses", dias: 395 },
] as const;

export function SyncPeriodoModal({
  lojaId,
  nomeLoja,
  onConcluido,
  onCancelar,
}: Props) {
  const [estagio, setEstagio] = useState<Estagio>("selecionar");
  const [dataInicio, setDataInicio] = useState(toInputDate(subDias(HOJE, 30)));
  const [dataFim, setDataFim] = useState(toInputDate(HOJE));

  const [statusMeses, setStatusMeses] = useState<Record<string, StatusMes>>({});
  const [mesAtual, setMesAtual] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoSync | null>(null);

  // Permite abortar o loop de sync ao cancelar (não exposta na UI, mas evita vazamentos)
  const canceladoRef = useRef(false);

  const aplicarPreset = (dias: number) => {
    setDataInicio(dias === 0 ? toInputDate(HOJE) : toInputDate(subDias(HOJE, dias)));
    setDataFim(toInputDate(HOJE));
  };

  const mesesPreview =
    dataInicio && dataFim
      ? calcularMeses(
          new Date(dataInicio + "T00:00:00"),
          new Date(dataFim + "T00:00:00")
        )
      : [];

  const iniciarSync = async () => {
    const meses = mesesPreview;
    if (meses.length === 0) return;

    if (meses.length > 6) {
      const ok = window.confirm(
        `Você selecionou ${meses.length} meses para sincronizar. Isso pode levar bastante tempo. Deseja continuar?`
      );
      if (!ok) return;
    }

    canceladoRef.current = false;
    setEstagio("sincronizando");

    const statusInicial: Record<string, StatusMes> = {};
    for (const m of meses) statusInicial[m] = "pendente";
    setStatusMeses(statusInicial);

    let vendasTotal = 0;
    const erros: string[] = [];

    for (let i = 0; i < meses.length; i++) {
      if (canceladoRef.current) break;

      const mes = meses[i];
      setMesAtual(mes);
      setStatusMeses((prev) => ({ ...prev, [mes]: "atual" }));

      try {
        const res = await fetch("/api/admin/sync-inicial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lojaId,
            mes,
            chunkAtual: i + 1,
            totalChunks: meses.length,
          }),
        });
        const data = (await res.json()) as {
          vendas_salvas?: number;
          error?: string;
        };
        if (!res.ok) {
          erros.push(`${mes}: ${data.error ?? "Erro desconhecido"}`);
          setStatusMeses((prev) => ({ ...prev, [mes]: "erro" }));
        } else {
          vendasTotal += data.vendas_salvas ?? 0;
          setStatusMeses((prev) => ({ ...prev, [mes]: "concluido" }));
        }
      } catch (e) {
        erros.push(`${mes}: ${e instanceof Error ? e.message : "Erro de rede"}`);
        setStatusMeses((prev) => ({ ...prev, [mes]: "erro" }));
      }
    }

    setMesAtual(null);
    setResumo({
      meses,
      vendas_total: vendasTotal,
      erros,
      periodo: `${dataInicio} → ${dataFim}`,
    });
    setEstagio("concluido");
  };

  const concluidoCount = Object.values(statusMeses).filter(
    (s) => s === "concluido"
  ).length;
  const totalMeses = Object.keys(statusMeses).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* ── Selecionar período ───────────────────────────────────────────── */}
        {estagio === "selecionar" && (
          <>
            <div className="mb-5">
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Sincronizar dados — {nomeLoja}
              </h3>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Selecione o período que deseja importar do ERP
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => aplicarPreset(p.dias)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-slate-100"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date pickers */}
            <div className="flex items-end gap-3 mb-4">
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
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div className="pb-2.5 flex-shrink-0">
                <ArrowRight
                  className="h-4 w-4"
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
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {mesesPreview.length > 0 && (
              <p
                className="text-xs mb-5"
                style={{ color: "var(--text-muted)" }}
              >
                {mesesPreview.length}{" "}
                {mesesPreview.length === 1 ? "mês será sincronizado" : "meses serão sincronizados"}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancelar}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancelar
              </button>
              <button
                onClick={iniciarSync}
                disabled={mesesPreview.length === 0}
                className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="h-3.5 w-3.5" />
                Iniciar sync
              </button>
            </div>
          </>
        )}

        {/* ── Sincronizando ────────────────────────────────────────────────── */}
        {estagio === "sincronizando" && (
          <>
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
                <div>
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Sincronizando — {nomeLoja}
                  </h3>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {concluidoCount} de {totalMeses} meses concluídos
                    {mesAtual && ` — processando ${mesAtual}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Object.entries(statusMeses).map(([mes, status]) => (
                <div
                  key={mes}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs"
                  style={{
                    background:
                      status === "concluido"
                        ? "rgba(16,185,129,0.1)"
                        : status === "erro"
                        ? "rgba(239,68,68,0.1)"
                        : status === "atual"
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(0,0,0,0.04)",
                    border: `1px solid ${
                      status === "concluido"
                        ? "rgba(16,185,129,0.25)"
                        : status === "erro"
                        ? "rgba(239,68,68,0.25)"
                        : status === "atual"
                        ? "rgba(59,130,246,0.25)"
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
                    <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
                  )}
                  {status === "pendente" && (
                    <span className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span
                    className="truncate"
                    style={{
                      color:
                        status === "concluido"
                          ? "#10b981"
                          : status === "erro"
                          ? "#ef4444"
                          : status === "atual"
                          ? "#3b82f6"
                          : "var(--text-muted)",
                    }}
                  >
                    {mes}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Concluído ────────────────────────────────────────────────────── */}
        {estagio === "concluido" && resumo && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3
                  className="text-base font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Sync concluído — {nomeLoja}
                </h3>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {resumo.periodo}
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>
                  Meses processados
                </span>
                <span
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {resumo.meses.length - resumo.erros.length} /{" "}
                  {resumo.meses.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>
                  Vendas importadas
                </span>
                <span
                  className="font-medium font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {resumo.vendas_total.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {resumo.erros.length > 0 && (
              <div
                className="mb-5 rounded-lg p-3 border"
                style={{
                  borderColor: "rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.05)",
                }}
              >
                <p className="text-xs font-semibold text-red-600 mb-2">
                  {resumo.erros.length}{" "}
                  {resumo.erros.length === 1 ? "erro" : "erros"}
                </p>
                <ul className="space-y-1">
                  {resumo.erros.map((e, i) => (
                    <li
                      key={i}
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onConcluido}
              className="w-full text-sm px-4 py-2 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

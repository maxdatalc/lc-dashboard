"use client";

// Modal de sincronização inicial — processa 13 meses de histórico em chunks sequenciais.
// Cada chunk chama POST /api/admin/sync-inicial e aguarda a resposta antes de chamar o próximo.

import { useState, useCallback } from "react";
import {
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";

const TOTAL_CHUNKS = 13;

interface SyncStatus {
  status: "pendente" | "em_andamento" | "concluido" | "erro";
  chunk_atual: number;
  total_chunks: number;
  mes_atual: string | null;
  vendas_salvas: number;
  erros: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
}

interface ChunkResult {
  mes: string;
  vendas_salvas: number;
}

interface ChunkResponse {
  mes_processado?: string;
  vendas_salvas?: number;
  proximo_mes?: string | null;
  concluido?: boolean;
  error?: string;
}

function calcularStartMes(): string {
  const hoje = new Date();
  const start = new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
}

function formatarMes(mes: string): string {
  const [ano, mesNum] = mes.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[parseInt(mesNum) - 1]} ${ano}`;
}

interface Props {
  lojaId: string;
  lojaNome: string;
}

export function SyncInicialModal({ lojaId, lojaNome }: Props) {
  const [open, setOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<SyncStatus | null>(null);
  const [chunks, setChunks] = useState<ChunkResult[]>([]);
  const [currentMes, setCurrentMes] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingStatus, setFetchingStatus] = useState(false);

  // Busca status atual do DB
  const fetchStatus = useCallback(async () => {
    setFetchingStatus(true);
    try {
      const res = await fetch(`/api/admin/sync-inicial?lojaId=${lojaId}`);
      const data = (await res.json()) as SyncStatus;
      setDbStatus(data);
      if (data.status === "concluido") setDone(true);
    } catch {
      // status do DB é opcional — UI continua sem ele
    } finally {
      setFetchingStatus(false);
    }
  }, [lojaId]);

  const openModal = async () => {
    setOpen(true);
    setChunks([]);
    setError(null);
    setDone(false);
    setCurrentMes(null);
    await fetchStatus();
  };

  // Processa um chunk e, em caso de sucesso, chama o próximo recursivamente
  const processarChunk = useCallback(
    async (
      mes: string,
      chunkAtual: number,
      resultadosAcumulados: ChunkResult[]
    ): Promise<void> => {
      setCurrentMes(mes);

      const res = await fetch("/api/admin/sync-inicial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, mes, chunkAtual, totalChunks: TOTAL_CHUNKS }),
      });

      const data = (await res.json()) as ChunkResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Erro ao processar mês");
      }

      const novosResultados: ChunkResult[] = [
        ...resultadosAcumulados,
        { mes: data.mes_processado!, vendas_salvas: data.vendas_salvas ?? 0 },
      ];
      setChunks(novosResultados);

      if (data.concluido || !data.proximo_mes) {
        setCurrentMes(null);
        setDone(true);
        setRunning(false);
        return;
      }

      await processarChunk(data.proximo_mes, chunkAtual + 1, novosResultados);
    },
    [lojaId]
  );

  const iniciar = useCallback(
    async (fromMes?: string, fromChunk?: number) => {
      setRunning(true);
      setError(null);
      setDone(false);
      if (!fromMes) setChunks([]);

      const startMes = fromMes ?? calcularStartMes();
      const startChunk = fromChunk ?? 1;

      try {
        await processarChunk(startMes, startChunk, fromMes ? chunks : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        setRunning(false);
        setCurrentMes(null);
      }
    },
    [processarChunk, chunks]
  );

  // Calcula o próximo mês a partir do mes_atual do DB para retomar
  function calcularProximoMes(mesAtual: string): string {
    const [ano, mesNum] = mesAtual.split("-").map(Number);
    const prox = new Date(ano, mesNum, 1);
    return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`;
  }

  const totalVendasSessao = chunks.reduce((acc, c) => acc + c.vendas_salvas, 0);
  const pct = Math.min(chunks.length / TOTAL_CHUNKS, 1);

  const podeRetomar =
    dbStatus?.status === "em_andamento" &&
    !!dbStatus.mes_atual &&
    !running &&
    !done;

  const sincronizadoAntes = dbStatus?.status && dbStatus.status !== "pendente";

  // ── Label e estilo do botão trigger ─────────────────────────────────────
  const triggerLabel =
    dbStatus?.status === "concluido"
      ? "Sincronizado"
      : dbStatus?.status === "em_andamento"
      ? `Sync ${dbStatus.chunk_atual}/${dbStatus.total_chunks}`
      : "Sincronizar";

  const triggerClass =
    dbStatus?.status === "concluido"
      ? "text-xs inline-flex items-center gap-1.5 text-green-600 font-medium"
      : dbStatus?.status === "em_andamento"
      ? "text-xs inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-800 font-medium transition-colors"
      : "text-xs inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors";

  return (
    <>
      {/* Botão trigger — aparece na linha da tabela de lojas */}
      <button onClick={openModal} className={triggerClass}>
        {dbStatus?.status === "concluido" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : dbStatus?.status === "em_andamento" ? (
          <Loader2 className="h-3.5 w-3.5" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {triggerLabel}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay escuro */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!running) setOpen(false);
            }}
          />

          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : running ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
                ) : error ? (
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <Download className="h-5 w-5 text-slate-400 shrink-0" />
                )}
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">
                    Sincronização Inicial
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{lojaNome}</p>
                </div>
              </div>
              {!running && (
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Corpo */}
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {fetchingStatus ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <>
                  {/* Descrição inicial (antes de começar) */}
                  {!running && !done && chunks.length === 0 && (
                    <div className="space-y-3 text-sm text-slate-600">
                      <p>
                        Importa os últimos{" "}
                        <strong className="text-slate-800">13 meses</strong> de
                        histórico de vendas do ERP, processando mês a mês para
                        respeitar o timeout da Edge Function.
                      </p>

                      {sincronizadoAntes && dbStatus && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
                          <p className="font-medium">Sync anterior encontrado</p>
                          <p>
                            Chunk {dbStatus.chunk_atual}/{dbStatus.total_chunks} —{" "}
                            {(dbStatus.vendas_salvas ?? 0).toLocaleString("pt-BR")}{" "}
                            vendas salvas.
                          </p>
                          {dbStatus.mes_atual && (
                            <p>Último mês: {formatarMes(dbStatus.mes_atual)}</p>
                          )}
                        </div>
                      )}

                      {error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{error}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de progresso */}
                  {(running || done || chunks.length > 0) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {chunks.length} de {TOTAL_CHUNKS} meses processados
                        </span>
                        <span className="font-medium">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        {totalVendasSessao.toLocaleString("pt-BR")} vendas importadas nesta sessão
                      </p>
                    </div>
                  )}

                  {/* Mês sendo processado */}
                  {running && currentMes && (
                    <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>
                        Processando <strong>{formatarMes(currentMes)}</strong>
                        ...
                      </span>
                    </div>
                  )}

                  {/* Lista de meses processados nesta sessão */}
                  {chunks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Meses processados
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-slate-100">
                        {[...chunks].reverse().map((c) => (
                          <div
                            key={c.mes}
                            className="flex items-center justify-between text-xs px-3 py-2 odd:bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="text-slate-700">
                                {formatarMes(c.mes)}
                              </span>
                            </div>
                            <span className="text-slate-400 font-mono tabular-nums">
                              {c.vendas_salvas.toLocaleString("pt-BR")} vd
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado concluído */}
                  {done && (
                    <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-5 text-center space-y-2">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                      <p className="font-semibold text-green-800">
                        Sincronização concluída!
                      </p>
                      <p className="text-xs text-green-600">
                        {totalVendasSessao.toLocaleString("pt-BR")} vendas
                        importadas nesta sessão.
                      </p>
                    </div>
                  )}

                  {/* Erro após início */}
                  {error && (running || chunks.length > 0) && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-0.5">Erro no processamento</p>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!fetchingStatus && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                {!running && !done && (
                  <>
                    <button
                      onClick={() => setOpen(false)}
                      className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      Fechar
                    </button>

                    {podeRetomar && dbStatus?.mes_atual ? (
                      <>
                        <button
                          onClick={() => void iniciar()}
                          className="text-sm border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reiniciar
                        </button>
                        <button
                          onClick={() => {
                            const proximo = calcularProximoMes(dbStatus.mes_atual!);
                            const nextChunk = (dbStatus.chunk_atual ?? 0) + 1;
                            void iniciar(proximo, nextChunk);
                          }}
                          className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          Retomar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => void iniciar()}
                        className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {sincronizadoAntes ? "Reiniciar Sync" : "Iniciar Sync"}
                      </button>
                    )}
                  </>
                )}

                {done && (
                  <button
                    onClick={() => setOpen(false)}
                    className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Fechar
                  </button>
                )}

                {running && (
                  <p className="text-xs text-slate-400 italic">
                    Processando... não feche esta janela.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

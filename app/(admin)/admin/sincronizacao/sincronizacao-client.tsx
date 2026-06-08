"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  pausarSync,
  retomarSync,
  buscarLogsRecentes,
} from "@/app/actions/admin-sync";
import type { SyncStatusLoja, LogRecente } from "@/app/actions/admin-sync";

interface Props {
  statusLojas: SyncStatusLoja[];
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatusBadge({ loja }: { loja: SyncStatusLoja }) {
  if (loja.sync_paused) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
        <Pause className="w-3 h-3" />
        Pausado
      </span>
    );
  }
  if (loja.jobs_processando > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" />
        Processando
      </span>
    );
  }
  if (loja.jobs_erro > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        Com erro
      </span>
    );
  }
  if (loja.jobs_pendentes > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full">
        <Clock className="w-3 h-3" />
        Pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
      <CheckCircle2 className="w-3 h-3" />
      Ocioso
    </span>
  );
}

export function SincronizacaoClient({ statusLojas }: Props) {
  const [lojas, setLojas] = useState(statusLojas);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LogRecente[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);
  const [modalPausar, setModalPausar] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function mostrarFeedback(tipo: "ok" | "erro", msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  async function handleVerLogs(lojaId: string) {
    if (expandido === lojaId) {
      setExpandido(null);
      return;
    }
    setExpandido(lojaId);
    if (logs[lojaId]) return;
    setLoadingLogs(lojaId);
    const resultado = await buscarLogsRecentes(lojaId);
    setLogs((prev) => ({ ...prev, [lojaId]: resultado }));
    setLoadingLogs(null);
  }

  function handlePausar(lojaId: string) {
    startTransition(async () => {
      const result = await pausarSync(lojaId, motivo || undefined);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        setLojas((prev) =>
          prev.map((l) =>
            l.loja_id === lojaId
              ? {
                  ...l,
                  sync_paused: true,
                  sync_paused_at: new Date().toISOString(),
                  sync_pause_reason: motivo || null,
                }
              : l
          )
        );
        mostrarFeedback("ok", "Sincronização pausada");
        setModalPausar(null);
        setMotivo("");
      }
    });
  }

  function handleRetomar(lojaId: string) {
    startTransition(async () => {
      const result = await retomarSync(lojaId);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        setLojas((prev) =>
          prev.map((l) =>
            l.loja_id === lojaId
              ? {
                  ...l,
                  sync_paused: false,
                  sync_paused_at: null,
                  sync_pause_reason: null,
                }
              : l
          )
        );
        mostrarFeedback("ok", "Sincronização retomada");
      }
    });
  }

  const lojasPausadas = lojas.filter((l) => l.sync_paused).length;
  const lojasComErro = lojas.filter((l) => l.jobs_erro > 0).length;
  const lojasProcessando = lojas.filter((l) => l.jobs_processando > 0).length;

  return (
    <div className="p-8">
      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            feedback.tipo === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.tipo === "ok" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-slate-400" />
            Monitor de Sincronização
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lojas.length}{" "}
            {lojas.length === 1 ? "loja monitorada" : "lojas monitoradas"}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total de lojas", valor: lojas.length, cor: "slate" },
          { label: "Processando", valor: lojasProcessando, cor: "blue" },
          { label: "Com erro", valor: lojasComErro, cor: "red" },
          { label: "Pausadas", valor: lojasPausadas, cor: "amber" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-slate-100 rounded-xl p-4"
          >
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p
              className={`text-2xl font-bold text-${card.cor}-600`}
            >
              {card.valor}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela de lojas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Empresa / Loja
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Job atual
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Fila
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Último sync
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lojas.map((loja) => (
              <>
                <tr
                  key={loja.loja_id}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    loja.sync_paused ? "opacity-60" : ""
                  }`}
                >
                  {/* Empresa / Loja */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{loja.loja_name}</p>
                    <p className="text-xs text-slate-400">{loja.tenant_name}</p>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge loja={loja} />
                    {loja.sync_paused && loja.sync_pause_reason && (
                      <p className="text-xs text-amber-600 mt-1 max-w-[8rem] truncate">
                        {loja.sync_pause_reason}
                      </p>
                    )}
                  </td>

                  {/* Job atual */}
                  <td className="px-5 py-4">
                    {loja.job_atual ? (
                      <div>
                        <p className="font-medium text-slate-700 capitalize">
                          {loja.job_atual.tipo}
                        </p>
                        {loja.job_atual.offset !== null && (
                          <p className="text-xs text-slate-400">
                            offset{" "}
                            {loja.job_atual.offset.toLocaleString("pt-BR")}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          {loja.job_atual.registros_salvos.toLocaleString(
                            "pt-BR"
                          )}{" "}
                          registros
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Fila */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {loja.jobs_pendentes > 0 && (
                        <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded font-medium">
                          {loja.jobs_pendentes} pendente
                          {loja.jobs_pendentes > 1 ? "s" : ""}
                        </span>
                      )}
                      {loja.jobs_erro > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">
                          {loja.jobs_erro} erro
                          {loja.jobs_erro > 1 ? "s" : ""}
                        </span>
                      )}
                      {loja.jobs_pendentes === 0 && loja.jobs_erro === 0 && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                    {loja.ultimo_erro && (
                      <p
                        className="text-xs text-red-500 mt-1 max-w-[10rem] truncate"
                        title={loja.ultimo_erro}
                      >
                        {loja.ultimo_erro}
                      </p>
                    )}
                  </td>

                  {/* Último sync */}
                  <td className="px-5 py-4">
                    <p className="text-xs text-slate-600">
                      {formatarData(loja.ultimo_sync_sucesso)}
                    </p>
                    {loja.ultima_tentativa &&
                      loja.ultima_tentativa !== loja.ultimo_sync_sucesso && (
                        <p className="text-xs text-slate-400">
                          Tentativa: {formatarData(loja.ultima_tentativa)}
                        </p>
                      )}
                  </td>

                  {/* Ações */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleVerLogs(loja.loja_id)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Logs
                        {expandido === loja.loja_id ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {loja.sync_paused ? (
                        <button
                          onClick={() => handleRetomar(loja.loja_id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Retomar
                        </button>
                      ) : (
                        <button
                          onClick={() => setModalPausar(loja.loja_id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                        >
                          <Pause className="w-3 h-3" />
                          Pausar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Linha expandida — logs */}
                {expandido === loja.loja_id && (
                  <tr key={`${loja.loja_id}-logs`}>
                    <td
                      colSpan={6}
                      className="px-5 py-4 bg-slate-50/50 border-t border-slate-100"
                    >
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Logs recentes — {loja.loja_name}
                      </p>
                      {loadingLogs === loja.loja_id ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Carregando logs...
                        </div>
                      ) : (logs[loja.loja_id] ?? []).length === 0 ? (
                        <p className="text-xs text-slate-400">
                          Nenhum log encontrado
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {(logs[loja.loja_id] ?? []).map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center gap-4 text-xs py-1.5 border-b border-slate-100 last:border-0"
                            >
                              <span
                                className={`w-16 font-medium shrink-0 ${
                                  log.status === "concluido" ||
                                  log.status === "concluído"
                                    ? "text-emerald-600"
                                    : log.status === "erro"
                                    ? "text-red-500"
                                    : "text-slate-500"
                                }`}
                              >
                                {log.status}
                              </span>
                              <span className="text-slate-500 w-24 shrink-0">
                                {log.tabela ?? "—"}
                              </span>
                              <span className="text-slate-400 w-32 shrink-0">
                                {formatarData(log.inicio)}
                              </span>
                              {log.total_registros !== null && (
                                <span className="text-slate-500">
                                  {log.total_registros.toLocaleString("pt-BR")}{" "}
                                  reg.
                                </span>
                              )}
                              {log.erro && (
                                <span
                                  className="text-red-500 truncate max-w-xs"
                                  title={log.erro}
                                >
                                  {log.erro}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}

            {lojas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  Nenhuma loja encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — Pausar sync */}
      {modalPausar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Pause className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Pausar sincronização
                </h3>
                <p className="text-xs text-slate-400">
                  {lojas.find((l) => l.loja_id === modalPausar)?.loja_name}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-3 mb-4">
              <p className="text-xs text-amber-700">
                Novos jobs não serão iniciados enquanto a sincronização estiver
                pausada. Jobs em andamento serão concluídos normalmente.
              </p>
            </div>

            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Motivo (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: manutenção programada"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalPausar(null);
                  setMotivo("");
                }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handlePausar(modalPausar)}
                disabled={isPending}
                className="flex-1 py-2.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Pausando..." : "Pausar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

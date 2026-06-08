"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Loader2,
  Wrench,
  Activity,
  Pause,
  Play,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { SyncInicialModal } from "@/components/admin/SyncPeriodoModal";
import { BotaoLimparDados } from "@/components/admin/BotaoLimparDados";
import { toggleLojaAtiva } from "@/lib/actions/admin-lojas";
import { pausarSync, retomarSync } from "@/app/actions/admin-sync";

type Loja = {
  id: string;
  name: string;
  empId: number;
  erpBaseUrl: string;
  isActive: boolean;
  syncServicesEnabled: boolean;
};

// ── Sub-componente por linha — precisa de estado próprio para o toggle ────────

function ToggleLojaButton({
  lojaId,
  isActive,
  onToggled,
}: {
  lojaId: string;
  isActive: boolean;
  onToggled: () => void;
}) {
  const [ativo, setAtivo] = useState(isActive);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const novoEstado = !ativo;
    setAtivo(novoEstado); // otimista
    try {
      await toggleLojaAtiva(lojaId, novoEstado);
      onToggled();
    } catch {
      setAtivo(!novoEstado); // reverter se falhou
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        ativo
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-green-200 text-green-600 hover:bg-green-50"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : ativo ? (
        "Desativar"
      ) : (
        "Ativar"
      )}
    </button>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

interface Props {
  lojas: Loja[];
  tenantId: string;
}

export function LojasSectionClient({ lojas: lojasProp, tenantId }: Props) {
  const router = useRouter();

  const [lojas, setLojas] = useState(lojasProp);
  useEffect(() => { setLojas(lojasProp); }, [lojasProp]);

  const [syncLojaId, setSyncLojaId] = useState<string | null>(null);
  const [syncNomeLoja, setSyncNomeLoja] = useState("");
  const [syncServicesEnabled, setSyncServicesEnabled] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const [lojasComSync, setLojasComSync] = useState<Set<string>>(new Set());
  const [lojaPausada, setLojaPausada] = useState<Record<string, boolean>>({});
  const [modalPausar, setModalPausar] = useState<string | null>(null);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [syncPauseLoading, setSyncPauseLoading] = useState<string | null>(null);
  const [feedbackSync, setFeedbackSync] = useState<string | null>(null);

  // Verificar status de sync para cada loja ao montar e a cada 15s
  useEffect(() => {
    const verificar = async () => {
      const novosAtivos = new Set<string>();
      const pausadas: Record<string, boolean> = {};
      await Promise.all(
        lojas.map(async (loja) => {
          try {
            const res = await fetch(`/api/admin/sync-queue?lojaId=${loja.id}`);
            if (!res.ok) return;
            const data = await res.json() as {
              resumo: { pendentes: number; processando: number; erros: number };
              sync_paused?: boolean;
            };
            if (
              data.resumo.pendentes > 0 ||
              data.resumo.processando > 0 ||
              data.resumo.erros > 0
            ) {
              novosAtivos.add(loja.id);
            }
            pausadas[loja.id] = data.sync_paused ?? false;
          } catch {
            // silencioso
          }
        })
      );
      setLojasComSync(novosAtivos);
      setLojaPausada(pausadas);
    };

    void verificar();
    const interval = setInterval(() => void verificar(), 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojas.map((l) => l.id).join(",")]);

  const handleSyncConcluido = () => {
    setSyncLojaId(null);
    router.refresh();
  };

  const handleToggleServicos = async (lojaId: string, valor: boolean) => {
    setToggling(lojaId);
    setLojas((prev) =>
      prev.map((l) => l.id === lojaId ? { ...l, syncServicesEnabled: valor } : l)
    );
    try {
      const res = await fetch("/api/admin/toggle-servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, valor }),
      });
      if (!res.ok) {
        setLojas((prev) =>
          prev.map((l) => l.id === lojaId ? { ...l, syncServicesEnabled: !valor } : l)
        );
        alert("Erro ao atualizar configuração de serviços");
      }
    } catch {
      setLojas((prev) =>
        prev.map((l) => l.id === lojaId ? { ...l, syncServicesEnabled: !valor } : l)
      );
      alert("Erro de conexão");
    } finally {
      setToggling(null);
    }
  };

  const handlePausarSync = async (lojaId: string) => {
    setSyncPauseLoading(lojaId);
    const result = await pausarSync(lojaId, motivoPausa || undefined);
    if (result.error) {
      setFeedbackSync(`Erro: ${result.error}`);
    } else {
      setLojaPausada((prev) => ({ ...prev, [lojaId]: true }));
      setFeedbackSync("Sincronização pausada");
      setModalPausar(null);
      setMotivoPausa("");
    }
    setSyncPauseLoading(null);
    setTimeout(() => setFeedbackSync(null), 3000);
  };

  const handleRetomarSync = async (lojaId: string) => {
    setSyncPauseLoading(lojaId);
    const result = await retomarSync(lojaId);
    if (result.error) {
      setFeedbackSync(`Erro: ${result.error}`);
    } else {
      setLojaPausada((prev) => ({ ...prev, [lojaId]: false }));
      setFeedbackSync("Sincronização retomada");
    }
    setSyncPauseLoading(null);
    setTimeout(() => setFeedbackSync(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Contador + botão adicionar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          {lojas.length}{" "}
          {lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
        </p>
        <Link
          href={`/admin/clientes/${tenantId}/lojas/nova`}
          className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
        >
          + Adicionar Loja
        </Link>
      </div>

      {/* Tabela ou estado vazio */}
      {lojas.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-slate-200">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Nenhuma loja cadastrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "EmpId", "URL do Túnel", "Status", "Serviços", "Sync", "Ações"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lojas.map((loja) => (
                <tr key={loja.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {loja.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono">
                    {loja.empId}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-xs">
                    {loja.erpBaseUrl}
                  </td>
                  <td className="px-4 py-3">
                    {loja.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Inativa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleServicos(loja.id, !loja.syncServicesEnabled)}
                      disabled={toggling === loja.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background: loja.syncServicesEnabled
                          ? "rgba(0,229,255,0.12)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${loja.syncServicesEnabled
                          ? "rgba(0,229,255,0.3)"
                          : "rgba(255,255,255,0.1)"}`,
                        color: loja.syncServicesEnabled
                          ? "var(--accent-cyan, #06b6d4)"
                          : "var(--text-muted, #94a3b8)",
                      }}
                      title={loja.syncServicesEnabled
                        ? "O.S. ativa — clique para desativar"
                        : "Clique para ativar O.S."}
                    >
                      {toggling === loja.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wrench className="h-3 w-3" />
                      )}
                      {loja.syncServicesEnabled ? "O.S. ativa" : "O.S. inativa"}
                    </button>
                  </td>
                  {/* Coluna Sync — status + controles de pausa */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lojaPausada[loja.id] ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          <Pause className="w-3 h-3" />
                          Pausado
                        </span>
                      ) : lojasComSync.has(loja.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          <Activity className="w-3 h-3 animate-pulse" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3" />
                          Ocioso
                        </span>
                      )}
                      {lojaPausada[loja.id] ? (
                        <button
                          onClick={() => handleRetomarSync(loja.id)}
                          disabled={syncPauseLoading === loja.id}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Retomar
                        </button>
                      ) : (
                        <button
                          onClick={() => setModalPausar(loja.id)}
                          disabled={syncPauseLoading === loja.id}
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50 transition-colors"
                        >
                          <Pause className="w-3 h-3" />
                          Pausar
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ToggleLojaButton
                        lojaId={loja.id}
                        isActive={loja.isActive}
                        onToggled={() => router.refresh()}
                      />
                      <button
                        onClick={() => {
                          setSyncLojaId(loja.id);
                          setSyncNomeLoja(loja.name);
                          setSyncServicesEnabled(loja.syncServicesEnabled);
                        }}
                        className="text-xs font-medium transition-colors"
                        style={{
                          color: lojasComSync.has(loja.id)
                            ? "var(--accent-cyan, #06b6d4)"
                            : "#2563eb",
                        }}
                      >
                        {lojasComSync.has(loja.id) ? "Ver progresso" : "Sincronizar"}
                      </button>
                      <BotaoLimparDados
                        lojaId={loja.id}
                        nomeLoja={loja.name}
                        onLimpo={() => router.refresh()}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de sync inicial */}
      {syncLojaId && (
        <SyncInicialModal
          lojaId={syncLojaId}
          nomeLoja={syncNomeLoja}
          syncServicesEnabled={syncServicesEnabled}
          onConcluido={handleSyncConcluido}
          onCancelar={() => setSyncLojaId(null)}
        />
      )}

      {/* Toast feedback pausa/retomada */}
      {feedbackSync && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {feedbackSync}
        </div>
      )}

      {/* Modal pausar sync */}
      {modalPausar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Pause className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Pausar sincronização</h3>
                <p className="text-xs text-slate-400">
                  {lojas.find((l) => l.id === modalPausar)?.name}
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-3 mb-4">
              <p className="text-xs text-amber-700">
                Novos jobs não serão iniciados. Jobs em andamento terminam normalmente.
              </p>
            </div>
            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Motivo (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: manutenção programada"
                value={motivoPausa}
                onChange={(e) => setMotivoPausa(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setModalPausar(null); setMotivoPausa(""); }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handlePausarSync(modalPausar)}
                disabled={syncPauseLoading === modalPausar}
                className="flex-1 py-2.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {syncPauseLoading === modalPausar ? "Pausando..." : "Pausar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

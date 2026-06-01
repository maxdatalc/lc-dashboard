"use client";

// Seção de lojas do painel admin — Client Component para gerenciar estado do modal de sync
// e botão toggle ativa/inativa por linha.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2, Wrench } from "lucide-react";
import { SyncInicialModal } from "@/components/admin/SyncPeriodoModal";
import { BotaoLimparDados } from "@/components/admin/BotaoLimparDados";
import { toggleLojaAtiva } from "@/lib/actions/admin-lojas";

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

  // Estado local das lojas para updates otimistas (toggle de serviços sem router.refresh)
  const [lojas, setLojas] = useState(lojasProp);
  // Sincronizar quando o Server Component pai re-render (ex: após router.refresh)
  useEffect(() => { setLojas(lojasProp); }, [lojasProp]);

  const [syncLojaId, setSyncLojaId] = useState<string | null>(null);
  const [syncNomeLoja, setSyncNomeLoja] = useState("");
  const [syncServicesEnabled, setSyncServicesEnabled] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // IDs de lojas com sync ativo na fila (pg_cron)
  const [lojasComSync, setLojasComSync] = useState<Set<string>>(new Set());

  // Verificar status de sync para cada loja ao montar e a cada 15s
  useEffect(() => {
    const verificar = async () => {
      const novosAtivos = new Set<string>();
      await Promise.all(
        lojas.map(async (loja) => {
          try {
            const res = await fetch(
              `/api/admin/sync-queue?lojaId=${loja.id}`
            );
            if (!res.ok) return;
            const data = await res.json() as {
              resumo: { pendentes: number; processando: number };
            };
            if (
              (data.resumo.pendentes > 0 || data.resumo.processando > 0)
            ) {
              novosAtivos.add(loja.id);
            }
          } catch {
            // silencioso
          }
        })
      );
      setLojasComSync(novosAtivos);
    };

    void verificar();
    const interval = setInterval(() => void verificar(), 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojas.map((l) => l.id).join(",")]);

  const handleSyncConcluido = () => {
    setSyncLojaId(null);
    router.refresh(); // recarrega dados do Server Component pai
  };

  // Toggle sync_services_enabled com update otimista — sem precisar de router.refresh()
  const handleToggleServicos = async (lojaId: string, valor: boolean) => {
    setToggling(lojaId);
    // Atualizar UI imediatamente (otimista)
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
        // Reverter se falhou
        setLojas((prev) =>
          prev.map((l) => l.id === lojaId ? { ...l, syncServicesEnabled: !valor } : l)
        );
        alert("Erro ao atualizar configuração de serviços");
      }
    } catch {
      // Reverter em caso de erro de rede
      setLojas((prev) =>
        prev.map((l) => l.id === lojaId ? { ...l, syncServicesEnabled: !valor } : l)
      );
      alert("Erro de conexão");
    } finally {
      setToggling(null);
    }
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
                {["Nome", "EmpId", "URL do Túnel", "Status", "Serviços", "Ações"].map(
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Badge de sync em andamento */}
                      {lojasComSync.has(loja.id) && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(0,229,255,0.1)",
                            color: "var(--accent-cyan, #06b6d4)",
                            border: "1px solid rgba(0,229,255,0.25)",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ background: "var(--accent-cyan, #06b6d4)" }}
                          />
                          Sync ativo
                        </span>
                      )}

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

      {/* Modal de sync inicial com 3 abas — montado quando syncLojaId está definido */}
      {syncLojaId && (
        <SyncInicialModal
          lojaId={syncLojaId}
          nomeLoja={syncNomeLoja}
          syncServicesEnabled={syncServicesEnabled}
          onConcluido={handleSyncConcluido}
          onCancelar={() => setSyncLojaId(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, MonitorSmartphone, Smartphone, Monitor, Check } from "lucide-react";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import type { TerminalBridge } from "@/app/api/admin/lojas/[id]/terminais-bridge/route";

function formatarData(iso: string | null): string {
  if (!iso) return "sem registro";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "sem registro";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Lista os dispositivos cadastrados na tela 470 do MaxManager para escolher
 * o terminal usado na autenticação da MaxAPI.
 */
export default function TerminalPicker({
  lojaId,
  valorAtual,
  onSelect,
}: {
  lojaId: string;
  valorAtual: string;
  onSelect: (terminalId: string) => void;
}) {
  const [terminais, setTerminais] = useState<TerminalBridge[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/lojas/${lojaId}/terminais-bridge`);
      const data = (await res.json()) as { terminais?: TerminalBridge[]; error?: string };
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível listar os terminais — informe o código manualmente.");
        return;
      }
      setTerminais(data.terminais ?? []);
    } catch {
      setErro("Erro de rede ao consultar a Bridge — informe o código manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <AdminButton type="button" variant="secondary" size="sm" onClick={buscar} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MonitorSmartphone className="h-3 w-3" />}
        {loading ? "Consultando Bridge..." : "Buscar terminais"}
      </AdminButton>

      {erro && (
        <p
          className="adm-mono rounded px-3 py-2 text-xs"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
        >
          {erro}
        </p>
      )}

      {terminais !== null && terminais.length === 0 && !erro && (
        <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Nenhum dispositivo ativo encontrado na tela 470 do MaxManager.
        </p>
      )}

      {terminais !== null && terminais.length > 0 && (
        <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--adm-line)" }}>
          {terminais.map((t, i) => {
            const selecionado = t.terminalId === valorAtual;
            return (
              <button
                key={t.terminalId}
                type="button"
                onClick={() => { onSelect(t.terminalId); setTerminais(null); }}
                className="adm-row adm-focusable flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--adm-line)",
                  background: selecionado ? "var(--adm-accent-soft)" : undefined,
                }}
              >
                {t.tipo === 1
                  ? <Smartphone className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                  : <Monitor className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />}

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                      {t.terminalNome || "(sem nome)"}
                    </span>
                    {t.naEmpresa && <AdminBadge variant="success">Esta empresa</AdminBadge>}
                    {t.tipo === 1 && <AdminBadge variant="neutral">Mobile</AdminBadge>}
                  </span>
                  <span className="adm-mono mt-0.5 block truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {t.terminalId}
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    última conexão: {formatarData(t.ultimaConexao)}
                  </span>
                </span>

                {selecionado && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--adm-accent)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

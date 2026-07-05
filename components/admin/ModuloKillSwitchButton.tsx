"use client";

import { useState } from "react";
import { toggleKillSwitch } from "@/lib/actions/admin-modulos";

export function ModuloKillSwitchButton({
  featureKey,
  featureLabel,
  killSwitchEnabled,
  affectedTenantCount,
}: {
  featureKey: string;
  featureLabel: string;
  killSwitchEnabled: boolean;
  affectedTenantCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await toggleKillSwitch(featureKey, !killSwitchEnabled);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150"
        style={
          killSwitchEnabled
            ? { background: "var(--adm-surface-2)", color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)" }
            : { background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d" }
        }
      >
        {killSwitchEnabled ? "Reativar módulo" : "Desativar módulo para todos"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--adm-text)" }}>
              {killSwitchEnabled ? "Reativar" : "Desativar"} {featureLabel}?
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--adm-text-dim)" }}>
              {killSwitchEnabled
                ? "O módulo voltará a ficar disponível para as empresas que já tinham acesso configurado."
                : `Isso vai remover o acesso ao módulo ${featureLabel} de ${affectedTenantCount} ${
                    affectedTenantCount === 1 ? "empresa" : "empresas"
                  } imediatamente.`}
            </p>
            {error && (
              <p className="mt-2 text-sm" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--adm-surface-2)", color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--adm-accent)", color: "#04121a" }}
              >
                {loading ? "Aplicando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

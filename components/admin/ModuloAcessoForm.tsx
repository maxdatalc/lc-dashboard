"use client";

import { useRef, useTransition } from "react";
import type { Plan } from "@/lib/plans";
import { salvarAcessoModulo } from "@/lib/actions/admin-modulos";

type TenantRow = { id: string; name: string; plan: Plan; ativo: boolean };

export function ModuloAcessoForm({
  featureKey,
  tenants,
  killSwitchEnabled,
}: {
  featureKey: string;
  tenants: TenantRow[];
  killSwitchEnabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function marcarTodosPremium() {
    const form = formRef.current;
    if (!form) return;
    form
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-plan="premium"]')
      .forEach((cb) => {
        cb.checked = true;
      });
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await salvarAcessoModulo(featureKey, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {killSwitchEnabled && (
        <p
          className="text-sm rounded-lg px-4 py-3"
          style={{ background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d" }}
        >
          Este módulo está com kill-switch ligado — as mudanças aqui só valerão quando ele for reativado.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={marcarTodosPremium}
          className="text-xs font-medium"
          style={{ color: "var(--adm-accent)" }}
        >
          Marcar todas as empresas Premium
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          {isPending ? "Salvando..." : "Salvar acesso"}
        </button>
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--adm-line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--adm-surface-2)" }}>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Empresa
              </th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Plano
              </th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Acesso
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--adm-line)" }}>
                <td className="px-4 py-2.5" style={{ color: "var(--adm-text)" }}>
                  {t.name}
                </td>
                <td className="px-4 py-2.5 capitalize" style={{ color: "var(--adm-text-dim)" }}>
                  {t.plan}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="checkbox"
                    name="tenant"
                    value={t.id}
                    data-plan={t.plan}
                    defaultChecked={t.ativo}
                    className="h-4 w-4 rounded"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

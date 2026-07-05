"use client";

import { useState, useTransition } from "react";
import type { ModuleChangeRequest } from "@/lib/db/modules";
import { criarSolicitacao, atualizarStatusSolicitacao } from "@/lib/actions/admin-modulos";

const STATUS_LABELS: Record<ModuleChangeRequest["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const STATUS_ORDER: ModuleChangeRequest["status"][] = ["aberto", "em_andamento", "concluido"];

export function ModuloSolicitacoesForm({
  featureKey,
  requests,
  tenants,
}: {
  featureKey: string;
  requests: ModuleChangeRequest[];
  tenants: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await criarSolicitacao(featureKey, formData);
      setShowForm(false);
    });
  }

  function handleStatusChange(requestId: string, status: ModuleChangeRequest["status"]) {
    startTransition(async () => {
      await atualizarStatusSolicitacao(requestId, status, featureKey);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          {showForm ? "Cancelar" : "Nova solicitação"}
        </button>
      </div>

      {showForm && (
        <form
          action={handleCreate}
          className="space-y-3 rounded-xl p-5"
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
        >
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Título
            </label>
            <input
              type="text"
              name="titulo"
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Descrição
            </label>
            <textarea
              name="descricao"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Empresa relacionada (opcional, apenas informativo)
            </label>
            <select
              name="tenant_id"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            >
              <option value="">Nenhuma (solicitação geral)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--adm-accent)", color: "#04121a" }}
          >
            {isPending ? "Enviando..." : "Enviar solicitação"}
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          Nenhuma solicitação registrada para este módulo ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-lg p-4"
              style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                    {r.titulo}
                  </p>
                  {r.descricao && (
                    <p className="text-xs mt-1" style={{ color: "var(--adm-text-dim)" }}>
                      {r.descricao}
                    </p>
                  )}
                  {r.tenantName && (
                    <p className="text-xs mt-1" style={{ color: "var(--adm-text-faint)" }}>
                      Empresa: {r.tenantName}
                    </p>
                  )}
                </div>
                <select
                  value={r.status}
                  disabled={isPending}
                  onChange={(e) =>
                    handleStatusChange(r.id, e.target.value as ModuleChangeRequest["status"])
                  }
                  className="text-xs rounded-md px-2 py-1 disabled:opacity-50 shrink-0"
                  style={{
                    background: "var(--adm-surface-2)",
                    color: "var(--adm-text)",
                    border: "1px solid var(--adm-line-strong)",
                  }}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

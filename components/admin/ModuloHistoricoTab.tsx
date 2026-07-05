import type { ModuleAuditLogEntry } from "@/lib/db/modules";

const EVENT_LABELS: Record<string, string> = {
  kill_switch_on: "Módulo desativado globalmente",
  kill_switch_off: "Módulo reativado",
  cor_alterada: "Aparência/comercial alterada",
  acesso_empresa_alterado: "Acesso por empresa alterado",
  preco_alterado: "Preço alterado",
};

export function ModuloHistoricoTab({ entries }: { entries: ModuleAuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
        Nenhuma ação registrada para este módulo ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            {EVENT_LABELS[e.eventType] ?? e.eventType}
          </span>
          <span className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
            {new Date(e.createdAt).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

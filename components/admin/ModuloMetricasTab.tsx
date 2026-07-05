import type { ModuleAccessRankingItem } from "@/lib/db/modules";

export function ModuloMetricasTab({ ranking }: { ranking: ModuleAccessRankingItem[] }) {
  if (ranking.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
        Nenhum acesso registrado a este módulo ainda.
      </p>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--adm-line)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--adm-surface-2)" }}>
            <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Empresa
            </th>
            <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Acessos
            </th>
            <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Último acesso
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r) => (
            <tr key={r.tenantId} style={{ borderTop: "1px solid var(--adm-line)" }}>
              <td className="px-4 py-2.5" style={{ color: "var(--adm-text)" }}>
                {r.tenantName}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--adm-text)" }}>
                {r.totalAccesses}
              </td>
              <td className="px-4 py-2.5 text-right" style={{ color: "var(--adm-text-dim)" }}>
                {new Date(r.lastSeenAt).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

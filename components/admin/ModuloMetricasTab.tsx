import type { ModuleAccessRankingItem } from "@/lib/db/modules";
import { ResponsiveRowList } from "@/components/ui/ResponsiveRowList";

export function ModuloMetricasTab({ ranking }: { ranking: ModuleAccessRankingItem[] }) {
  if (ranking.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
        Nenhum acesso registrado a este módulo ainda.
      </p>
    );
  }

  return (
    <div className="rounded-xl" style={{ border: "1px solid var(--adm-line)" }}>
      <ResponsiveRowList<ModuleAccessRankingItem>
        keyField="tenantId"
        rows={ranking}
        columns={[
          {
            key: "empresa",
            header: "Empresa",
            width: "minmax(0, 1fr)",
            render: (r) => r.tenantName,
          },
          {
            key: "acessos",
            header: "Acessos",
            width: "72px",
            align: "right",
            render: (r) => <span className="font-semibold">{r.totalAccesses}</span>,
          },
          {
            key: "ultimo",
            header: "Último acesso",
            width: "170px",
            align: "right",
            minBreakpoint: "sm",
            render: (r) => (
              <span style={{ color: "var(--adm-text-dim)" }}>
                {new Date(r.lastSeenAt).toLocaleString("pt-BR")}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

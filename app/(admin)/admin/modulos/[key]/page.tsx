export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES_CATALOG } from "@/lib/features";
import {
  getModuleSettings,
  countTenantsWithFeature,
  getModuleAccessRanking,
  listChangeRequests,
  listModuleAuditLog,
} from "@/lib/db/modules";
import { getAllTenants } from "@/lib/db/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModuloKillSwitchButton } from "@/components/admin/ModuloKillSwitchButton";
import { ModuloAcessoForm } from "@/components/admin/ModuloAcessoForm";
import { ModuloAparenciaForm } from "@/components/admin/ModuloAparenciaForm";
import { ModuloMetricasTab } from "@/components/admin/ModuloMetricasTab";
import { ModuloHistoricoTab } from "@/components/admin/ModuloHistoricoTab";
import { ModuloSolicitacoesForm } from "@/components/admin/ModuloSolicitacoesForm";

type Aba = "acesso" | "aparencia" | "metricas" | "solicitacoes" | "historico";

const ABAS: { valor: Aba; label: string }[] = [
  { valor: "acesso", label: "Acesso" },
  { valor: "aparencia", label: "Aparência/Comercial" },
  { valor: "metricas", label: "Métricas" },
  { valor: "solicitacoes", label: "Solicitações" },
  { valor: "historico", label: "Histórico" },
];

export default async function ModuloDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { key } = await params;
  const { aba: abaParam } = await searchParams;
  const abaAtiva: Aba = (ABAS.some((a) => a.valor === abaParam) ? abaParam : "acesso") as Aba;

  const feature = FEATURES_CATALOG.find((f) => f.key === key);
  if (!feature || !feature.disponivel) notFound();

  const [settings, tenants, tenantsComFeature, ranking, changeRequests, auditLog] =
    await Promise.all([
      getModuleSettings(key),
      getAllTenants(),
      countTenantsWithFeature(key),
      getModuleAccessRanking(key),
      listChangeRequests(key),
      listModuleAuditLog(key),
    ]);

  const killed = settings?.killSwitchEnabled ?? false;
  const displayLabel = settings?.labelOverride || feature.label;

  return (
    <div className="space-y-6 p-8">
      <AdminPageHeader
        eyebrow="Módulos"
        title={displayLabel}
        subtitle={feature.descricao}
        actions={
          <ModuloKillSwitchButton
            featureKey={key}
            featureLabel={displayLabel}
            killSwitchEnabled={killed}
            affectedTenantCount={tenantsComFeature}
          />
        }
      />

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--adm-line)" }}>
        {ABAS.map((a) => {
          const isActive = abaAtiva === a.valor;
          return (
            <Link
              key={a.valor}
              href={`/admin/modulos/${key}?aba=${a.valor}`}
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150"
              style={{
                borderColor: isActive ? "var(--adm-accent)" : "transparent",
                color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
              }}
            >
              {a.label}
            </Link>
          );
        })}
      </div>

      {abaAtiva === "acesso" && (
        <ModuloAcessoForm
          featureKey={key}
          tenants={tenants.map((t) => ({
            id: t.id,
            name: t.name,
            plan: t.plan,
            ativo: t.features.includes(key),
          }))}
          killSwitchEnabled={killed}
        />
      )}

      {abaAtiva === "aparencia" && (
        <ModuloAparenciaForm
          featureKey={key}
          initialAccentColor={settings?.accentColor ?? "#3b82f6"}
          initialPricingModel={settings?.pricingModel ?? "incluso_free"}
          initialPrecoAvulso={settings?.precoAvulso ?? null}
        />
      )}

      {abaAtiva === "metricas" && <ModuloMetricasTab ranking={ranking} />}

      {abaAtiva === "solicitacoes" && (
        <ModuloSolicitacoesForm
          featureKey={key}
          requests={changeRequests}
          tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}

      {abaAtiva === "historico" && <ModuloHistoricoTab entries={auditLog} />}
    </div>
  );
}

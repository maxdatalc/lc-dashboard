export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { FEATURES_CATALOG } from "@/lib/features";
import { getAllModuleSettings } from "@/lib/db/modules";
import { getAllTenants, isSystemAdmin } from "@/lib/db/admin";
import { getFeatureIcon } from "@/lib/features-icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { createClient } from "@/lib/supabase/server";

export default async function ModulosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = await isSystemAdmin(user.id);
  if (!admin) redirect("/dashboard");

  const [moduleSettings, tenants] = await Promise.all([
    getAllModuleSettings(),
    getAllTenants(),
  ]);

  const disponiveis = FEATURES_CATALOG.filter((f) => f.disponivel);
  const emBreve = FEATURES_CATALOG.filter((f) => !f.disponivel);

  const countForFeature = (key: string) =>
    tenants.filter((t) => t.features.includes(key)).length;

  return (
    <div className="space-y-6 p-8">
      <AdminPageHeader
        eyebrow="Sistema"
        title="Módulos"
        subtitle={`${disponiveis.length} módulos ativos no catálogo, ${emBreve.length} em breve`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {disponiveis.map((f) => {
          const settings = moduleSettings[f.key];
          const killed = settings?.killSwitchEnabled ?? false;
          const Icon = getFeatureIcon(f.icone);
          const total = countForFeature(f.key);

          return (
            <Link key={f.key} href={`/admin/modulos/${f.key}`}>
              <AdminCard hover className="p-5 h-full cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--adm-accent)" }} />
                    <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                      {settings?.labelOverride || f.label}
                    </h3>
                  </div>
                  {settings?.accentColor && (
                    <span
                      className="h-4 w-4 rounded-full shrink-0 border"
                      style={{ background: settings.accentColor, borderColor: "var(--adm-line)" }}
                      title={settings.accentColor}
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      background: f.categoria === "core" ? "var(--adm-surface-2)" : "var(--adm-accent-soft)",
                      color: f.categoria === "core" ? "var(--adm-text-dim)" : "var(--adm-accent)",
                    }}
                  >
                    {f.categoria === "core" ? "Core" : "Premium"}
                  </span>
                  {killed && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: "#fca5a5", background: "#450a0a", border: "1px solid #7f1d1d" }}
                    >
                      Desativado globalmente
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {total} de {tenants.length} empresas com acesso
                </p>
              </AdminCard>
            </Link>
          );
        })}
      </div>

      {emBreve.length > 0 && (
        <div>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--adm-text-faint)" }}
          >
            Em breve
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emBreve.map((f) => {
              const Icon = getFeatureIcon(f.icone);
              return (
                <AdminCard key={f.key} className="p-4 opacity-60">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>
                      {f.label}
                    </span>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

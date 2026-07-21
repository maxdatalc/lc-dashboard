export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Building2, Store, Star, Zap } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { FEATURES_CATALOG } from "@/lib/features";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminBadge } from "@/components/admin/AdminBadge";
import {
  AdminTable,
  AdminTableHead,
  AdminTh,
  AdminTBody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

function formatarData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function AdminPage() {
  const tenants = await getAllTenants();

  const totalClientes = tenants.filter((t) => t.isActive).length;
  const totalLojas = tenants.reduce((acc, t) => acc + t.lojas.length, 0);
  const lojasComBridge = tenants.reduce(
    (acc, t) => acc + t.lojas.filter((l) => l.sqlEnabled).length,
    0
  );
  const clientesPremium = tenants.filter((t) => t.plan === "premium").length;
  const percPremium =
    totalClientes > 0 ? Math.round((clientesPremium / totalClientes) * 100) : 0;

  const premiumKeys = new Set(
    FEATURES_CATALOG.filter((f) => f.categoria === "premium").map((f) => f.key)
  );
  const modulosPremiumAtivos = tenants.reduce(
    (acc, t) => acc + t.features.filter((k) => premiumKeys.has(k)).length,
    0
  );
  const mediaPorPremium =
    clientesPremium > 0
      ? (modulosPremiumAtivos / clientesPremium).toFixed(1)
      : "0";

  // Últimos cadastrados (ordenados por data desc)
  const ultimos5 = [...tenants]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const metrics = [
    {
      label: "Clientes ativos",
      value: totalClientes,
      sub: tenants.length - totalClientes > 0
        ? `${tenants.length - totalClientes} inativo(s)`
        : "todos ativos",
      icon: Building2,
      accent: "var(--adm-accent)",
      accentSoft: "var(--adm-accent-soft)",
    },
    {
      label: "Lojas",
      value: totalLojas,
      sub: `${lojasComBridge} com Bridge SQL`,
      icon: Store,
      accent: "var(--adm-accent)",
      accentSoft: "var(--adm-accent-soft)",
    },
    {
      label: "Clientes premium",
      value: clientesPremium,
      sub: `${percPremium}% do total`,
      icon: Star,
      accent: "var(--adm-warn)",
      accentSoft: "var(--adm-warn-soft)",
    },
    {
      label: "Módulos premium",
      value: modulosPremiumAtivos,
      sub: `média de ${mediaPorPremium} por cliente`,
      icon: Zap,
      accent: "var(--adm-signal)",
      accentSoft: "var(--adm-signal-soft)",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        eyebrow="Operação"
        title="Visão Geral"
        subtitle="LC Tecnologias — gestão de clientes e módulos"
      />

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <AdminCard
            key={m.label}
            className="adm-rise overflow-hidden p-4"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--adm-text-faint)" }}
              >
                {m.label}
              </span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: m.accentSoft }}
              >
                <m.icon className="h-3.5 w-3.5" style={{ color: m.accent }} />
              </span>
            </div>
            <p
              className="adm-mono text-3xl font-bold"
              style={{ color: "var(--adm-text)" }}
            >
              {m.value}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-text-dim)" }}>
              {m.sub}
            </p>
          </AdminCard>
        ))}
      </div>

      {/* Últimos clientes */}
      <div className="adm-rise space-y-3" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Últimos clientes cadastrados
          </h2>
          <Link
            href="/admin/empresas"
            className="adm-focusable rounded text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--adm-accent)" }}
          >
            Ver todos →
          </Link>
        </div>

        {ultimos5.length === 0 ? (
          <AdminCard>
            <AdminEmptyState icon={Building2} title="Nenhum cliente cadastrado ainda." />
          </AdminCard>
        ) : (
          <AdminTable>
            <AdminTableHead>
              <AdminTh>Cliente</AdminTh>
              <AdminTh hideBelow="md">Lojas</AdminTh>
              <AdminTh hideBelow="sm">Plano</AdminTh>
              <AdminTh hideBelow="md">Cadastrado em</AdminTh>
              <AdminTh />
            </AdminTableHead>
            <AdminTBody>
              {ultimos5.map((t, i) => (
                <AdminTr key={t.id} noBorder={i === 0}>
                  <AdminTd>
                    <div className="font-medium leading-tight">{t.name}</div>
                    <div className="adm-mono mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                      {t.slug}
                    </div>
                  </AdminTd>
                  <AdminTd hideBelow="md" className="adm-mono" style={{ color: "var(--adm-text-dim)" }}>
                    {t.lojas.length}
                  </AdminTd>
                  <AdminTd hideBelow="sm">
                    {t.plan === "premium" ? (
                      <AdminBadge variant="premium">★ Premium</AdminBadge>
                    ) : (
                      <AdminBadge variant="neutral">Free</AdminBadge>
                    )}
                  </AdminTd>
                  <AdminTd hideBelow="md" className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {formatarData(t.createdAt)}
                  </AdminTd>
                  <AdminTd align="right">
                    <Link
                      href={`/admin/empresas/${t.id}`}
                      className="adm-focusable rounded text-xs font-medium opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100"
                      style={{ color: "var(--adm-accent)" }}
                    >
                      Gerenciar →
                    </Link>
                  </AdminTd>
                </AdminTr>
              ))}
            </AdminTBody>
          </AdminTable>
        )}
      </div>
    </div>
  );
}

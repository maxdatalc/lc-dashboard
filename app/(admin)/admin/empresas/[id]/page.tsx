export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, RefreshCw, Scale, Settings, Shield, Users, Users2, Zap } from "lucide-react";
import {
  getTenantByIdAdmin,
  updateTenantFeatures,
  updateTenantPlan,
  getUsuariosTenantDetalhado,
  getGruposTenant,
} from "@/lib/db/admin";
import { FEATURES_CATALOG } from "@/lib/features";
import { getKilledFeatureKeys } from "@/lib/db/modules";
import { getClientesByTenantId, vincularClientesPorCnpjs } from "@/lib/db/clientes-base";
import { LojasSectionClient } from "@/components/admin/LojasSectionClient";
import { UsuariosSectionClient } from "@/components/admin/UsuariosSectionClient";
import { GruposSectionClient } from "@/components/admin/GruposSectionClient";
import { EditNomeTenantClient } from "@/components/admin/EditNomeTenantClient";
import { selecionarEmpresaAdmin } from "@/app/actions/auth";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge, AdminStatusDot } from "@/components/admin/AdminBadge";
import { AdminTabs, AdminTabPanel } from "@/components/admin/AdminTabs";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminTable,
  AdminTableHead,
  AdminTh,
  AdminTBody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";

type Aba = "lojas" | "features" | "usuarios" | "clientes" | "permissoes";

// ── Server Actions ────────────────────────────────────────────────────────────

async function salvarFeatures(tenantId: string, formData: FormData) {
  "use server";
  const features = [...new Set(formData.getAll("feature").map(String))];
  await updateTenantFeatures(tenantId, features);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function alterarPlano(tenantId: string, formData: FormData) {
  "use server";
  const novoPlano = formData.get("plano") as "free" | "premium";
  if (novoPlano !== "free" && novoPlano !== "premium") return;
  await updateTenantPlan(tenantId, novoPlano);
  redirect(`/admin/empresas/${tenantId}`);
}

async function atualizarVinculos(tenantId: string, formData: FormData) {
  "use server";
  const cnpjs = formData.getAll("cnpj").map(String).filter(Boolean);
  const vinculados = await vincularClientesPorCnpjs(tenantId, cnpjs);
  redirect(`/admin/empresas/${tenantId}?aba=clientes&vinculados=${vinculados}`);
}

// ── Componente ────────────────────────────────────────────────────────────────

export default async function GerenciarEmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; vinculados?: string }>;
}) {
  const { id } = await params;
  const { aba: abaParam, vinculados: vinculadosParam } = await searchParams;
  const abaAtiva: Aba = (["lojas", "features", "usuarios", "clientes", "permissoes"].includes(abaParam ?? "")
    ? abaParam
    : "lojas") as Aba;

  const tenant = await getTenantByIdAdmin(id);
  if (!tenant) notFound();

  const usuarios = (abaAtiva === "usuarios" || abaAtiva === "permissoes") ? await getUsuariosTenantDetalhado(id) : [];
  const grupos = (abaAtiva === "usuarios" || abaAtiva === "permissoes") ? await getGruposTenant(id) : [];
  const clientesVinculados = abaAtiva === "clientes" ? await getClientesByTenantId(id) : [];
  const killedFeatureKeys = (abaAtiva === "features" || abaAtiva === "usuarios") ? await getKilledFeatureKeys() : [];

  const emBreveFeatures = FEATURES_CATALOG.filter((f) => !f.disponivel);
  const addonFeatures   = FEATURES_CATALOG.filter((f) => f.disponivel);

  const ABAS = [
    { valor: "lojas" as Aba, label: "Lojas", icon: Building2, count: tenant.lojas.length },
    { valor: "features" as Aba, label: "Módulos", icon: Zap },
    { valor: "usuarios" as Aba, label: "Usuários", icon: Users },
    { valor: "permissoes" as Aba, label: "Permissões", icon: Shield },
    { valor: "clientes" as Aba, label: "Clientes", icon: Users2 },
  ];

  return (
    <div className="space-y-6 p-6">

      {/* Cabeçalho */}
      <div className="adm-rise space-y-4">
        {/* Breadcrumb */}
        <Link
          href="/admin/empresas"
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as empresas
        </Link>

        {/* Título + badges */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <EditNomeTenantClient tenantId={id} currentName={tenant.name} />
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <span className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                {tenant.slug}
              </span>
              <span style={{ color: "var(--adm-line-strong)" }}>·</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                <Building2 className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                {tenant.lojas.length} {tenant.lojas.length === 1 ? "loja" : "lojas"}
              </span>
              <span style={{ color: "var(--adm-line-strong)" }}>·</span>
              <AdminStatusDot active={tenant.isActive} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {/* Toggle de plano */}
            <form action={alterarPlano.bind(null, id)}>
              <input type="hidden" name="plano" value={tenant.plan === "premium" ? "free" : "premium"} />
              <button
                type="submit"
                title={tenant.plan === "premium" ? "Clique para mudar para Free" : "Clique para mudar para Premium"}
                className="adm-focusable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all"
                style={{
                  background: tenant.plan === "premium" ? "var(--adm-warn-soft)" : "var(--adm-surface-2)",
                  color: tenant.plan === "premium" ? "var(--adm-warn)" : "var(--adm-text-dim)",
                  border: "1px solid var(--adm-line-strong)",
                }}
              >
                {tenant.plan === "premium" ? "★ Premium" : "Free"}
                <span className="text-[10px] font-normal opacity-70">
                  {tenant.plan === "premium" ? "→ free" : "→ premium"}
                </span>
              </button>
            </form>

            {/* Acessar dashboard desta empresa */}
            <form action={selecionarEmpresaAdmin}>
              <input type="hidden" name="tenantId" value={id} />
              <AdminButton type="submit" variant="secondary">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver dashboard
              </AdminButton>
            </form>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={ABAS.map((a) => ({
          value: a.valor,
          label: a.label,
          icon: <a.icon className="h-4 w-4 shrink-0" />,
          count: a.count,
        }))}
        active={abaAtiva}
        basePath={`/admin/empresas/${id}`}
      />

      {/* Conteúdo das abas */}
      <AdminTabPanel>

        {/* ── Aba Lojas ────────────────────────────────────────────────────── */}
        {abaAtiva === "lojas" && (
          <LojasSectionClient lojas={tenant.lojas} tenantId={id} />
        )}

        {/* ── Aba Módulos ──────────────────────────────────────────────────── */}
        {abaAtiva === "features" && (
          <div className="space-y-4">

            {/* Módulos disponíveis — todos editáveis por empresa */}
            <form action={salvarFeatures.bind(null, id)} className="space-y-3">
              <AdminCard className="p-5">
                <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Módulos</h3>
                <p className="mb-4 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                  Ative ou desative módulos para esta empresa. Todos podem ser configurados livremente.
                </p>

                <div className="space-y-2.5">
                  {addonFeatures.map((f) => {
                    const ativo = tenant.features.includes(f.key);
                    const killedGlobally = killedFeatureKeys.includes(f.key);
                    return (
                      <div key={f.key}>
                        <label
                          className="flex items-start gap-3 rounded-xl p-4 transition-all"
                          style={{
                            border: "1px solid",
                            borderColor: killedGlobally
                              ? "var(--adm-line)"
                              : ativo
                              ? "var(--adm-accent)"
                              : "var(--adm-line-strong)",
                            background: killedGlobally
                              ? "var(--adm-surface-2)"
                              : ativo
                              ? "var(--adm-accent-soft)"
                              : "transparent",
                            opacity: killedGlobally ? 0.6 : 1,
                            cursor: killedGlobally ? "not-allowed" : "pointer",
                          }}
                        >
                          {killedGlobally && ativo && (
                            <input type="hidden" name="feature" value={f.key} />
                          )}
                          <input
                            type="checkbox"
                            name="feature"
                            value={f.key}
                            defaultChecked={ativo}
                            disabled={killedGlobally}
                            className="adm-focusable mt-0.5 shrink-0 rounded"
                            style={{ accentColor: "var(--adm-accent)" }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>{f.label}</p>
                              {killedGlobally && <AdminBadge variant="danger">Desativado globalmente</AdminBadge>}
                            </div>
                            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>{f.descricao}</p>
                            {killedGlobally && (
                              <Link
                                href={`/admin/modulos/${f.key}`}
                                className="adm-focusable mt-1 inline-flex items-center gap-1 rounded text-xs font-medium"
                                style={{ color: "var(--adm-alert)" }}
                              >
                                Reative em Módulos → {f.label}
                              </Link>
                            )}
                          </div>
                        </label>

                        {/* Configuração do módulo O.S. */}
                        {f.key === "modulo_os" && ativo && (
                          <div className="ml-4 mt-2 border-l-2 pl-4" style={{ borderColor: "var(--adm-accent-soft)" }}>
                            <Link
                              href={`/admin/empresas/${id}/modulo-os`}
                              className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
                              style={{ color: "var(--adm-accent)" }}
                            >
                              <Settings className="h-3 w-3" />
                              Configurar inventários e tipos fiscais
                            </Link>
                          </div>
                        )}

                        {/* Configuração do módulo Fiscal (SIEG) — um link por loja com Bridge */}
                        {f.key === "modulo_fiscal" && ativo && (
                          <div className="ml-4 mt-2 space-y-1.5 border-l-2 pl-4" style={{ borderColor: "var(--adm-accent-soft)" }}>
                            <p className="text-xs font-medium" style={{ color: "var(--adm-text-faint)" }}>
                              Configurar credenciais SIEG por loja:
                            </p>
                            {tenant.lojas.filter((l) => l.sqlEnabled).length === 0 ? (
                              <p className="text-xs" style={{ color: "var(--adm-warn)" }}>
                                Nenhuma loja com Bridge SQL ativa. Configure a Bridge antes de habilitar o SIEG.
                              </p>
                            ) : (
                              tenant.lojas
                                .filter((l) => l.sqlEnabled)
                                .map((l) => (
                                  <div key={l.id}>
                                    <Link
                                      href={`/admin/empresas/${id}/lojas/${l.id}/sieg`}
                                      className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
                                      style={{ color: "var(--adm-accent)" }}
                                    >
                                      <Scale className="h-3 w-3" />
                                      {l.name} — OAuth Token SIEG
                                    </Link>
                                  </div>
                                ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AdminCard>

              <AdminButton type="submit">Salvar</AdminButton>
            </form>

            {/* Em breve */}
            <details className="group overflow-hidden rounded-xl" style={{ border: "1px solid var(--adm-line)" }}>
              <summary
                className="flex cursor-pointer select-none list-none items-center justify-between px-5 py-3.5 transition-colors"
                style={{ background: "var(--adm-surface-2)" }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                  Em breve — {emBreveFeatures.length} módulos
                </span>
                <svg
                  className="h-4 w-4 transition-transform group-open:rotate-180"
                  style={{ color: "var(--adm-text-faint)" }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2" style={{ background: "var(--adm-surface)" }}>
                {emBreveFeatures.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-start gap-3 rounded-lg p-3"
                    style={{ border: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--adm-text-faint)" }}>{f.label}</p>
                        <AdminBadge variant="neutral">Em breve</AdminBadge>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>{f.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* ── Aba Usuários ─────────────────────────────────────────────────── */}
        {abaAtiva === "usuarios" && (
          <UsuariosSectionClient
            tenantId={id}
            usuarios={usuarios}
            lojas={tenant.lojas.map((l) => ({
              id: l.id,
              name: l.name,
              bridgeEnabled: l.sqlEnabled,
              empId: l.empId,
            }))}
            tenantFeatures={tenant.features}
            grupos={grupos}
            killedFeatureKeys={killedFeatureKeys}
          />
        )}

        {/* ── Aba Permissões ───────────────────────────────────────────────── */}
        {abaAtiva === "permissoes" && (
          <GruposSectionClient
            tenantId={id}
            grupos={grupos}
            tenantFeatures={tenant.features}
            usuarios={usuarios}
          />
        )}

        {/* ── Aba Clientes ─────────────────────────────────────────────────── */}
        {abaAtiva === "clientes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                  {clientesVinculados.length}{" "}
                  {clientesVinculados.length === 1 ? "empresa vinculada" : "empresas vinculadas"} na base de clientes
                </p>
                {vinculadosParam !== undefined && (
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: Number(vinculadosParam) > 0 ? "var(--adm-signal)" : "var(--adm-text-faint)" }}
                  >
                    {Number(vinculadosParam) > 0
                      ? `${vinculadosParam} novo(s) vínculo(s) criado(s) agora`
                      : "Nenhum novo vínculo encontrado — todos já estavam vinculados ou não há correspondência de CNPJ"}
                  </p>
                )}
              </div>
              <form action={atualizarVinculos.bind(null, id)}>
                {tenant.lojas
                  .filter((l) => l.cnpj)
                  .map((l) => (
                    <input key={l.id} type="hidden" name="cnpj" value={l.cnpj!} />
                  ))}
                <AdminButton type="submit" variant="secondary" size="sm">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar Vínculos
                </AdminButton>
              </form>
            </div>

            {clientesVinculados.length === 0 ? (
              <AdminCard>
                <AdminEmptyState
                  icon={Users2}
                  title="Nenhuma empresa vinculada ainda"
                  description='Clique em "Atualizar Vínculos" para buscar automaticamente pelas lojas com CNPJ cadastrado.'
                />
              </AdminCard>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTh hideBelow="md">Código</AdminTh>
                  <AdminTh>Empresa</AdminTh>
                  <AdminTh hideBelow="sm">CNPJ</AdminTh>
                  <AdminTh hideBelow="md">Cidade</AdminTh>
                  <AdminTh />
                </AdminTableHead>
                <AdminTBody>
                  {clientesVinculados.map((c, i) => (
                    <AdminTr key={c.id} noBorder={i === 0}>
                      <AdminTd hideBelow="md" className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                        {c.codigo_externo ?? "—"}
                      </AdminTd>
                      <AdminTd>
                        <p className="text-sm font-semibold">{c.nome_fantasia || c.razao_social}</p>
                        {c.nome_fantasia && (
                          <p className="truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>{c.razao_social}</p>
                        )}
                      </AdminTd>
                      <AdminTd hideBelow="sm" className="adm-mono text-xs" style={{ color: "var(--adm-text-dim)" }}>
                        {c.cnpj_cpf ?? "—"}
                      </AdminTd>
                      <AdminTd hideBelow="md" className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
                        {c.cidade ?? "—"}
                      </AdminTd>
                      <AdminTd align="right">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="adm-focusable rounded text-xs font-medium transition-colors"
                          style={{ color: "var(--adm-text-dim)" }}
                        >
                          Ver →
                        </Link>
                      </AdminTd>
                    </AdminTr>
                  ))}
                </AdminTBody>
              </AdminTable>
            )}
          </div>
        )}
      </AdminTabPanel>
    </div>
  );
}

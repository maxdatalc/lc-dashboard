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
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div
        className="space-y-3"
        style={{ animation: "fadeInUp 0.3s ease-out both" }}
      >
        {/* Breadcrumb */}
        <Link
          href="/admin/empresas"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as empresas
        </Link>

        {/* Título + badges */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <EditNomeTenantClient tenantId={id} currentName={tenant.name} />
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-400 font-mono">{tenant.slug}</span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                {tenant.lojas.length}{" "}
                {tenant.lojas.length === 1 ? "loja" : "lojas"}
              </span>
              <span className="text-slate-300">·</span>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  tenant.isActive ? "bg-emerald-400" : "bg-slate-300"
                }`}
              />
              <span className="text-xs text-slate-400">
                {tenant.isActive ? "Ativa" : "Inativa"}
              </span>
            </div>

          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Toggle de plano */}
            <form action={alterarPlano.bind(null, id)}>
              <input
                type="hidden"
                name="plano"
                value={tenant.plan === "premium" ? "free" : "premium"}
              />
              <button
                type="submit"
                title={tenant.plan === "premium" ? "Clique para mudar para Free" : "Clique para mudar para Premium"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all hover:shadow-sm hover:-translate-y-px ${
                  tenant.plan === "premium"
                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                    : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tenant.plan === "premium" ? "★ Premium" : "Free"}
                <span className="text-[10px] opacity-60 font-normal">
                  {tenant.plan === "premium" ? "→ free" : "→ premium"}
                </span>
              </button>
            </form>

            {/* Acessar dashboard desta empresa */}
            <form action={selecionarEmpresaAdmin}>
              <input type="hidden" name="tenantId" value={id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver dashboard
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0.5 border-b border-slate-200"
        style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
      >
        {ABAS.map((a) => {
          const isActive = abaAtiva === a.valor;
          return (
            <Link
              key={a.valor}
              href={`/admin/empresas/${id}?aba=${a.valor}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
              {a.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {a.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo das abas */}
      <div style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "80ms" }}>

        {/* ── Aba Lojas ────────────────────────────────────────────────────── */}
        {abaAtiva === "lojas" && (
          <LojasSectionClient lojas={tenant.lojas} tenantId={id} />
        )}

        {/* ── Aba Módulos ──────────────────────────────────────────────────── */}
        {abaAtiva === "features" && (
          <div className="space-y-4">

            {/* Módulos disponíveis — todos editáveis por empresa */}
            <form action={salvarFeatures.bind(null, id)} className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Módulos</h3>
                <p className="text-xs text-slate-400 mb-4">Ative ou desative módulos para esta empresa. Todos podem ser configurados livremente.</p>

                <div className="space-y-3">
                  {addonFeatures.map((f) => {
                    const ativo = tenant.features.includes(f.key);
                    const killedGlobally = killedFeatureKeys.includes(f.key);
                    return (
                      <div key={f.key}>
                        <label
                          className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                            killedGlobally
                              ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                              : `cursor-pointer hover:-translate-y-px hover:shadow-sm ${ativo ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`
                          }`}
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
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                              {killedGlobally && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                                  Desativado globalmente
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{f.descricao}</p>
                            {killedGlobally && (
                              <Link
                                href={`/admin/modulos/${f.key}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 mt-1"
                              >
                                Reative em Módulos → {f.label}
                              </Link>
                            )}
                          </div>
                        </label>

                        {/* Configuração do módulo O.S. */}
                        {f.key === "modulo_os" && ativo && (
                          <div className="mt-2 pl-4 border-l-2 border-blue-200">
                            <Link
                              href={`/admin/empresas/${id}/modulo-os`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <Settings className="h-3 w-3" />
                              Configurar inventários e tipos fiscais
                            </Link>
                          </div>
                        )}

                        {/* Configuração do módulo Fiscal (SIEG) — um link por loja com Bridge */}
                        {f.key === "modulo_fiscal" && ativo && (
                          <div className="mt-2 pl-4 border-l-2 border-blue-200 space-y-1.5">
                            <p className="text-xs text-slate-500 font-medium">Configurar credenciais SIEG por loja:</p>
                            {tenant.lojas.filter((l) => l.sqlEnabled).length === 0 ? (
                              <p className="text-xs text-amber-600">
                                Nenhuma loja com Bridge SQL ativa. Configure a Bridge antes de habilitar o SIEG.
                              </p>
                            ) : (
                              tenant.lojas
                                .filter((l) => l.sqlEnabled)
                                .map((l) => (
                                  <div key={l.id}>
                                    <Link
                                      href={`/admin/empresas/${id}/lojas/${l.id}/sieg`}
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
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
              </div>

              <button
                type="submit"
                className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
              >
                Salvar
              </button>
            </form>

            {/* Em breve */}
            <details className="group rounded-xl border border-slate-200 overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3.5 bg-slate-50 cursor-pointer select-none list-none hover:bg-slate-100 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Em breve — {emBreveFeatures.length} módulos
                </span>
                <svg
                  className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                {emBreveFeatures.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-400">{f.label}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                          Em breve
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{f.descricao}</p>
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
                <p className="text-sm font-semibold text-slate-700">
                  {clientesVinculados.length}{" "}
                  {clientesVinculados.length === 1 ? "empresa vinculada" : "empresas vinculadas"} na base de clientes
                </p>
                {vinculadosParam !== undefined && (
                  <p className={`text-xs mt-0.5 ${Number(vinculadosParam) > 0 ? "text-emerald-600" : "text-slate-400"}`}>
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
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar Vínculos
                </button>
              </form>
            </div>

            {clientesVinculados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
                <Users2 className="h-9 w-9 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Nenhuma empresa vinculada ainda</p>
                <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                  Clique em &ldquo;Atualizar Vínculos&rdquo; para buscar automaticamente pelas lojas com CNPJ cadastrado.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Código", "Empresa", "CNPJ", "Cidade", ""].map((col) => (
                        <th
                          key={col}
                          className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clientesVinculados.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-xs font-mono text-slate-400">
                          {c.codigo_externo ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800 text-sm">
                            {c.nome_fantasia || c.razao_social}
                          </p>
                          {c.nome_fantasia && (
                            <p className="text-xs text-slate-400 truncate">{c.razao_social}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono text-slate-500">
                          {c.cnpj_cpf ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {c.cidade ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/admin/clientes/${c.id}`}
                            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

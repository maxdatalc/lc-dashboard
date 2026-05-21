// Página de gerenciamento de um cliente — abas: Lojas | Módulos | Usuários
// Server Component com Server Action para atualização de features

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getTenantByIdAdmin,
  updateTenantFeatures,
  getUsuariosTenant,
} from "@/lib/db/admin";
import { FEATURES_CATALOG, getCoreFeatures } from "@/lib/features";
import { LojasSectionClient } from "@/components/admin/LojasSectionClient";
import { UsuariosSectionClient } from "@/components/admin/UsuariosSectionClient";

type Aba = "lojas" | "features" | "usuarios";

// ── Server Action para atualizar módulos ────────────────────────────────────

async function salvarFeatures(tenantId: string, formData: FormData) {
  "use server";
  const features = formData.getAll("feature").map(String);
  // Garantir que features core sejam sempre incluídas
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...features]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/clientes/${tenantId}?aba=features`);
}

// ── Componente ──────────────────────────────────────────────────────────────

export default async function GerenciarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  const abaAtiva: Aba = (["lojas", "features", "usuarios"].includes(abaParam ?? "")
    ? abaParam
    : "lojas") as Aba;

  const tenant = await getTenantByIdAdmin(id);
  if (!tenant) notFound();

  // Buscar usuários apenas na aba ativa para evitar chamadas desnecessárias
  const usuarios = abaAtiva === "usuarios" ? await getUsuariosTenant(id) : [];

  const coreFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "core");
  const premiumFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "premium");

  const ABAS: { valor: Aba; label: string }[] = [
    { valor: "lojas", label: "Lojas" },
    { valor: "features", label: "Módulos" },
    { valor: "usuarios", label: "Usuários" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/clientes"
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <span className="text-slate-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
          <span className="text-xs text-slate-400 font-mono">{tenant.slug}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {tenant.plan === "premium" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              ★ Premium
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/admin/clientes/${id}?aba=${a.valor}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === a.valor
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── Aba Lojas ─────────────────────────────────────────────────────── */}
      {abaAtiva === "lojas" && (
        <LojasSectionClient lojas={tenant.lojas} tenantId={id} />
      )}

      {/* ── Aba Módulos ───────────────────────────────────────────────────── */}
      {abaAtiva === "features" && (
        <form action={salvarFeatures.bind(null, id)} className="space-y-6">
          {/* Core — sempre ativas, sem toggle */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Core (sempre incluídos)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {coreFeatures.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{f.label}</p>
                    <p className="text-xs text-slate-400">{f.descricao}</p>
                  </div>
                  <div className="w-8 h-4 bg-slate-300 rounded-full shrink-0 cursor-not-allowed" />
                </div>
              ))}
            </div>
          </div>

          {/* Premium — checkboxes */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Premium
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {premiumFeatures.map((f) => {
                const ativo = tenant.features.includes(f.key);
                return (
                  <label
                    key={f.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      ativo ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200"
                    } ${!f.disponivel ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="feature"
                      value={f.key}
                      defaultChecked={ativo}
                      disabled={!f.disponivel}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">{f.label}</p>
                        {!f.disponivel && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">
                            Em breve
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{f.descricao}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Salvar módulos
          </button>
        </form>
      )}

      {/* ── Aba Usuários ──────────────────────────────────────────────────── */}
      {abaAtiva === "usuarios" && (
        <UsuariosSectionClient tenantId={id} usuarios={usuarios} />
      )}
    </div>
  );
}

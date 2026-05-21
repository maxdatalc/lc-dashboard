// Página de gerenciamento de um cliente — abas: Lojas | Módulos | Usuários
// Server Component com Server Action para atualização de features

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, ArrowLeft } from "lucide-react";
import { getTenantByIdAdmin, updateTenantFeatures } from "@/lib/db/admin";
import { FEATURES_CATALOG, getCoreFeatures } from "@/lib/features";
import { SyncInicialModal } from "@/components/admin/SyncInicialModal";

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
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600">
              {tenant.lojas.length} {tenant.lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
            </p>
            <Link
              href={`/admin/clientes/${id}/lojas/nova`}
              className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
            >
              + Adicionar Loja
            </Link>
          </div>

          {tenant.lojas.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-slate-200">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma loja cadastrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Nome", "EmpId", "URL do Túnel", "Status", "Sincronização"].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenant.lojas.map((loja) => (
                    <tr key={loja.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{loja.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{loja.empId}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-xs">
                        {loja.erpBaseUrl}
                      </td>
                      <td className="px-4 py-3">
                        {loja.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SyncInicialModal lojaId={loja.id} lojaNome={loja.name} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Módulos ───────────────────────────────────────────────────── */}
      {abaAtiva === "features" && (
        <form
          action={salvarFeatures.bind(null, id)}
          className="space-y-6"
        >
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

          {/* Premium — checkboxes com valor como hidden input */}
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
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {tenant.totalUsuarios} {tenant.totalUsuarios === 1 ? "usuário vinculado" : "usuários vinculados"}
          </p>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <p className="text-sm font-medium text-slate-700">Usuários do tenant</p>
              <button
                disabled
                className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md opacity-40 cursor-not-allowed"
              >
                + Adicionar Usuário
              </button>
            </div>
            <div className="py-10 text-center text-slate-400 text-sm">
              Listagem de usuários será implementada na próxima versão.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

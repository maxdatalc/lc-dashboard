export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload, ChevronRight, Search, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/db/admin";
import {
  getClientesBase,
  getSegmentosDistintos,
  getCidadesDistintas,
  getClientesBaseStats,
  getTenantsFiltro,
} from "@/lib/db/clientes-base";

// ── Cores por segmento ─────────────────────────────────────────────────────────

const SEGMENTO_CORES: Record<string, { border: string; bg: string; text: string }> = {
  "AUTO CENTER / AUTO P": { border: "#3b82f6", bg: "#dbeafe", text: "#1e40af" },
  "MATERIAIS DE CONSTRU": { border: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  "SERVIÇOS":             { border: "#94a3b8", bg: "#f1f5f9", text: "#475569" },
  "DISTRIBUIDORAS / ATA": { border: "#8b5cf6", bg: "#ede9fe", text: "#5b21b6" },
  "VAREJO - GERAL":       { border: "#14b8a6", bg: "#ccfbf1", text: "#134e4a" },
  "INDUSTRIA":            { border: "#f97316", bg: "#ffedd5", text: "#9a3412" },
  "CONFECÇÃO / CALÇADOS": { border: "#ec4899", bg: "#fce7f3", text: "#831843" },
  "RESTAURANTE / ALIMEN": { border: "#22c55e", bg: "#dcfce7", text: "#14532d" },
  "FERRAGISTA / PARAFUS": { border: "#eab308", bg: "#fef9c3", text: "#713f12" },
  "AGROPECUARIA":         { border: "#84cc16", bg: "#ecfccb", text: "#365314" },
  "SUPERMERCADO / CONVE": { border: "#10b981", bg: "#d1fae5", text: "#064e3b" },
  "INFORMATICA / ELETRO": { border: "#6366f1", bg: "#e0e7ff", text: "#3730a3" },
  "POSTO DE COMBUSTIVEL": { border: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
  "HOSPITALAR / DENTAL":  { border: "#06b6d4", bg: "#cffafe", text: "#164e63" },
  "VETERINARIA":          { border: "#a855f7", bg: "#f3e8ff", text: "#6b21a8" },
  "COSMETICOS":           { border: "#d946ef", bg: "#fdf4ff", text: "#86198f" },
  "OTICA":                { border: "#0ea5e9", bg: "#e0f2fe", text: "#0c4a6e" },
  "GÃS DISTIBUIDOR / DE": { border: "#f97316", bg: "#fff7ed", text: "#9a3412" },
  "ULTILIDADES":          { border: "#64748b", bg: "#f8fafc", text: "#334155" },
  "PAPELARIA / CINE FOT": { border: "#ca8a04", bg: "#fefce8", text: "#a16207" },
};

function getSegmentoCor(seg: string | null) {
  if (!seg) return { border: "#e2e8f0", bg: "#f8fafc", text: "#64748b" };
  return SEGMENTO_CORES[seg] ?? { border: "#e2e8f0", bg: "#f8fafc", text: "#64748b" };
}

// ── Grid ───────────────────────────────────────────────────────────────────────
const GRID = "56px 1fr 160px 120px 130px 110px 40px";

// ── Componente ─────────────────────────────────────────────────────────────────

export default async function ClientesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segmento?: string; cidade?: string; status?: string; grupo?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getAdminRole(user.id);
  if (!role) redirect("/dashboard");

  const isAdmin = role === "admin";

  const sp = await searchParams;
  const q        = sp.q?.trim() ?? "";
  const segmento = sp.segmento ?? "";
  const cidade   = sp.cidade ?? "";
  const status   = (sp.status === "cadastrados" || sp.status === "pendentes") ? sp.status : "";
  const grupo    = sp.grupo ?? "";
  const page     = Math.max(1, Number(sp.page ?? 1));

  const [{ data: clientes, total }, stats, segmentos, cidades, tenants] = await Promise.all([
    getClientesBase({
      q: q || undefined,
      segmento: segmento || undefined,
      cidade: cidade || undefined,
      page,
      status: status || undefined,
      tenantId: grupo || undefined,
    }),
    getClientesBaseStats(),
    getSegmentosDistintos(),
    getCidadesDistintas(),
    getTenantsFiltro(),
  ]);

  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  const perPage   = 30;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, segmento, cidade, status, grupo, page: String(page) });
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return `/admin/clientes?${params.toString()}`;
  };

  const hasFilter = !!(q || segmento || cidade || status || grupo);

  return (
    <div className="p-6 space-y-5" style={{ animation: "fadeInUp 0.3s ease-out both" }}>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Base de Clientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {stats.total} registros · {stats.segmentos} segmentos · {stats.cidades} cidades
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin/empresas/novo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              + Novo Grupo
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/clientes/importar"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Importar arquivo
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" action="/admin/clientes" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CNPJ ou código..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <select
          name="grupo"
          defaultValue={grupo}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Todos os grupos</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          name="segmento"
          defaultValue={segmento}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Todos os segmentos</option>
          {segmentos.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="cidade"
          defaultValue={cidade}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Todas as cidades</option>
          {cidades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Todos os status</option>
          <option value="cadastrados">Cadastrados</option>
          <option value="pendentes">Pendentes</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          Filtrar
        </button>
        {hasFilter && (
          <Link
            href="/admin/clientes"
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Lista */}
      {clientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <Building2 className="h-9 w-9 text-slate-200 mx-auto mb-3" />
          {stats.total === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-600">Nenhum cliente importado ainda</p>
              <p className="text-xs text-slate-400 mt-1.5">Importe um arquivo XLSX para começar</p>
              <Link
                href="/admin/clientes/importar"
                className="inline-flex items-center gap-2 mt-4 text-xs font-medium text-slate-700 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Importar arquivo
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Nenhum resultado para os filtros aplicados</p>
              <Link href="/admin/clientes" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-700 underline">
                Limpar filtros
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

          {/* Cabeçalho da tabela */}
          <div
            className="hidden sm:grid text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2.5"
            style={{ gridTemplateColumns: GRID, borderBottom: "1px solid #f1f5f9" }}
          >
            <span>Código</span>
            <span>Empresa</span>
            <span>Segmento</span>
            <span>Cidade</span>
            <span>Grupo</span>
            <span>Status</span>
            <span />
          </div>

          {/* Linhas */}
          <div className="divide-y divide-slate-50">
            {clientes.map((cliente) => {
              const cor = getSegmentoCor(cliente.segmento);
              const cadastrado = !!cliente.tenant_id;
              const nomeGrupo = cliente.tenant_id ? tenantMap.get(cliente.tenant_id) : null;
              return (
                <Link
                  key={cliente.id}
                  href={`/admin/clientes/${cliente.id}`}
                  className="group hidden sm:grid items-center px-4 py-3 hover:bg-slate-50 transition-colors"
                  style={{
                    gridTemplateColumns: GRID,
                    borderLeft: `3px solid ${cadastrado ? "#10b981" : cor.border}`,
                  }}
                >
                  {/* Código */}
                  <span className="text-xs font-mono text-slate-400">
                    {cliente.codigo_externo ?? "—"}
                  </span>

                  {/* Nome */}
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-slate-700">
                      {cliente.nome_fantasia || cliente.razao_social}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {cliente.cnpj_cpf || cliente.razao_social}
                    </p>
                  </div>

                  {/* Segmento */}
                  <div className="flex items-center pr-3">
                    {cliente.segmento ? (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full truncate max-w-full"
                        style={{ background: cor.bg, color: cor.text }}
                      >
                        {cliente.segmento}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Cidade */}
                  <span className="text-xs text-slate-500 truncate pr-3">
                    {cliente.cidade ?? "—"}
                  </span>

                  {/* Grupo */}
                  <div className="pr-3">
                    {nomeGrupo ? (
                      <span className="text-xs font-medium text-slate-600 truncate block">
                        {nomeGrupo}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    {cadastrado ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Cadastrado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Seta */}
                  <div className="flex items-center justify-end">
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Versão mobile */}
          <div className="sm:hidden divide-y divide-slate-50">
            {clientes.map((cliente) => {
              const cor = getSegmentoCor(cliente.segmento);
              const cadastrado = !!cliente.tenant_id;
              return (
                <Link
                  key={`mob-${cliente.id}`}
                  href={`/admin/clientes/${cliente.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  style={{ borderLeft: `3px solid ${cadastrado ? "#10b981" : cor.border}` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {cliente.nome_fantasia || cliente.razao_social}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{cliente.cnpj_cpf}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
          </span>
          <div className="flex gap-1">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            <span className="px-3 py-1.5 text-slate-500">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Próxima →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

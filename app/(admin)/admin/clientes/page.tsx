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
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";

// ── Matiz por segmento (funciona em ambos os temas: matiz + fundo translúcido) ──

const SEGMENTO_HUE: Record<string, string> = {
  "AUTO CENTER / AUTO P": "#3b82f6",
  "MATERIAIS DE CONSTRU": "#f59e0b",
  "SERVIÇOS":             "#94a3b8",
  "DISTRIBUIDORAS / ATA": "#8b5cf6",
  "VAREJO - GERAL":       "#14b8a6",
  "INDUSTRIA":            "#f97316",
  "CONFECÇÃO / CALÇADOS": "#ec4899",
  "RESTAURANTE / ALIMEN": "#22c55e",
  "FERRAGISTA / PARAFUS": "#eab308",
  "AGROPECUARIA":         "#84cc16",
  "SUPERMERCADO / CONVE": "#10b981",
  "INFORMATICA / ELETRO": "#6366f1",
  "POSTO DE COMBUSTIVEL": "#ef4444",
  "HOSPITALAR / DENTAL":  "#06b6d4",
  "VETERINARIA":          "#a855f7",
  "COSMETICOS":           "#d946ef",
  "OTICA":                "#0ea5e9",
  "GÃS DISTIBUIDOR / DE": "#f97316",
  "ULTILIDADES":          "#64748b",
  "PAPELARIA / CINE FOT": "#ca8a04",
};

function getSegmentoHue(seg: string | null): string {
  if (!seg) return "#94a3b8";
  return SEGMENTO_HUE[seg] ?? "#94a3b8";
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
    <div className="p-6 space-y-5">

      <AdminPageHeader
        eyebrow="Operação"
        title="Base de Clientes"
        subtitle={`${stats.total} registros · ${stats.segmentos} segmentos · ${stats.cidades} cidades`}
        actions={
          isAdmin && (
            <>
              <AdminButton href="/admin/empresas/novo" variant="secondary">
                + Novo Grupo
              </AdminButton>
              <AdminButton href="/admin/clientes/importar" variant="primary">
                <Upload className="h-4 w-4" />
                Importar arquivo
              </AdminButton>
            </>
          )
        }
      />

      {/* Filtros */}
      <form method="GET" action="/admin/clientes" className="adm-rise flex flex-wrap gap-3" style={{ animationDelay: "60ms" }}>
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--adm-text-faint)" }}
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CNPJ ou código..."
            className="adm-field w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select name="grupo" defaultValue={grupo} className="adm-field px-3 py-2 text-sm">
          <option value="">Todos os grupos</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="segmento" defaultValue={segmento} className="adm-field px-3 py-2 text-sm">
          <option value="">Todos os segmentos</option>
          {segmentos.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="cidade" defaultValue={cidade} className="adm-field px-3 py-2 text-sm">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="adm-field px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          <option value="cadastrados">Cadastrados</option>
          <option value="pendentes">Pendentes</option>
        </select>
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          Filtrar
        </button>
        {hasFilter && (
          <Link
            href="/admin/clientes"
            className="rounded-lg px-3 py-2 text-sm transition-colors"
            style={{ color: "var(--adm-text-dim)", border: "1px solid var(--adm-line-strong)" }}
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Lista */}
      {clientes.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ border: "1px dashed var(--adm-line-strong)" }}
        >
          <Building2 className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--adm-text-faint)" }} />
          {stats.total === 0 ? (
            <>
              <p className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>Nenhum cliente importado ainda</p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>Importe um arquivo XLSX para começar</p>
              <Link
                href="/admin/clientes/importar"
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium"
                style={{ color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)", background: "var(--adm-surface-2)" }}
              >
                <Upload className="h-3.5 w-3.5" />
                Importar arquivo
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>Nenhum resultado para os filtros aplicados</p>
              <Link href="/admin/clientes" className="mt-3 inline-block text-xs underline" style={{ color: "var(--adm-accent)" }}>
                Limpar filtros
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          className="adm-rise overflow-hidden rounded-xl"
          style={{ animationDelay: "90ms", background: "var(--adm-surface)", border: "1px solid var(--adm-line)", boxShadow: "var(--adm-shadow-sm)" }}
        >

          {/* Cabeçalho da tabela */}
          <div
            className="hidden px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider sm:grid"
            style={{ gridTemplateColumns: GRID, borderBottom: "1px solid var(--adm-line)", color: "var(--adm-text-faint)" }}
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
          <div>
            {clientes.map((cliente, idx) => {
              const hue = getSegmentoHue(cliente.segmento);
              const cadastrado = !!cliente.tenant_id;
              const nomeGrupo = cliente.tenant_id ? tenantMap.get(cliente.tenant_id) : null;
              return (
                <Link
                  key={cliente.id}
                  href={`/admin/clientes/${cliente.id}`}
                  className="adm-row group hidden items-center px-4 py-3 sm:grid"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: idx === 0 ? "none" : "1px solid var(--adm-line)",
                    borderLeft: `3px solid ${cadastrado ? "var(--adm-signal)" : hue}`,
                  }}
                >
                  {/* Código */}
                  <span className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {cliente.codigo_externo ?? "—"}
                  </span>

                  {/* Nome */}
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                      {cliente.nome_fantasia || cliente.razao_social}
                    </p>
                    <p className="adm-mono mt-0.5 truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>
                      {cliente.cnpj_cpf || cliente.razao_social}
                    </p>
                  </div>

                  {/* Segmento */}
                  <div className="flex items-center pr-3">
                    {cliente.segmento ? (
                      <span
                        className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: `${hue}22`, color: hue }}
                      >
                        {cliente.segmento}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--adm-text-faint)" }}>—</span>
                    )}
                  </div>

                  {/* Cidade */}
                  <span className="truncate pr-3 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                    {cliente.cidade ?? "—"}
                  </span>

                  {/* Grupo */}
                  <div className="pr-3">
                    {nomeGrupo ? (
                      <span className="block truncate text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
                        {nomeGrupo}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--adm-text-faint)" }}>—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    {cadastrado ? (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: "var(--adm-signal-soft)", color: "var(--adm-signal)" }}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--adm-signal)" }} />
                        Cadastrado
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--adm-warn-soft)", color: "var(--adm-warn)" }}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--adm-warn)" }} />
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Seta */}
                  <div className="flex items-center justify-end">
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Versão mobile */}
          <div className="sm:hidden">
            {clientes.map((cliente, idx) => {
              const hue = getSegmentoHue(cliente.segmento);
              const cadastrado = !!cliente.tenant_id;
              return (
                <Link
                  key={`mob-${cliente.id}`}
                  href={`/admin/clientes/${cliente.id}`}
                  className="adm-row flex items-center gap-3 px-4 py-3"
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid var(--adm-line)",
                    borderLeft: `3px solid ${cadastrado ? "var(--adm-signal)" : hue}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                      {cliente.nome_fantasia || cliente.razao_social}
                    </p>
                    <p className="adm-mono mt-0.5 truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>{cliente.cnpj_cpf}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="adm-mono" style={{ color: "var(--adm-text-faint)" }}>
            {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg px-3 py-1.5 transition-colors"
                style={{ color: "var(--adm-text-dim)", border: "1px solid var(--adm-line-strong)" }}
              >
                ← Anterior
              </Link>
            )}
            <span className="adm-mono px-3 py-1.5" style={{ color: "var(--adm-text-dim)" }}>
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg px-3 py-1.5 transition-colors"
                style={{ color: "var(--adm-text-dim)", border: "1px solid var(--adm-line-strong)" }}
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

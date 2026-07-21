export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Tag } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { getTenantByIdAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type InventarioRow = { invId: number; data: string; obs: string };
type TipoAtendRow  = {
  tatId: number; tatDesc: string;
  tatCorDestaqueTexto: string; tatCorDestaqueFundo: string;
  tatProGeraFinanceiro: number;
};

type LojaData = {
  id: string;
  name: string;
  empId: number;
  bridgeConfigurada: boolean;
  inventarios: InventarioRow[];
  inventario_id_base: number | null;
  tipos: TipoAtendRow[];
  os_tipos_fiscais: number[];
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OsModuloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok_inv?: string; ok_tipos?: string }>;
}) {
  const { id: tenantId } = await params;
  const { erro, ok_inv, ok_tipos } = await searchParams;

  const tenant = await getTenantByIdAdmin(tenantId);
  if (!tenant) notFound();

  const supabaseAdmin = createAdminClient();

  const { data: lojasRaw } = await supabaseAdmin
    .from("lojas")
    .select("id, name, emp_id, sql_bridge_url, sql_bridge_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  const lojas = (lojasRaw as Record<string, unknown>[] | null) ?? [];

  const lojasData: LojaData[] = await Promise.all(
    lojas.map(async (loja) => {
      const lojaId    = loja.id as string;
      const lojaEmpId = loja.emp_id as number;

      const { data: cfgRows } = await supabaseAdmin
        .from("integration_configs")
        .select("inventario_id_base, os_tipos_fiscais")
        .eq("loja_id", lojaId)
        .limit(1);

      const cfgRow = ((cfgRows as Record<string, unknown>[] | null)?.[0]) ?? null;
      const rawInvId = cfgRow?.inventario_id_base;
      const inventario_id_base = rawInvId != null ? Number(rawInvId) : null;
      const os_tipos_fiscais: number[] = Array.isArray(cfgRow?.os_tipos_fiscais)
        ? (cfgRow.os_tipos_fiscais as unknown[]).map(Number)
        : [];

      let inventarios: InventarioRow[] = [];
      let tipos: TipoAtendRow[]        = [];

      if (loja.sql_bridge_url && loja.sql_bridge_token) {
        const bridge = {
          url: loja.sql_bridge_url as string,
          token: decrypt(loja.sql_bridge_token as string),
        };
        const empId = lojaEmpId;
        try {
          const [invRows, tipoRows] = await Promise.all([
            queryBridge<InventarioRow>(
              bridge, resolveNamedQuery("LIST_INVENTORIES", { empId }).sql, { empId },
            ),
            queryBridge<TipoAtendRow>(
              bridge, resolveNamedQuery("LIST_TIPOS_ATENDIMENTO", {}).sql, {},
            ),
          ]);
          inventarios = invRows.map((r) => ({
            invId: Number(r.invId), data: r.data ?? "", obs: r.obs ?? "",
          }));
          tipos = tipoRows.map((r) => ({
            tatId: Number(r.tatId),
            tatDesc: r.tatDesc ?? "",
            tatCorDestaqueTexto: r.tatCorDestaqueTexto ?? "",
            tatCorDestaqueFundo: r.tatCorDestaqueFundo ?? "",
            tatProGeraFinanceiro: Number(r.tatProGeraFinanceiro ?? 0),
          }));
        } catch {
          // bridge offline ou não configurada
        }
      }

      return {
        id: lojaId,
        name: loja.name as string,
        empId: lojaEmpId,
        bridgeConfigurada: !!(loja.sql_bridge_url && loja.sql_bridge_token),
        inventarios,
        inventario_id_base,
        tipos,
        os_tipos_fiscais,
      };
    }),
  );

  // ── Server Actions ─────────────────────────────────────────────────────────

  async function salvarInventario(formData: FormData) {
    "use server";
    const loja_id = formData.get("loja_id") as string;
    const invIdRaw = (formData.get("inventario_id_base") as string | null)?.trim();
    const inventario_id_base = invIdRaw && invIdRaw !== "0" ? parseInt(invIdRaw, 10) : null;

    const admin = createAdminClient();
    // Lê os_tipos_fiscais existente para não sobrescrever no upsert (limit(1) tolera duplicatas)
    const { data: rows1 } = await admin
      .from("integration_configs")
      .select("os_tipos_fiscais")
      .eq("loja_id", loja_id)
      .limit(1);
    const os_tipos_fiscais = (rows1 as Record<string, unknown>[] | null)?.[0]?.os_tipos_fiscais ?? [];

    const { error } = await admin
      .from("integration_configs")
      .upsert({ loja_id, inventario_id_base, os_tipos_fiscais }, { onConflict: "loja_id" });

    if (error) {
      const msg = error.message.includes("inventario_id_base")
        ? "Coluna inventario_id_base não existe. Execute a migration SQL no Supabase antes de continuar."
        : error.message;
      redirect(`/admin/empresas/${tenantId}/modulo-os?erro=${encodeURIComponent(msg)}`);
    }
    redirect(`/admin/empresas/${tenantId}/modulo-os?ok_inv=${loja_id}`);
  }

  async function salvarTiposFiscais(formData: FormData) {
    "use server";
    const loja_id = formData.get("loja_id") as string;
    const tatIdsRaw = formData.getAll("tatIds") as string[];
    const os_tipos_fiscais = tatIdsRaw.map(Number).filter((n) => !isNaN(n) && n > 0);

    const admin = createAdminClient();
    // Lê inventario_id_base existente para não sobrescrever no upsert (limit(1) tolera duplicatas)
    const { data: rows2 } = await admin
      .from("integration_configs")
      .select("inventario_id_base")
      .eq("loja_id", loja_id)
      .limit(1);
    const inventario_id_base = (rows2 as Record<string, unknown>[] | null)?.[0]?.inventario_id_base ?? null;

    const { error } = await admin
      .from("integration_configs")
      .upsert({ loja_id, inventario_id_base, os_tipos_fiscais }, { onConflict: "loja_id" });

    if (error) {
      const msg = error.message.includes("os_tipos_fiscais")
        ? "Coluna os_tipos_fiscais não existe. Execute a migration 20260617_os_tipos_fiscais.sql antes de continuar."
        : error.message;
      redirect(`/admin/empresas/${tenantId}/modulo-os?erro=${encodeURIComponent(msg)}`);
    }
    redirect(`/admin/empresas/${tenantId}/modulo-os?ok_tipos=${loja_id}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="adm-rise max-w-3xl space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/empresas/${tenantId}?aba=features`}
          className="adm-focusable flex items-center gap-1.5 rounded text-sm transition-colors"
          style={{ color: "var(--adm-text-dim)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Módulos
        </Link>
        <span style={{ color: "var(--adm-line-strong)" }}>/</span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>Configurações — Ordens de Serviço</h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>{tenant.name}</p>
        </div>
      </div>

      {/* Feedback */}
      {erro && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}>
          <strong>Erro:</strong> {erro}
        </div>
      )}
      {ok_inv && !erro && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)", color: "var(--adm-signal)" }}>
          Inventário base fiscal salvo com sucesso.
        </div>
      )}
      {ok_tipos && !erro && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)", color: "var(--adm-signal)" }}>
          Tipos de atendimento fiscais salvos com sucesso.
        </div>
      )}

      {lojasData.length === 0 && (
        <AdminCard className="p-6">
          <AdminEmptyState icon={BookOpen} title="Nenhuma loja ativa encontrada para esta empresa." />
        </AdminCard>
      )}

      {lojasData.map((loja) => (
        <AdminCard key={loja.id} className="overflow-hidden p-0">
        <details open className="group">
          <summary
            className="flex cursor-pointer list-none items-center justify-between px-6 py-4 select-none"
          >
            <div>
              <p className="font-semibold" style={{ color: "var(--adm-text)" }}>{loja.name}</p>
              <p className="adm-mono mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>empId: {loja.empId}</p>
            </div>
            <div className="flex items-center gap-3">
              {loja.os_tipos_fiscais.length > 0 && (
                <AdminBadge variant="neutral">
                  {loja.os_tipos_fiscais.length} tipo{loja.os_tipos_fiscais.length !== 1 ? "s" : ""} fiscal{loja.os_tipos_fiscais.length !== 1 ? "is" : ""}
                </AdminBadge>
              )}
              {loja.inventario_id_base != null && (
                <AdminBadge variant="neutral">inv #{loja.inventario_id_base}</AdminBadge>
              )}
              <svg className="h-4 w-4 transition-transform group-open:rotate-180" style={{ color: "var(--adm-text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>

          <div className="space-y-8 px-6 pb-6 pt-5" style={{ borderTop: "1px solid var(--adm-line)" }}>

            {/* Inventário Base Fiscal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Inventário Base Fiscal</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--adm-text-dim)" }}>
                Ponto de partida para o cálculo de estoque fiscal. As movimentações de NF são
                acumuladas a partir da data deste inventário.
              </p>

              {!loja.bridgeConfigurada ? (
                <div className="rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
                  <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    Bridge SQL não configurada.{" "}
                    <Link href={`/admin/empresas/${tenantId}?aba=lojas`} className="adm-focusable rounded underline" style={{ color: "var(--adm-accent)" }}>
                      Configurar bridge
                    </Link>
                  </p>
                </div>
              ) : loja.inventarios.length === 0 ? (
                <div className="rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
                  <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Nenhum inventário encontrado.</p>
                </div>
              ) : (
                <form action={salvarInventario} className="flex items-end gap-3">
                  <input type="hidden" name="loja_id" value={loja.id} />
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>Inventário selecionado</label>
                    <select
                      name="inventario_id_base"
                      defaultValue={loja.inventario_id_base != null ? String(loja.inventario_id_base) : "0"}
                      className="adm-field adm-focusable w-full px-3 py-2 text-sm"
                    >
                      <option value="0">— Nenhum —</option>
                      {loja.inventarios.map((inv) => (
                        <option key={inv.invId} value={String(inv.invId)}>
                          #{inv.invId} — {inv.data}
                          {inv.obs ? ` — ${inv.obs.slice(0, 55)}${inv.obs.length > 55 ? "…" : ""}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AdminButton type="submit" size="sm" className="shrink-0">
                    Salvar
                  </AdminButton>
                </form>
              )}
            </div>

            {/* Tipos de Atendimento — Movimentação Fiscal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Tipos de Atendimento — Movimentação Fiscal</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--adm-text-dim)" }}>
                Quando um produto é incluído em uma O.S com um dos tipos marcados abaixo, ele
                entra imediatamente no cálculo de estoque fiscal.
              </p>

              {!loja.bridgeConfigurada ? (
                <div className="rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
                  <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Bridge SQL não configurada.</p>
                </div>
              ) : loja.tipos.length === 0 ? (
                <div className="rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
                  <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Nenhum tipo de atendimento encontrado.</p>
                </div>
              ) : (
                <form action={salvarTiposFiscais} className="space-y-4">
                  <input type="hidden" name="loja_id" value={loja.id} />
                  <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--adm-line)" }}>
                    {loja.tipos.map((tipo, i) => {
                      const corHex = tipo.tatCorDestaqueTexto ? `#${tipo.tatCorDestaqueTexto}` : "#64748b";
                      const isChecked = loja.os_tipos_fiscais.includes(tipo.tatId);
                      return (
                        <label
                          key={tipo.tatId}
                          className="adm-row flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
                          style={{ borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}
                        >
                          <input
                            type="checkbox" name="tatIds" value={String(tipo.tatId)}
                            defaultChecked={isChecked}
                            className="adm-focusable h-4 w-4 rounded"
                            style={{ accentColor: "var(--adm-accent)" }}
                          />
                          <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: corHex + "33", borderColor: corHex }} />
                          <span className="flex-1 text-sm" style={{ color: "var(--adm-text)" }}>{tipo.tatDesc}</span>
                          {tipo.tatProGeraFinanceiro === 1 && (
                            <span className="shrink-0">
                              <AdminBadge variant="neutral">gera financeiro</AdminBadge>
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <AdminButton type="submit" size="sm">
                      Salvar tipos
                    </AdminButton>
                  </div>
                </form>
              )}
            </div>
          </div>
        </details>
        </AdminCard>
      ))}
    </div>
  );
}

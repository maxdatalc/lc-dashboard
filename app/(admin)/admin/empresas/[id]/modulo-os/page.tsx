export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Tag } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { getTenantByIdAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

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

      const { data: cfg } = await supabaseAdmin
        .from("integration_configs")
        .select("inventario_id_base, os_tipos_fiscais")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const cfgRow = cfg as Record<string, unknown> | null;
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
    const inventario_id_base = invIdRaw ? parseInt(invIdRaw, 10) : null;

    const admin = createAdminClient();
    const { error } = await admin
      .from("integration_configs")
      .upsert({ loja_id, inventario_id_base }, { onConflict: "loja_id" });

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
    const { error } = await admin
      .from("integration_configs")
      .upsert({ loja_id, os_tipos_fiscais }, { onConflict: "loja_id" });

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
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/empresas/${tenantId}?aba=features`}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Módulos
        </Link>
        <span className="text-slate-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Configurações — Ordens de Serviço</h1>
          <p className="text-xs text-slate-400 mt-0.5">{tenant.name}</p>
        </div>
      </div>

      {/* Feedback */}
      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Erro:</strong> {erro}
        </div>
      )}
      {ok_inv && !erro && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Inventário base fiscal salvo com sucesso.
        </div>
      )}
      {ok_tipos && !erro && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Tipos de atendimento fiscais salvos com sucesso.
        </div>
      )}

      {lojasData.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma loja ativa encontrada para esta empresa.
        </div>
      )}

      {lojasData.map((loja) => (
        <details key={loja.id} open className="group rounded-xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 select-none list-none">
            <div>
              <p className="font-semibold text-slate-800">{loja.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">empId: {loja.empId}</p>
            </div>
            <div className="flex items-center gap-3">
              {loja.os_tipos_fiscais.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {loja.os_tipos_fiscais.length} tipo{loja.os_tipos_fiscais.length !== 1 ? "s" : ""} fiscal{loja.os_tipos_fiscais.length !== 1 ? "is" : ""}
                </span>
              )}
              {loja.inventario_id_base != null && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  inv #{loja.inventario_id_base}
                </span>
              )}
              <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>

          <div className="border-t border-slate-100 px-6 pb-6 pt-5 space-y-8">

            {/* Inventário Base Fiscal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Inventário Base Fiscal</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ponto de partida para o cálculo de estoque fiscal. As movimentações de NF são
                acumuladas a partir da data deste inventário.
              </p>

              {!loja.bridgeConfigurada ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">
                    Bridge SQL não configurada.{" "}
                    <Link href={`/admin/empresas/${tenantId}?aba=lojas`} className="underline hover:text-slate-600">
                      Configurar bridge
                    </Link>
                  </p>
                </div>
              ) : loja.inventarios.length === 0 ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Nenhum inventário encontrado.</p>
                </div>
              ) : (
                <form action={salvarInventario} className="flex items-end gap-3">
                  <input type="hidden" name="loja_id" value={loja.id} />
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-slate-600">Inventário selecionado</label>
                    <select
                      name="inventario_id_base"
                      defaultValue={loja.inventario_id_base != null ? String(loja.inventario_id_base) : "0"}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
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
                  <button type="submit" className="shrink-0 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
                    Salvar
                  </button>
                </form>
              )}
            </div>

            {/* Tipos de Atendimento — Movimentação Fiscal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Tipos de Atendimento — Movimentação Fiscal</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Quando um produto é incluído em uma O.S com um dos tipos marcados abaixo, ele
                entra imediatamente no cálculo de estoque fiscal.
              </p>

              {!loja.bridgeConfigurada ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Bridge SQL não configurada.</p>
                </div>
              ) : loja.tipos.length === 0 ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Nenhum tipo de atendimento encontrado.</p>
                </div>
              ) : (
                <form action={salvarTiposFiscais} className="space-y-4">
                  <input type="hidden" name="loja_id" value={loja.id} />
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {loja.tipos.map((tipo) => {
                      const corHex = tipo.tatCorDestaqueTexto ? `#${tipo.tatCorDestaqueTexto}` : "#64748b";
                      const isChecked = loja.os_tipos_fiscais.includes(tipo.tatId);
                      return (
                        <label key={tipo.tatId} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox" name="tatIds" value={String(tipo.tatId)}
                            defaultChecked={isChecked}
                            className="h-4 w-4 rounded border-slate-300 text-slate-800 accent-slate-800"
                          />
                          <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: corHex + "33", borderColor: corHex }} />
                          <span className="flex-1 text-sm text-slate-700">{tipo.tatDesc}</span>
                          {tipo.tatProGeraFinanceiro === 1 && (
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">gera financeiro</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
                      Salvar tipos
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

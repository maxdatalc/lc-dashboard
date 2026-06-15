export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { getTenantByIdAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

type InventarioRow = { invId: number; data: string; obs: string };

type LojaData = {
  id: string;
  name: string;
  empId: number;
  bridgeConfigurada: boolean;
  inventarios: InventarioRow[];
  inventario_id_base: number | null;
};

export default async function OsModuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;

  const tenant = await getTenantByIdAdmin(tenantId);
  if (!tenant) notFound();

  const supabaseAdmin = createAdminClient();

  // Lojas da empresa com credenciais da bridge
  const { data: lojasRaw } = await supabaseAdmin
    .from("lojas")
    .select("id, name, emp_id, sql_bridge_url, sql_bridge_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  const lojas = lojasRaw as Record<string, unknown>[] | null ?? [];

  // Para cada loja: inventários via bridge + inventario_id_base configurado
  const lojasData: LojaData[] = await Promise.all(
    lojas.map(async (loja) => {
      const lojaId = loja.id as string;

      const { data: cfg } = await supabaseAdmin
        .from("integration_configs")
        .select("inventario_id_base")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const cfgRow = cfg as Record<string, unknown> | null;
      const inventario_id_base = cfgRow?.inventario_id_base
        ? Number(cfgRow.inventario_id_base)
        : null;

      let inventarios: InventarioRow[] = [];
      if (loja.sql_bridge_url && loja.sql_bridge_token) {
        try {
          const { sql, params: qp } = resolveNamedQuery("LIST_INVENTORIES", {
            empId: loja.emp_id as number,
          });
          const rows = await queryBridge<InventarioRow>(
            {
              url: loja.sql_bridge_url as string,
              token: decrypt(loja.sql_bridge_token as string),
            },
            sql,
            qp,
          );
          inventarios = rows.map((r) => ({
            invId: Number(r.invId),
            data: r.data ?? "",
            obs: r.obs ?? "",
          }));
        } catch {
          // bridge offline ou não configurada
        }
      }

      return {
        id: lojaId,
        name: loja.name as string,
        empId: loja.emp_id as number,
        bridgeConfigurada: !!(loja.sql_bridge_url && loja.sql_bridge_token),
        inventarios,
        inventario_id_base,
      };
    }),
  );

  // Server action — salva inventario_id_base para a loja enviada no form
  async function salvarInventario(formData: FormData) {
    "use server";
    const loja_id = formData.get("loja_id") as string;
    const invIdRaw = (formData.get("inventario_id_base") as string | null)?.trim();
    const inventario_id_base = invIdRaw ? parseInt(invIdRaw, 10) : null;

    const admin = createAdminClient();
    await admin
      .from("integration_configs")
      .upsert({ loja_id, inventario_id_base }, { onConflict: "loja_id" });

    redirect(`/admin/empresas/${tenantId}/modulo-os`);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
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
          <h1 className="text-xl font-bold text-slate-900">
            Configurações — Ordens de Serviço
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{tenant.name}</p>
        </div>
      </div>

      {lojasData.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma loja ativa encontrada para esta empresa.
        </div>
      )}

      {lojasData.map((loja) => (
        <section
          key={loja.id}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          {/* Cabeçalho da loja */}
          <div>
            <p className="font-semibold text-slate-800">{loja.name}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              empId: {loja.empId}
            </p>
          </div>

          {/* Inventário base fiscal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                Inventário Base Fiscal
              </p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ponto de partida para o cálculo de estoque fiscal. As movimentações
              de NF são acumuladas a partir da data deste inventário. Selecione o
              inventário importado da planilha contábil (geralmente o de
              31/12/XXXX).
            </p>

            {!loja.bridgeConfigurada ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Bridge SQL não configurada para esta loja.{" "}
                  <Link
                    href={`/admin/empresas/${tenantId}?aba=lojas`}
                    className="underline hover:text-slate-600"
                  >
                    Configurar bridge
                  </Link>
                </p>
              </div>
            ) : loja.inventarios.length === 0 ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Bridge configurada, mas nenhum inventário encontrado (bridge
                  pode estar offline).
                </p>
              </div>
            ) : (
              <form action={salvarInventario} className="flex items-end gap-3">
                <input type="hidden" name="loja_id" value={loja.id} />
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Inventário selecionado
                  </label>
                  <select
                    name="inventario_id_base"
                    defaultValue={
                      loja.inventario_id_base
                        ? String(loja.inventario_id_base)
                        : ""
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">
                      — Automático (mais recente não suspenso) —
                    </option>
                    {loja.inventarios.map((inv) => (
                      <option key={inv.invId} value={String(inv.invId)}>
                        #{inv.invId} — {inv.data}
                        {inv.obs
                          ? ` — ${inv.obs.slice(0, 55)}${inv.obs.length > 55 ? "…" : ""}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="shrink-0 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  Salvar
                </button>
              </form>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

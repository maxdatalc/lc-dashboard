export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Tag, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { getTenantByIdAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

// ── Tipos ────────────────────────────────────────────────────────────────────

type InventarioRow  = { invId: number; data: string; obs: string };
type TipoAtendRow   = {
  tatId: number; tatDesc: string;
  tatCorDestaqueTexto: string; tatCorDestaqueFundo: string;
  tatProGeraFinanceiro: number;
};
type ErpUserRow     = { cliId: number; cliNome: string; cliUsu: string };
type UserMapping    = {
  cli_id: number;
  email: string | null;
  supabase_user_id: string | null;
  tipos_bloqueados: number[];
};

type LojaData = {
  id: string;
  name: string;
  empId: number;
  tenantId: string;
  bridgeConfigurada: boolean;
  inventarios: InventarioRow[];
  inventario_id_base: number | null;
  tipos: TipoAtendRow[];
  os_tipos_fiscais: number[];
  erpUsers: ErpUserRow[];
  mappings: UserMapping[];
};

type AbaModulo = "config" | "usuarios";

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OsModuloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; erro?: string; ok_inv?: string; ok_tipos?: string; ok_user?: string }>;
}) {
  const { id: tenantId } = await params;
  const { tab, erro, ok_inv, ok_tipos, ok_user } = await searchParams;

  const abaAtiva: AbaModulo = tab === "usuarios" ? "usuarios" : "config";

  const tenant = await getTenantByIdAdmin(tenantId);
  if (!tenant) notFound();

  const supabaseAdmin = createAdminClient();

  const { data: lojasRaw } = await supabaseAdmin
    .from("lojas")
    .select("id, name, emp_id, tenant_id, sql_bridge_url, sql_bridge_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  const lojas = (lojasRaw as Record<string, unknown>[] | null) ?? [];

  const lojasData: LojaData[] = await Promise.all(
    lojas.map(async (loja) => {
      const lojaId   = loja.id as string;
      const lojaEmpId = loja.emp_id as number;
      const lojaTenantId = loja.tenant_id as string;

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
      let erpUsers: ErpUserRow[]       = [];
      let mappings: UserMapping[]      = [];

      if (loja.sql_bridge_url && loja.sql_bridge_token) {
        const bridge = {
          url: loja.sql_bridge_url as string,
          token: decrypt(loja.sql_bridge_token as string),
        };
        const empId = lojaEmpId;

        try {
          if (abaAtiva === "config") {
            const [invRows, tipoRows] = await Promise.all([
              queryBridge<InventarioRow>(
                bridge,
                resolveNamedQuery("LIST_INVENTORIES", { empId }).sql,
                { empId },
              ),
              queryBridge<TipoAtendRow>(
                bridge,
                resolveNamedQuery("LIST_TIPOS_ATENDIMENTO", {}).sql,
                {},
              ),
            ]);
            inventarios = invRows.map((r) => ({
              invId: Number(r.invId),
              data: r.data ?? "",
              obs: r.obs ?? "",
            }));
            tipos = tipoRows.map((r) => ({
              tatId: Number(r.tatId),
              tatDesc: r.tatDesc ?? "",
              tatCorDestaqueTexto: r.tatCorDestaqueTexto ?? "",
              tatCorDestaqueFundo: r.tatCorDestaqueFundo ?? "",
              tatProGeraFinanceiro: Number(r.tatProGeraFinanceiro ?? 0),
            }));
          } else {
            // usuarios tab: load tipos (for blocked checkboxes) + erp users
            const [tipoRows, erpRows] = await Promise.all([
              queryBridge<TipoAtendRow>(
                bridge,
                resolveNamedQuery("LIST_TIPOS_ATENDIMENTO", {}).sql,
                {},
              ),
              queryBridge<ErpUserRow>(
                bridge,
                resolveNamedQuery("LIST_ERP_USERS", { empId }).sql,
                { empId },
              ),
            ]);
            tipos = tipoRows.map((r) => ({
              tatId: Number(r.tatId),
              tatDesc: r.tatDesc ?? "",
              tatCorDestaqueTexto: r.tatCorDestaqueTexto ?? "",
              tatCorDestaqueFundo: r.tatCorDestaqueFundo ?? "",
              tatProGeraFinanceiro: Number(r.tatProGeraFinanceiro ?? 0),
            }));
            erpUsers = erpRows.map((r) => ({
              cliId: Number(r.cliId),
              cliNome: r.cliNome ?? "",
              cliUsu: r.cliUsu ?? "",
            }));

            // Load Supabase mappings for this loja
            const { data: mapRows } = await supabaseAdmin
              .from("loja_usuarios_erp")
              .select("cli_id, email, supabase_user_id, tipos_bloqueados")
              .eq("loja_id", lojaId);

            mappings = ((mapRows as Record<string, unknown>[] | null) ?? []).map((m) => ({
              cli_id: Number(m.cli_id),
              email: (m.email as string) ?? null,
              supabase_user_id: (m.supabase_user_id as string) ?? null,
              tipos_bloqueados: Array.isArray(m.tipos_bloqueados)
                ? (m.tipos_bloqueados as unknown[]).map(Number)
                : [],
            }));
          }
        } catch {
          // bridge offline ou não configurada
        }
      }

      return {
        id: lojaId,
        name: loja.name as string,
        empId: lojaEmpId,
        tenantId: lojaTenantId,
        bridgeConfigurada: !!(loja.sql_bridge_url && loja.sql_bridge_token),
        inventarios,
        inventario_id_base,
        tipos,
        os_tipos_fiscais,
        erpUsers,
        mappings,
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
        ? "Coluna os_tipos_fiscais não existe. Execute a migration supabase/migrations/20260617_os_tipos_fiscais.sql antes de continuar."
        : error.message;
      redirect(`/admin/empresas/${tenantId}/modulo-os?erro=${encodeURIComponent(msg)}`);
    }
    redirect(`/admin/empresas/${tenantId}/modulo-os?ok_tipos=${loja_id}`);
  }

  async function salvarUsuarioErp(formData: FormData) {
    "use server";
    const loja_id   = formData.get("loja_id") as string;
    const cli_id    = parseInt(formData.get("cli_id") as string, 10);
    const cli_nome  = (formData.get("cli_nome") as string) ?? "";
    const cli_usu   = (formData.get("cli_usu") as string) ?? "";
    const email     = ((formData.get("email") as string) ?? "").trim();
    const senha     = ((formData.get("senha") as string) ?? "").trim();
    const tatIdsRaw = formData.getAll("tatIds_block") as string[];
    const tipos_bloqueados = tatIdsRaw.map(Number).filter((n) => !isNaN(n) && n > 0);

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("loja_usuarios_erp")
      .select("supabase_user_id, email")
      .eq("loja_id", loja_id)
      .eq("cli_id", cli_id)
      .maybeSingle();

    const existingRow = existing as Record<string, unknown> | null;
    let supabase_user_id: string | null = (existingRow?.supabase_user_id as string) ?? null;

    if (email) {
      if (supabase_user_id) {
        const updatePayload: { email: string; password?: string } = { email };
        if (senha) updatePayload.password = senha;
        const { error } = await admin.auth.admin.updateUserById(supabase_user_id, updatePayload);
        if (error) {
          redirect(
            `/admin/empresas/${tenantId}/modulo-os?tab=usuarios&erro=${encodeURIComponent(error.message)}`,
          );
        }
      } else {
        if (!senha) {
          redirect(
            `/admin/empresas/${tenantId}/modulo-os?tab=usuarios&erro=${encodeURIComponent("Senha obrigatória para criar novo usuário")}`,
          );
        }

        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
        });

        if (authError) {
          redirect(
            `/admin/empresas/${tenantId}/modulo-os?tab=usuarios&erro=${encodeURIComponent(authError.message)}`,
          );
        }

        supabase_user_id = authData.user.id;

        const { data: lojaRow } = await admin
          .from("lojas")
          .select("tenant_id")
          .eq("id", loja_id)
          .maybeSingle();

        const tenant_id = (lojaRow as Record<string, unknown> | null)?.tenant_id as string | null;
        if (tenant_id) {
          await admin.from("tenant_users").upsert(
            { tenant_id, user_id: supabase_user_id, role: "viewer" },
            { onConflict: "tenant_id,user_id" },
          );
        }
      }
    }

    const { error: upsertError } = await admin
      .from("loja_usuarios_erp")
      .upsert(
        {
          loja_id,
          cli_id,
          cli_nome,
          cli_usu,
          supabase_user_id,
          email: email || null,
          tipos_bloqueados,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "loja_id,cli_id" },
      );

    if (upsertError) {
      redirect(
        `/admin/empresas/${tenantId}/modulo-os?tab=usuarios&erro=${encodeURIComponent(upsertError.message)}`,
      );
    }

    redirect(`/admin/empresas/${tenantId}/modulo-os?tab=usuarios&ok_user=${cli_id}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const ABAS: { valor: AbaModulo; label: string; icon: ReactNode }[] = [
    { valor: "config",   label: "Configurações", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { valor: "usuarios", label: "Usuários",       icon: <Users    className="h-3.5 w-3.5" /> },
  ];

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
          <h1 className="text-xl font-bold text-slate-900">
            Configurações — Ordens de Serviço
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{tenant.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/admin/empresas/${tenantId}/modulo-os?tab=${a.valor}`}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === a.valor
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
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
      {ok_user && !erro && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Usuário ERP salvo com sucesso.
        </div>
      )}

      {lojasData.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma loja ativa encontrada para esta empresa.
        </div>
      )}

      {/* ── Aba Configurações ─────────────────────────────────────────────── */}
      {abaAtiva === "config" && lojasData.map((loja) => (
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
                acumuladas a partir da data deste inventário. Selecione o inventário importado
                da planilha contábil (geralmente o de 31/12/XXXX).
              </p>

              {!loja.bridgeConfigurada ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">
                    Bridge SQL não configurada para esta loja.{" "}
                    <Link href={`/admin/empresas/${tenantId}?aba=lojas`} className="underline hover:text-slate-600">
                      Configurar bridge
                    </Link>
                  </p>
                </div>
              ) : loja.inventarios.length === 0 ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Bridge configurada, mas nenhum inventário encontrado.</p>
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

      {/* ── Aba Usuários ──────────────────────────────────────────────────── */}
      {abaAtiva === "usuarios" && lojasData.map((loja) => (
        <details key={loja.id} open className="group rounded-xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 select-none list-none">
            <div>
              <p className="font-semibold text-slate-800">{loja.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">empId: {loja.empId}</p>
            </div>
            <div className="flex items-center gap-3">
              {loja.erpUsers.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {loja.erpUsers.length} usuário{loja.erpUsers.length !== 1 ? "s" : ""} ERP
                </span>
              )}
              {loja.mappings.filter((m) => m.supabase_user_id).length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {loja.mappings.filter((m) => m.supabase_user_id).length} vinculado{loja.mappings.filter((m) => m.supabase_user_id).length !== 1 ? "s" : ""}
                </span>
              )}
              <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>

          <div className="border-t border-slate-100 px-6 pb-6 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Usuários ERP</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Vincule cada operador do ERP a um e-mail e senha de acesso ao dashboard.
              Os tipos de atendimento bloqueados por usuário impedem que ele adicione itens
              a O.S com esses tipos.
            </p>

            {!loja.bridgeConfigurada ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Bridge SQL não configurada para esta loja.{" "}
                  <Link href={`/admin/empresas/${tenantId}?aba=lojas`} className="underline hover:text-slate-600">
                    Configurar bridge
                  </Link>
                </p>
              </div>
            ) : loja.erpUsers.length === 0 ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Nenhum usuário ERP encontrado (bridge pode estar offline ou não há usuários com cliUsu).
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {loja.erpUsers.map((user) => {
                  const mapping = loja.mappings.find((m) => m.cli_id === user.cliId);
                  const vinculado = !!mapping?.supabase_user_id;
                  return (
                    <details key={user.cliId} className="group/user">
                      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none list-none hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{user.cliNome}</p>
                          <p className="text-xs text-slate-400 font-mono">{user.cliUsu} · cliId {user.cliId}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {mapping?.email && (
                            <p className="text-xs text-slate-500 hidden sm:block">{mapping.email}</p>
                          )}
                          {vinculado ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">vinculado</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">sem acesso</span>
                          )}
                          {mapping && mapping.tipos_bloqueados.length > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                              {mapping.tipos_bloqueados.length} bloqueio{mapping.tipos_bloqueados.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <svg className="h-4 w-4 text-slate-400 transition-transform group-open/user:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </summary>

                      <form action={salvarUsuarioErp} className="border-t border-slate-100 px-4 pb-4 pt-4 space-y-4 bg-slate-50">
                        <input type="hidden" name="loja_id"  value={loja.id} />
                        <input type="hidden" name="cli_id"   value={String(user.cliId)} />
                        <input type="hidden" name="cli_nome" value={user.cliNome} />
                        <input type="hidden" name="cli_usu"  value={user.cliUsu} />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">E-mail de acesso</label>
                            <input
                              type="email"
                              name="email"
                              defaultValue={mapping?.email ?? ""}
                              placeholder="usuario@empresa.com"
                              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Senha {vinculado ? "(deixe em branco para manter)" : ""}
                            </label>
                            <input
                              type="password"
                              name="senha"
                              placeholder={vinculado ? "••••••••" : "Obrigatória para novo acesso"}
                              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                          </div>
                        </div>

                        {loja.tipos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-600 mb-2">Tipos de atendimento bloqueados</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {loja.tipos.map((tipo) => {
                                const corHex = tipo.tatCorDestaqueTexto ? `#${tipo.tatCorDestaqueTexto}` : "#64748b";
                                const isBlocked = mapping?.tipos_bloqueados.includes(tipo.tatId) ?? false;
                                return (
                                  <label key={tipo.tatId} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-100 cursor-pointer transition-colors">
                                    <input
                                      type="checkbox"
                                      name="tatIds_block"
                                      value={String(tipo.tatId)}
                                      defaultChecked={isBlocked}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 accent-red-600"
                                    />
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: corHex + "33", borderColor: corHex }} />
                                    <span className="text-xs text-slate-700">{tipo.tatDesc}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Tipos marcados impedem este usuário de inserir itens em O.S com esse tipo de atendimento.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
                            Salvar usuário
                          </button>
                        </div>
                      </form>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

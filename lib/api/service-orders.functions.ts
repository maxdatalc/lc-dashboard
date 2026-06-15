"use server";

import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import type { BridgeConfig } from "@/lib/bridge/bridge-client";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import {
  addItemToServiceOrderMaxApi,
  buildMaxApiConfig,
  type MaxApiConfig,
} from "@/lib/maxapi/maxapi-client";
import { validateStockForOsItem } from "@/lib/fiscal/calculate-fiscal-stock";

const ListInput = z.object({
  loja_id: z.string().uuid(),
  cliente: z.string().optional(),
  placa: z.string().optional(),
  status: z.string().optional(),
});

const DetailInput = z.object({
  loja_id: z.string().uuid(),
  os_id: z.string(),
});

const AddItemInput = z.object({
  loja_id: z.string().uuid(),
  os_id: z.string(),
  produto_id: z.string(),
  quantidade: z.number().min(1),
  valor_unitario: z.number().min(0),
  tipo: z.string().optional().default("P"),
  cfop: z.number().optional(),
  tecnico_id: z.number().optional(),
  forcar_sem_fiscal: z.boolean().optional().default(false),
});

interface OsListRow {
  vedId: number;
  clienteNome: string | null;
  placa: string | null;
  status: string;
  dataAbertura: string | null;
  obs: string | null;
  defeito: string | null;
  equipamento: string | null;
  marca: string | null;
}

interface OsDetailRow {
  vedId: number;
  clienteId: number | null;
  clienteNome: string | null;
  placa: string | null;
  status: string;
  dataAbertura: string | null;
  obs: string | null;
  defeito: string | null;
  equipamento: string | null;
  marca: string | null;
  laudoTec: string | null;
}

interface OsItemRow {
  itemId: number;
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proUn: string;
  qtde: number;
  precoUnitario: number;
  totalItem: number;
  cancelado: number;
}

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { userId: user.id, supabase };
}

async function getLojaConfig(lojaId: string) {
  const supabaseAdmin = createAdminClient();

  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select(
        "emp_id, terminal_maxdata, tenant_id, name, is_active, sql_bridge_url, sql_bridge_token",
      )
      .eq("id", lojaId)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("maxapi_url")
      .eq("loja_id", lojaId)
      .maybeSingle(),
  ]);

  const lojaRow = loja as Record<string, unknown> | null;
  if (!lojaRow) throw new Error("Loja não encontrada");
  if (!lojaRow.sql_bridge_url || !lojaRow.sql_bridge_token)
    throw new Error("Bridge SQL não configurada para esta loja");

  const bridge: BridgeConfig = {
    url: lojaRow.sql_bridge_url as string,
    token: decrypt(lojaRow.sql_bridge_token as string),
  };
  const empId = lojaRow.emp_id as number;

  let maxApi: MaxApiConfig | null = null;
  const cfgRow = cfg as Record<string, unknown> | null;
  if (cfgRow?.maxapi_url) {
    maxApi = buildMaxApiConfig(
      {
        emp_id_maxdata: String(lojaRow.emp_id),
        terminal_maxdata: (lojaRow.terminal_maxdata as string | null) ?? "1",
      },
      { maxapi_url: cfgRow.maxapi_url as string },
    );
  }

  return { loja: lojaRow, bridge, empId, maxApi };
}

async function logAuditoria(
  opts: {
    userId: string;
    tenant_id?: string | null;
    loja_id?: string | null;
    acao: string;
    entidade?: string;
    entidade_id?: string;
    detalhes?: unknown;
  },
) {
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from("fs_audit_logs").insert({
    user_id: opts.userId,
    tenant_id: opts.tenant_id ?? null,
    loja_id: opts.loja_id ?? null,
    acao: opts.acao,
    entidade: opts.entidade ?? null,
    entidade_id: opts.entidade_id ?? null,
    detalhes_json: (opts.detalhes ?? null) as never,
  });
}

function vedStatusToDisplay(s: string): string {
  if (s === "F") return "faturada";
  if (s === "C") return "cancelada";
  return "aberta";
}

function displayToVedStatus(s: string): string {
  if (s === "faturada" || s === "finalizada") return "F";
  if (s === "cancelada") return "C";
  if (s === "aberta" || s === "pendente") return "A";
  return "";
}

export async function listServiceOrders(input: unknown) {
  const data = ListInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canAccess } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: data.loja_id,
  });
  if (!canAccess) throw new Error("Acesso negado a esta loja");

  const { bridge, empId } = await getLojaConfig(data.loja_id);

  const { sql, params } = resolveNamedQuery("LIST_SERVICE_ORDERS", {
    empId,
    statusFilter:
      data.status && data.status !== "todas" ? displayToVedStatus(data.status) : "",
    clienteNome: data.cliente ? `%${data.cliente}%` : "",
  });

  const rows = await queryBridge<OsListRow>(bridge, sql, params);

  return rows.map((o) => ({
    id: String(o.vedId),
    numero: String(o.vedId),
    cliente: o.clienteNome ?? "",
    placa: o.placa ?? "",
    status: vedStatusToDisplay(o.status),
    statusOs: o.status,
    dataAbertura: o.dataAbertura,
    totalNf: 0,
    valorTotalProduto: 0,
    valorTotalServico: 0,
    obs: o.obs ?? "",
    defeito: o.defeito ?? "",
    equipamento: o.equipamento ?? "",
    marca: o.marca ?? "",
  }));
}

export async function getServiceOrderDetail(input: unknown) {
  const data = DetailInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canAccess } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: data.loja_id,
  });
  if (!canAccess) throw new Error("Acesso negado a esta loja");

  const { bridge, empId } = await getLojaConfig(data.loja_id);
  const osId = parseInt(data.os_id, 10);
  if (isNaN(osId)) throw new Error("os_id inválido");

  const { sql, params } = resolveNamedQuery("GET_SERVICE_ORDER_DETAIL", { empId, osId });
  const rows = await queryBridge<OsDetailRow>(bridge, sql, params);
  if (!rows[0]) throw new Error("Ordem de serviço não encontrada");

  const o = rows[0];
  return {
    id: String(o.vedId),
    numero: String(o.vedId),
    clienteId: o.clienteId ? String(o.clienteId) : null,
    cliente: o.clienteNome ?? "",
    placa: o.placa ?? "",
    status: vedStatusToDisplay(o.status),
    statusOs: o.status,
    dataAbertura: o.dataAbertura,
    obs: o.obs ?? "",
    defeito: o.defeito ?? "",
    laudoTec: o.laudoTec ?? "",
    equipamento: o.equipamento ?? "",
    marca: o.marca ?? "",
  };
}

export async function getServiceOrderItems(input: unknown) {
  const data = DetailInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canAccess } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: data.loja_id,
  });
  if (!canAccess) throw new Error("Acesso negado a esta loja");

  const { bridge, empId } = await getLojaConfig(data.loja_id);
  const osId = parseInt(data.os_id, 10);
  if (isNaN(osId)) throw new Error("os_id inválido");

  const { sql, params } = resolveNamedQuery("GET_SERVICE_ORDER_ITEMS", { osId, empId });
  const rows = await queryBridge<OsItemRow>(bridge, sql, params);

  return rows.map((r) => ({
    id: String(r.itemId),
    produtoId: String(r.proId),
    codigo: r.proCodigo ?? "",
    produtoNome: r.proDescricao ?? "",
    unidade: r.proUn ?? "",
    quantidade: Number(r.qtde),
    precoUnitario: Number(r.precoUnitario ?? 0),
    total: Number(r.totalItem ?? 0),
  }));
}

export async function addItemToServiceOrder(input: unknown) {
  const data = AddItemInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canAccess } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: data.loja_id,
  });
  if (!canAccess) throw new Error("Acesso negado a esta loja");

  const { loja, bridge, empId, maxApi } = await getLojaConfig(data.loja_id);
  if (!maxApi) throw new Error("MaxAPI não configurada para esta loja");

  const proId = parseInt(data.produto_id, 10);
  const osId = parseInt(data.os_id, 10);
  if (isNaN(proId)) throw new Error("produto_id inválido");
  if (isNaN(osId)) throw new Error("os_id inválido");

  const { stock, validation } = await validateStockForOsItem(empId, proId, data.quantidade, bridge);

  const supabaseAdmin = createAdminClient();
  const auditBase = {
    userId,
    tenant_id: loja.tenant_id as string | null,
    loja_id: data.loja_id,
    entidade: "ordem_servico",
    entidade_id: data.os_id,
  };

  if (validation.blocked) {
    await logAuditoria({
      ...auditBase,
      acao: "BLOQUEOU_ADICIONAR_ITEM_OS",
      detalhes: {
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        status_estoque: validation.code,
        motivo: validation.message,
        estoque_fisico: stock.estoqueFisico,
        estoque_fiscal: stock.estoqueFiscal,
      },
    });
    throw new Error(`Operação bloqueada: ${validation.message}`);
  }

  if (validation.warning && !data.forcar_sem_fiscal) {
    await logAuditoria({
      ...auditBase,
      acao: "ADVERTENCIA_ESTOQUE_FISCAL_OS",
      detalhes: {
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        status_estoque: validation.code,
        advertencia: validation.message,
        estoque_fisico: stock.estoqueFisico,
        estoque_fiscal: stock.estoqueFiscal,
      },
    });
    return {
      ok: false,
      requer_confirmacao: true,
      excedeu_fiscal: true,
      status_estoque: validation.code,
      alerta: validation.message,
      estoque_fisico: stock.estoqueFisico,
      estoque_fiscal: stock.estoqueFiscal,
      item_adicionado: null,
    };
  }

  const itemAdicionado = await addItemToServiceOrderMaxApi(maxApi, supabaseAdmin, data.loja_id, {
    OsId: osId,
    produtoId: proId,
    produtoDescricao: stock.proDescricao,
    qtde: data.quantidade,
    valor: data.valor_unitario,
    tipo: data.tipo,
    cfop: data.cfop,
    tecnicoId: data.tecnico_id,
    un: stock.proUn,
  });

  await logAuditoria({
    ...auditBase,
    acao: "ADICIONOU_ITEM_OS",
    detalhes: {
      produto_id: data.produto_id,
      item_id_maxapi: itemAdicionado?.id,
      quantidade: data.quantidade,
      valor_unitario: data.valor_unitario,
      status_estoque: validation.code,
      excedeu_fiscal: validation.warning,
      estoque_fisico: stock.estoqueFisico,
      estoque_fiscal: stock.estoqueFiscal,
    },
  });

  return {
    ok: true,
    requer_confirmacao: false,
    excedeu_fiscal: false,
    status_estoque: validation.code,
    alerta: validation.warning ? validation.message : null,
    estoque_fisico: stock.estoqueFisico,
    estoque_fiscal: stock.estoqueFiscal,
    item_adicionado: itemAdicionado,
  };
}

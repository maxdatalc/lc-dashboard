"use server";

import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { calculateFiscalStock } from "@/lib/fiscal/calculate-fiscal-stock";
import { statusToRiskLevel } from "@/lib/fiscal/stock-status";
import { queryBridge } from "@/lib/bridge/bridge-client";
import type { BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

const SearchInput = z.object({
  loja_id: z.string().uuid(),
  termoDesc: z.string().optional(),
  termoCodigo: z.string().optional(),
});
const DetailInput = z.object({
  loja_id: z.string().uuid(),
  produto_id: z.string(),
});

export type ProdutoListItem = {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
};

export type ProductStockDetail = {
  produto: { id: string; codigo: string; codigoBarras: string; nome: string; unidade: string };
  estoque_fisico: number;
  estoque_fiscal: number;
  diferenca: number;
  status_risco: "ok" | "atencao" | "bloqueado";
  composicao_estoque_fiscal: {
    inventario_base: number;
    entradas: number;
    saidas: number;
    devolucoes: number;
    ajustes: number;
  } | null;
  pode_emitir_nf: boolean;
  pode_lancar_os: boolean;
  disponivel_para_emissao: number;
  alertas: { tipo: "warning" | "danger"; mensagem: string }[];
};

interface ProductRow {
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proEstoqueAtual: number;
  proUn: string;
}

async function assertLojaAccess(userId: string, loja_id: string) {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: loja_id,
  });
  if (!ok) throw new Error("Acesso negado a esta loja");
}

async function getLojaConfigs(lojaId: string) {
  const supabaseAdmin = createAdminClient();
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("emp_id, sql_bridge_url, sql_bridge_token")
      .eq("id", lojaId)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("inventario_id_base")
      .eq("loja_id", lojaId)
      .maybeSingle(),
  ]);

  const row = loja as Record<string, unknown> | null;
  if (!row?.emp_id) throw new Error("Loja sem emp_id configurado");
  if (!row.sql_bridge_url || !row.sql_bridge_token)
    throw new Error("Bridge SQL não configurada para esta loja");

  const bridge: BridgeConfig = {
    url: row.sql_bridge_url as string,
    token: decrypt(row.sql_bridge_token as string),
  };
  const cfgRow = cfg as Record<string, unknown> | null;
  const invId: number | null = cfgRow?.inventario_id_base
    ? Number(cfgRow.inventario_id_base)
    : null;

  return { empId: row.emp_id as number, bridge, invId };
}

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { userId: user.id };
}

export async function searchProducts(input: unknown): Promise<ProdutoListItem[]> {
  const data = SearchInput.parse(input);
  const { userId } = await getAuthContext();
  await assertLojaAccess(userId, data.loja_id);

  const termoDescRaw = (data.termoDesc ?? "").trim();
  const termoCodigoRaw = (data.termoCodigo ?? "").trim();
  if (!termoDescRaw && !termoCodigoRaw) return [];

  const { empId, bridge, invId } = await getLojaConfigs(data.loja_id);

  // Descrição: sem % = começa com; com % = o usuário controla o padrão
  const termoDesc = termoDescRaw
    ? (termoDescRaw.includes("%") ? termoDescRaw : `${termoDescRaw}%`)
    : "";

  // EAN: ≥7 dígitos numéricos → busca exata; senão → prefixo LIKE
  const isEan = /^\d{7,}$/.test(termoCodigoRaw);
  const termoCodigo = termoCodigoRaw ? (isEan ? termoCodigoRaw : `${termoCodigoRaw}%`) : "";
  const termoCodigoExato = isEan ? 1 : 0;

  const { sql, params } = resolveNamedQuery("SEARCH_PRODUCTS", {
    empId,
    termoDesc,
    termoCodigo,
    termoCodigoExato,
  });
  const rows = await queryBridge<ProductRow>(bridge, sql, params);

  // Calcula estoque fiscal de todos os resultados em paralelo
  const fiscalResults = await Promise.all(
    rows.map((p) => calculateFiscalStock(empId, p.proId, bridge, invId).catch(() => null)),
  );

  return rows.map((p, i) => ({
    id: String(p.proId),
    codigo: p.proCodigo ?? String(p.proId),
    codigoBarras: "",
    nome: p.proDescricao ?? "",
    unidade: p.proUn ?? "",
    estoqueFisico: Number(p.proEstoqueAtual ?? 0),
    estoqueFiscal: fiscalResults[i]?.estoqueFiscal ?? 0,
  }));
}

export async function getProductStockDetail(input: unknown): Promise<ProductStockDetail | null> {
  const data = DetailInput.parse(input);
  const { userId } = await getAuthContext();
  await assertLojaAccess(userId, data.loja_id);

  const { empId, bridge, invId } = await getLojaConfigs(data.loja_id);
  const proId = parseInt(data.produto_id, 10);
  if (isNaN(proId)) throw new Error("produto_id inválido");

  const physQuery = resolveNamedQuery("GET_PRODUCT_PHYSICAL_STOCK", { empId, proId });

  const [physRows, fiscalResult] = await Promise.all([
    queryBridge<ProductRow>(bridge, physQuery.sql, physQuery.params),
    calculateFiscalStock(empId, proId, bridge, invId),
  ]);

  const phys = physRows[0] ?? null;
  const estoqueFisico = phys ? Number(phys.proEstoqueAtual ?? 0) : fiscalResult.estoqueFisico;
  const estoqueFiscal = fiscalResult.estoqueFiscal;
  const diferenca = estoqueFisico - estoqueFiscal;
  const status_risco = statusToRiskLevel(fiscalResult.statusCode);
  const disponivel = Math.max(0, Math.min(estoqueFisico, estoqueFiscal));

  const alertas: ProductStockDetail["alertas"] = fiscalResult.alertas.map((msg) => ({
    tipo: (status_risco === "bloqueado" ? "danger" : "warning") as "warning" | "danger",
    mensagem: msg,
  }));

  if (fiscalResult.semInventario) {
    alertas.push({
      tipo: "danger",
      mensagem: "Inventário não encontrado — estoque fiscal não pode ser calculado.",
    });
  }

  return {
    produto: {
      id: String(proId),
      codigo: phys?.proCodigo ?? fiscalResult.proCodigo,
      codigoBarras: "",
      nome: phys?.proDescricao ?? fiscalResult.proDescricao,
      unidade: phys?.proUn ?? fiscalResult.proUn,
    },
    estoque_fisico: estoqueFisico,
    estoque_fiscal: estoqueFiscal,
    diferenca,
    status_risco,
    composicao_estoque_fiscal: fiscalResult.composicao
      ? {
          inventario_base: fiscalResult.composicao.estoqueBaseInventario,
          entradas: fiscalResult.composicao.entradasFiscais,
          saidas: fiscalResult.composicao.saidasFiscais,
          devolucoes: fiscalResult.composicao.devolucoesFiscais,
          ajustes: fiscalResult.composicao.ajustesEstoque,
        }
      : null,
    pode_emitir_nf: estoqueFiscal > 0,
    pode_lancar_os: estoqueFisico > 0,
    disponivel_para_emissao: disponivel,
    alertas,
  };
}

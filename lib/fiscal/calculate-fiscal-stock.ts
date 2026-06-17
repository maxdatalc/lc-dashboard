/**
 * calculateFiscalStock — server-side only.
 *
 * Formula: InventarioBase + Entradas(E) + Devoluções(1202/2202) - Saídas(S) + Ajustes
 * Validated against BATAUTO on 2026-06-14:
 *   proId=15788, empId=1 → fiscal=898 = proEstoqueAtual
 *
 * Fallback rule: if the product has no entry in the selected inventory,
 * the calculation falls back to all fiscal movements from the beginning
 * (same as GET_FISCAL_STOCK_NO_BASE), instead of blocking with fiscal=0.
 */

import { queryBridge, type BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { deriveStockStatus, type StockStatusCode } from "./stock-status";

export interface FiscalStockComposition {
  inventarioId: number | null;
  dataInventario: string | null;
  estoqueBaseInventario: number;
  entradasFiscais: number;
  saidasFiscais: number;
  devolucoesFiscais: number;
  ajustesEstoque: number;
  estoqueFiscal: number;
}

export interface FiscalStockResult {
  proId: number;
  empId: number;
  proCodigo: string;
  proDescricao: string;
  proUn: string;
  estoqueFisico: number;
  composicao: FiscalStockComposition | null;
  estoqueFiscal: number;
  diferenca: number;
  statusCode: StockStatusCode;
  alertas: string[];
  semInventario: boolean;
  calculadoSemBase: boolean;
}

interface PhysicalRow {
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proEstoqueAtual: number;
  proUn: string;
}

interface FiscalRow {
  proId: number;
  empId: number;
  inventarioId: number | null;
  dataInventario: string | null;
  estoqueBaseInventario: number;
  entradasFiscais: number;
  saidasFiscais: number;
  devolucoesFiscais: number;
  ajustesEstoque: number;
  estoqueFiscal: number;
}

export async function calculateFiscalStock(
  empId: number,
  proId: number,
  bridge: BridgeConfig,
  invId: number | null = null,
): Promise<FiscalStockResult> {
  const useNoBase = invId === 0;
  const compParams = { empId, proId, invId };
  const noBaseParams = { empId, proId };

  const [physicalRows, fiscalRows] = await Promise.all([
    queryBridge<PhysicalRow>(
      bridge,
      resolveNamedQuery("GET_PRODUCT_PHYSICAL_STOCK", noBaseParams).sql,
      noBaseParams,
    ),
    useNoBase
      ? queryBridge<FiscalRow>(
          bridge,
          resolveNamedQuery("GET_FISCAL_STOCK_NO_BASE", noBaseParams).sql,
          noBaseParams,
        )
      : queryBridge<FiscalRow>(
          bridge,
          resolveNamedQuery("GET_FISCAL_STOCK_COMPOSITION", compParams).sql,
          compParams,
        ),
  ]);

  if (!physicalRows.length) {
    throw new Error(`Produto proId=${proId} não encontrado no empId=${empId}`);
  }

  const ph = physicalRows[0];
  const estoqueFisico = Number(ph.proEstoqueAtual ?? 0);
  const alertas: string[] = [];

  let fi = fiscalRows[0] as FiscalRow | undefined;
  let calculadoSemBase = useNoBase;

  // Fallback: product not in the selected inventory → recalculate from all movements
  if (!fi && !useNoBase) {
    const fallbackRows = await queryBridge<FiscalRow>(
      bridge,
      resolveNamedQuery("GET_FISCAL_STOCK_NO_BASE", noBaseParams).sql,
      noBaseParams,
    );
    fi = fallbackRows[0];
    calculadoSemBase = true;
    if (fi) {
      alertas.push(
        "Produto não lançado neste inventário — estoque fiscal calculado a partir de todas as movimentações.",
      );
    }
  }

  if (!fi) {
    alertas.push("Produto sem movimentações fiscais registradas — estoque fiscal indisponível.");
    return {
      proId,
      empId,
      proCodigo: ph.proCodigo ?? "",
      proDescricao: ph.proDescricao ?? "",
      proUn: ph.proUn ?? "",
      estoqueFisico,
      composicao: null,
      estoqueFiscal: 0,
      diferenca: estoqueFisico,
      statusCode: "PENDENTE_VALIDACAO",
      alertas,
      semInventario: true,
      calculadoSemBase: true,
    };
  }

  const estoqueFiscal = Number(fi.estoqueFiscal ?? 0);
  const diferenca = estoqueFisico - estoqueFiscal;

  if (diferenca > 0) {
    alertas.push(
      `Estoque físico (${estoqueFisico}) maior que fiscal (${estoqueFiscal}) em ${diferenca} unidades.`,
    );
  }
  if (diferenca < 0) {
    alertas.push(
      `Estoque fiscal (${estoqueFiscal}) maior que físico (${estoqueFisico}) em ${Math.abs(diferenca)} unidades — possível entrada de NF não recebida fisicamente.`,
    );
  }

  const composicao: FiscalStockComposition = {
    inventarioId: fi.inventarioId,
    dataInventario: fi.dataInventario,
    estoqueBaseInventario: Number(fi.estoqueBaseInventario ?? 0),
    entradasFiscais: Number(fi.entradasFiscais ?? 0),
    saidasFiscais: Number(fi.saidasFiscais ?? 0),
    devolucoesFiscais: Number(fi.devolucoesFiscais ?? 0),
    ajustesEstoque: Number(fi.ajustesEstoque ?? 0),
    estoqueFiscal,
  };

  const { code } = deriveStockStatus(estoqueFisico, estoqueFiscal, 0);

  return {
    proId,
    empId,
    proCodigo: ph.proCodigo ?? "",
    proDescricao: ph.proDescricao ?? "",
    proUn: ph.proUn ?? "",
    estoqueFisico,
    composicao,
    estoqueFiscal,
    diferenca,
    statusCode: code,
    alertas,
    semInventario: false,
    calculadoSemBase,
  };
}

export async function validateStockForOsItem(
  empId: number,
  proId: number,
  requestedQty: number,
  bridge: BridgeConfig,
  invId: number | null = null,
) {
  const stock = await calculateFiscalStock(empId, proId, bridge, invId);
  const validation = deriveStockStatus(stock.estoqueFisico, stock.estoqueFiscal, requestedQty);
  return { stock, validation };
}

/**
 * calculateFiscalStock — server-side only.
 *
 * Formula: InventarioBase + Entradas(E) + Devoluções(1202/2202) - Saídas(S) + Ajustes - ReservadoEmOS
 * Validated against BATAUTO on 2026-06-14.
 *
 * Fallback rule: if the product has no entry in the selected inventory,
 * the calculation falls back to all fiscal movements from the beginning.
 *
 * OS reservation rule: if osTiposFiscais is provided, quantities of this
 * product in open OS whose tipo de atendimento is in that list are
 * pre-deducted from the effective fiscal stock.
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
  estoqueFiscalNf: number;
  reservadoEmOS: number;
  estoqueFiscal: number;
}

export interface FiscalStockResult {
  proId: number;
  empId: number;
  proCodigo: string;
  proDescricao: string;
  proUn: string;
  proTipo: string;
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
  proTipo: string;
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

interface ReservationRow {
  reservado: number;
}

export async function calculateFiscalStock(
  empId: number,
  proId: number,
  bridge: BridgeConfig,
  invId: number | null = null,
  osTiposFiscais: number[] = [],
): Promise<FiscalStockResult> {
  // null = nenhum inventário configurado → calcular desde o início de todas as movimentações
  // 0   = legado, mesmo comportamento
  const useNoBase = invId === null || invId === 0;
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

  // Services have no stock control — skip fiscal validation entirely
  if (ph.proTipo === "S") {
    return {
      proId,
      empId,
      proCodigo: ph.proCodigo ?? "",
      proDescricao: ph.proDescricao ?? "",
      proUn: ph.proUn ?? "",
      proTipo: "S",
      estoqueFisico: 0,
      composicao: null,
      estoqueFiscal: 0,
      diferenca: 0,
      statusCode: "OK" as StockStatusCode,
      alertas: [],
      semInventario: true,
      calculadoSemBase: false,
    };
  }

  const estoqueFisico = Number(ph.proEstoqueAtual ?? 0);
  const alertas: string[] = [];

  let fi = fiscalRows[0] as FiscalRow | undefined;
  let calculadoSemBase = useNoBase;

  // Fallback: product not in inventory → recalculate from all movements
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
      proTipo: ph.proTipo ?? "P",
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

  const estoqueFiscalNf = Number(fi.estoqueFiscal ?? 0);

  // OS reservation: sum quantities in open OS with fiscal-trigger tipos
  let reservadoEmOS = 0;
  if (osTiposFiscais.length > 0) {
    const tatIds = osTiposFiscais.join(",");
    const resQuery = resolveNamedQuery("GET_OS_RESERVATIONS", { empId, proId, tatIds });
    const resRows = await queryBridge<ReservationRow>(bridge, resQuery.sql, resQuery.params);
    reservadoEmOS = Number(resRows[0]?.reservado ?? 0);
    if (reservadoEmOS > 0) {
      alertas.push(
        `${reservadoEmOS} unidade(s) em O.S abertas (tipo fiscal) — descontada(s) do estoque disponível.`,
      );
    }
  }

  const estoqueFiscal = estoqueFiscalNf - reservadoEmOS;
  const diferenca = estoqueFisico - estoqueFiscal;

  if (diferenca > 0 && estoqueFiscal >= 0) {
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
    estoqueFiscalNf,
    reservadoEmOS,
    estoqueFiscal,
  };

  const { code } = deriveStockStatus(estoqueFisico, estoqueFiscal, 0);

  return {
    proId,
    empId,
    proCodigo: ph.proCodigo ?? "",
    proDescricao: ph.proDescricao ?? "",
    proUn: ph.proUn ?? "",
    proTipo: ph.proTipo ?? "P",
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
  osTiposFiscais: number[] = [],
) {
  const stock = await calculateFiscalStock(empId, proId, bridge, invId, osTiposFiscais);
  if (stock.proTipo === "S") {
    return {
      stock,
      validation: {
        code: "OK" as StockStatusCode,
        blocked: false,
        warning: false,
        message: "Serviço — sem controle de estoque.",
      },
    };
  }
  const validation = deriveStockStatus(stock.estoqueFisico, stock.estoqueFiscal, requestedQty);
  return { stock, validation };
}

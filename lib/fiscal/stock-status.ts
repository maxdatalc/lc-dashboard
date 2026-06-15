export type StockStatusCode =
  | "OK"
  | "EXCEDE_FISICO"
  | "EXCEDE_FISCAL"
  | "EXCEDE_FISICO_E_FISCAL"
  | "SEM_ESTOQUE_FISICO"
  | "SEM_ESTOQUE_FISCAL"
  | "FISICO_MAIOR_QUE_FISCAL"
  | "FISCAL_MAIOR_QUE_FISICO"
  | "PENDENTE_VALIDACAO"
  | "ERRO_CONSULTA";

export interface StockValidationResult {
  code: StockStatusCode;
  blocked: boolean;
  warning: boolean;
  message: string;
}

export function deriveStockStatus(
  physicalStock: number,
  fiscalStock: number,
  requestedQty: number,
): StockValidationResult {
  if (physicalStock <= 0) {
    return {
      code: "SEM_ESTOQUE_FISICO",
      blocked: true,
      warning: false,
      message: "Estoque físico zerado — produto indisponível no momento.",
    };
  }

  if (fiscalStock <= 0) {
    return {
      code: "SEM_ESTOQUE_FISCAL",
      blocked: true,
      warning: false,
      message: `Estoque fiscal zerado — não é possível emitir NF para este produto (físico: ${physicalStock}).`,
    };
  }

  const excedeFisico = requestedQty > physicalStock;
  const excedeFiscal = requestedQty > fiscalStock;

  if (excedeFisico && excedeFiscal) {
    return {
      code: "EXCEDE_FISICO_E_FISCAL",
      blocked: true,
      warning: false,
      message: `Quantidade (${requestedQty}) excede estoque físico (${physicalStock}) e fiscal (${fiscalStock}).`,
    };
  }

  if (excedeFisico) {
    return {
      code: "EXCEDE_FISICO",
      blocked: true,
      warning: false,
      message: `Quantidade (${requestedQty}) excede o estoque físico disponível (${physicalStock}).`,
    };
  }

  if (excedeFiscal) {
    return {
      code: "EXCEDE_FISCAL",
      blocked: false,
      warning: true,
      message: `Quantidade (${requestedQty}) excede o estoque fiscal (${fiscalStock}). A emissão de NF poderá falhar.`,
    };
  }

  if (physicalStock > fiscalStock) {
    return {
      code: "FISICO_MAIOR_QUE_FISCAL",
      blocked: false,
      warning: true,
      message: `Estoque físico (${physicalStock}) maior que fiscal (${fiscalStock}). Verifique divergência antes de emitir NF.`,
    };
  }

  return {
    code: "OK",
    blocked: false,
    warning: false,
    message: "Estoque físico e fiscal suficientes.",
  };
}

export function statusToRiskLevel(code: StockStatusCode): "ok" | "atencao" | "bloqueado" {
  switch (code) {
    case "OK":
    case "FISCAL_MAIOR_QUE_FISICO":
      return "ok";
    case "EXCEDE_FISCAL":
    case "FISICO_MAIOR_QUE_FISCAL":
    case "PENDENTE_VALIDACAO":
      return "atencao";
    default:
      return "bloqueado";
  }
}

import { searchProducts, getProductStockDetail } from "@/lib/api/stock.functions";
import type { Produto } from "@/lib/fiscal-types";
import type { ProductStockDetail } from "@/lib/api/stock.functions";

export const stockService = {
  async search(
    lojaId: string | undefined,
    termoDesc: string,
    termoCodigo: string,
    grupo?: string,
  ): Promise<Produto[]> {
    if (!lojaId) return [];
    const rows = await searchProducts({ loja_id: lojaId, termoDesc, termoCodigo, grupo });
    return rows.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      codigoBarras: p.codigoBarras,
      nome: p.nome,
      unidade: p.unidade,
      estoqueFisico: p.estoqueFisico,
      estoqueFiscal: p.estoqueFiscal,
      preco: p.preco,
      tipo: p.tipo,
      composicaoFiscal: {
        inventarioBase: 0,
        entradas: 0,
        saidas: 0,
        devolucoes: 0,
        ajustes: 0,
      },
      reservadoEmOS: 0,
      empresaId: lojaId,
    }));
  },

  async detail(lojaId: string, produtoId: string): Promise<ProductStockDetail | null> {
    return getProductStockDetail({ loja_id: lojaId, produto_id: produtoId });
  },
};

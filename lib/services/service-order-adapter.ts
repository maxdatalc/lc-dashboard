import {
  listServiceOrders,
  listTiposAtendimento,
  getServiceOrderDetail,
  getServiceOrderItems,
  addItemToServiceOrder,
} from "@/lib/api/service-orders.functions";
import type { OrdemServico, ItemOS, TipoAtendimento } from "@/lib/fiscal-types";

export interface OsListFilters {
  status?: string;
  cliente?: string;
  placa?: string;
  tipoAtend?: number;
  osNum?: number;
  marca?: string;
  prisma?: string;
  dtAbertIni?: string;
  dtAbertFim?: string;
}

export const serviceOrderService = {
  async list(lojaId: string, filters: OsListFilters = {}): Promise<OrdemServico[]> {
    const rows = await listServiceOrders({ loja_id: lojaId, ...filters });
    return rows.map(
      (o): OrdemServico => ({
        id: o.id,
        numero: o.numero,
        cliente: o.cliente,
        placa: o.placa,
        data: o.dataAbertura ?? new Date().toISOString(),
        status: o.status as OrdemServico["status"],
        empresaId: lojaId,
        itens: [],
        obs: o.obs,
        defeito: o.defeito,
        equipamento: o.equipamento,
        marca: o.marca,
        cliId: o.cliId,
        valorTotal: o.valorTotal,
        tipoAtendId: o.tipoAtendId,
        tipoAtendDesc: o.tipoAtendDesc,
        tipoAtendCor: o.tipoAtendCor,
        tipoAtendCorFundo: o.tipoAtendCorFundo,
        tipoAtendGeraFin: o.tipoAtendGeraFin,
        prisma: o.prisma,
        dataFechamento: o.dataFechamento,
      }),
    );
  },

  async listTipos(lojaId: string): Promise<TipoAtendimento[]> {
    const rows = await listTiposAtendimento({ loja_id: lojaId });
    return rows.map((r) => ({
      tatId: r.tatId,
      tatDesc: r.tatDesc,
      tatCorDestaqueTexto: r.tatCorDestaqueTexto,
      tatCorDestaqueFundo: r.tatCorDestaqueFundo,
      tatProGeraFinanceiro: r.tatProGeraFinanceiro,
    }));
  },

  async get(osId: string, lojaId: string): Promise<OrdemServico | null> {
    const [detail, items] = await Promise.all([
      getServiceOrderDetail({ loja_id: lojaId, os_id: osId }),
      getServiceOrderItems({ loja_id: lojaId, os_id: osId }),
    ]);

    return {
      id: detail.id,
      numero: detail.numero,
      cliente: detail.cliente,
      placa: detail.placa,
      data: detail.dataAbertura ?? new Date().toISOString(),
      status: detail.status as OrdemServico["status"],
      empresaId: lojaId,
      itens: items.map(
        (r): ItemOS => ({
          id: r.id,
          produtoId: r.produtoId,
          produtoNome: r.produtoNome,
          codigo: r.codigo,
          quantidade: r.quantidade,
          unidade: r.unidade,
          precoUnitario: r.precoUnitario,
          total: r.total,
        }),
      ),
      obs: detail.obs,
      defeito: detail.defeito,
      laudoTec: detail.laudoTec,
      equipamento: detail.equipamento,
      marca: detail.marca,
    };
  },

  async addItem(input: {
    loja_id: string | undefined;
    os_id: string;
    produto_id: string;
    quantidade: number;
    forcar_sem_fiscal?: boolean;
  }) {
    if (!input.loja_id) throw new Error("loja_id ausente");
    return addItemToServiceOrder({
      loja_id: input.loja_id,
      os_id: input.os_id,
      produto_id: input.produto_id,
      quantidade: input.quantidade,
      valor_unitario: 0,
      forcar_sem_fiscal: input.forcar_sem_fiscal ?? false,
    });
  },
};

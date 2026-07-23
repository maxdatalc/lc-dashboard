/**
 * Fase 5 (lc-storefront): empurra pedidos pagos pro MaxManager (Supervisão de
 * Vendas) e detecta, por polling, quando a Supervisão aprova a venda.
 *
 * Reage ao ESTADO do banco compartilhado (ecom_pedidos.status), nunca é
 * chamado diretamente pelo webhook do Mercado Pago — worker desacoplado
 * (ver app/api/cron/ecommerce-pedidos-erp/route.ts), mesma razão de
 * lib/ecommerce/sync-catalogo.ts: uma loja/pedido com problema nunca pode
 * travar as outras, e o caminho de teste (flipar status='pago' via service
 * role) tem que ser IDÊNTICO ao caminho de produção (webhook).
 *
 * Retomada de falha parcial: `ecom_pedidos.venda_erp_id` é gravado assim que
 * a venda é criada no ERP (antes de qualquer item), e cada
 * `ecom_pedido_itens.enviado_erp` é marcado individualmente — nunca em lote —
 * pra que uma falha no meio da lista de itens nunca reenvie um item já
 * aceito (reenviar duplicaria a movimentação de estoque, que a própria API
 * já faz na inserção do item). O ERP não tem como estornar item duplicado
 * (ver CLAUDE.md, "Lacuna aberta — estorno"), então nunca recriar a venda.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { queryBridge, type BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { getLojaDbConfig } from "@/lib/db/tenants";
import {
  buildMaxApiConfig,
  createClienteMaxApi,
  createSaleMaxApi,
  addSaleItemMaxApi,
  updateSaleStatusMaxApi,
  getSaleMaxApi,
  type MaxApiConfig,
} from "@/lib/maxapi/maxapi-client";
import { resolveTerminal } from "@/lib/maxapi/terminal";
import { createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

const MAX_TENTATIVAS = 5;

interface PedidoErpRow {
  id: string;
  cliente_id: string;
  venda_erp_id: number | null;
  erp_tentativas: number;
}

interface ClienteErpRow {
  id: string;
  loja_id: string;
  nome: string;
  celular: string | null;
  cpf_cnpj: string | null;
  erp_cliente_id: number | null;
}

interface EnderecoErpRow {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo_ibge: string | null;
}

interface ItemErpRow {
  id: string;
  external_id: number;
  preco: number;
  quantidade: number;
  enviado_erp: boolean;
}

export interface ResultadoPushErp {
  pedidoId: string;
  ok: boolean;
  erro?: string;
}

interface IntegracoesLoja {
  bridge: BridgeConfig;
  maxApi: MaxApiConfig;
  atendenteId: number;
}

/**
 * Resolve Bridge + MaxAPI + atendenteId de uma loja. `maxapi_atendente_id`
 * ainda não tem UI (semeado manualmente no banco até a Fase 6) — erro
 * explícito se ausente, nunca um default silencioso (mesma disciplina de
 * `resolveTerminal`/`buildMaxApiConfig`).
 */
async function resolverIntegracoesLoja(
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
): Promise<IntegracoesLoja> {
  const bridgeConfig = await getLojaDbConfig(lojaId);
  if (!bridgeConfig) throw new Error("Bridge SQL não configurada para esta loja");

  const { data: cfgRow } = await supabaseAdmin
    .from("integration_configs")
    .select("maxapi_url, terminal_maxdata, maxapi_atendente_id")
    .eq("loja_id", lojaId)
    .maybeSingle();

  if (!cfgRow?.maxapi_url) throw new Error("MaxAPI não configurada para esta loja");

  const terminal = resolveTerminal(cfgRow);
  if (!terminal) throw new Error("Terminal MaxData não configurado para esta loja");

  const atendenteId = cfgRow.maxapi_atendente_id as number | null;
  if (!atendenteId) {
    throw new Error(
      "maxapi_atendente_id não configurado para esta loja (Fase 5, sem UI ainda — seed manual)",
    );
  }

  const maxApi = buildMaxApiConfig(
    { emp_id_maxdata: String(bridgeConfig.empId), terminal_maxdata: terminal },
    { maxapi_url: cfgRow.maxapi_url as string },
  );

  return {
    bridge: { url: bridgeConfig.bridgeUrl, token: bridgeConfig.token },
    maxApi,
    atendenteId,
  };
}

/**
 * Busca cliente existente no ERP por CPF (Bridge, só leitura) antes de criar
 * um novo via POST /v2/client — evita duplicar cadastro de quem já compra na
 * loja física. Formato do ClientBody confirmado ao vivo (ver
 * fase-5-maxapi-client-sale-validado na memória): `enderecos` é array,
 * `ibge` é number.
 */
async function resolverClienteErp(
  bridge: BridgeConfig,
  maxApi: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  cliente: ClienteErpRow,
  enderecoPadrao: EnderecoErpRow,
): Promise<number> {
  if (cliente.erp_cliente_id) return cliente.erp_cliente_id;
  if (!cliente.cpf_cnpj) throw new Error("Cliente sem CPF cadastrado — não pode ir ao ERP");
  if (!enderecoPadrao.codigo_ibge) {
    throw new Error(
      "Endereço padrão do cliente sem código IBGE — peça pra reeditar o CEP no cadastro",
    );
  }

  const { sql, params } = resolveNamedQuery("FIND_CLIENTE_BY_CPF", { cpf: cliente.cpf_cnpj });
  const encontrados = await queryBridge<{ cliId: number }>(bridge, sql, params);

  let erpClienteId: number;
  if (encontrados.length > 0) {
    erpClienteId = encontrados[0].cliId;
  } else {
    const criado = await createClienteMaxApi(maxApi, supabaseAdmin, lojaId, {
      tipo: "fisica",
      tipoCadastro: "cliente",
      nome: cliente.nome,
      fantasia: cliente.nome,
      cpfCnpj: cliente.cpf_cnpj,
      celular: cliente.celular ?? "",
      enderecos: [
        {
          endereco: enderecoPadrao.logradouro,
          numeroEndereco: enderecoPadrao.numero,
          bairro: enderecoPadrao.bairro,
          cidade: enderecoPadrao.cidade,
          uf: enderecoPadrao.uf,
          cep: enderecoPadrao.cep,
          ibge: Number(enderecoPadrao.codigo_ibge),
        },
      ],
    });
    erpClienteId = criado.id;
  }

  await supabaseAdmin
    .from("ecom_clientes")
    .update({ erp_cliente_id: erpClienteId })
    .eq("id", cliente.id);

  return erpClienteId;
}

async function buscarClienteEEndereco(
  supabaseAdmin: AnySupabaseClient,
  clienteId: string,
): Promise<{ cliente: ClienteErpRow; enderecoPadrao: EnderecoErpRow }> {
  const { data: cliente } = await supabaseAdmin
    .from("ecom_clientes")
    .select("id, loja_id, nome, celular, cpf_cnpj, erp_cliente_id")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) throw new Error("Cliente do pedido não encontrado");

  const { data: enderecoPadrao } = await supabaseAdmin
    .from("ecom_enderecos")
    .select("logradouro, numero, bairro, cidade, uf, cep, codigo_ibge")
    .eq("cliente_id", clienteId)
    .eq("is_padrao", true)
    .maybeSingle();
  if (!enderecoPadrao) throw new Error("Cliente sem endereço padrão cadastrado");

  return { cliente: cliente as ClienteErpRow, enderecoPadrao: enderecoPadrao as EnderecoErpRow };
}

/**
 * Empurra UM pedido pago pro ERP: resolve cliente, cria a venda (ou retoma
 * uma já iniciada), envia os itens que ainda faltam, manda pra Supervisão.
 * Lança em qualquer falha — quem chama decide retry/alerta.
 */
export async function empurrarPedidoParaErp(
  supabaseAdmin: AnySupabaseClient,
  pedido: PedidoErpRow,
): Promise<void> {
  const { cliente, enderecoPadrao } = await buscarClienteEEndereco(supabaseAdmin, pedido.cliente_id);
  const { bridge, maxApi, atendenteId } = await resolverIntegracoesLoja(supabaseAdmin, cliente.loja_id);

  const erpClienteId = await resolverClienteErp(
    bridge, maxApi, supabaseAdmin, cliente.loja_id, cliente, enderecoPadrao,
  );

  let vendaId = pedido.venda_erp_id;
  if (!vendaId) {
    const criada = await createSaleMaxApi(maxApi, supabaseAdmin, cliente.loja_id, {
      clienteId: erpClienteId,
      atendenteId,
    });
    vendaId = criada.id;
    // Gravado ANTES de tentar qualquer item — é o que permite a uma próxima
    // tentativa retomar esta venda em vez de criar uma segunda.
    await supabaseAdmin.from("ecom_pedidos").update({ venda_erp_id: vendaId }).eq("id", pedido.id);
  }

  const { data: itens } = await supabaseAdmin
    .from("ecom_pedido_itens")
    .select("id, external_id, preco, quantidade, enviado_erp")
    .eq("pedido_id", pedido.id)
    .returns<ItemErpRow[]>();

  for (const item of itens ?? []) {
    if (item.enviado_erp) continue;
    await addSaleItemMaxApi(maxApi, supabaseAdmin, cliente.loja_id, {
      vendaId,
      produtoId: item.external_id,
      qtde: item.quantidade,
      valor: item.preco,
    });
    // Marcado item a item, não em lote: uma falha no item seguinte nunca
    // reenvia este (reenviar duplicaria a movimentação de estoque).
    await supabaseAdmin.from("ecom_pedido_itens").update({ enviado_erp: true }).eq("id", item.id);
  }

  await updateSaleStatusMaxApi(maxApi, supabaseAdmin, cliente.loja_id, vendaId, {
    status: "supervisao",
  });

  await supabaseAdmin
    .from("ecom_pedidos")
    .update({ status: "preparando", erp_tentativas: 0, erp_ultimo_erro: null })
    .eq("id", pedido.id);
}

/**
 * Varre todos os pedidos `pago` (todas as lojas) e tenta empurrar cada um.
 * Uma falha isola só o pedido daquela iteração — mesmo padrão de
 * `sincronizarCatalogo` em sync-catalogo.ts. Ao atingir MAX_TENTATIVAS
 * falhas consecutivas, o pedido vira `pago_pendente_erp` (alerta manual).
 */
export async function processarPedidosPagos(): Promise<ResultadoPushErp[]> {
  const supabaseAdmin = createAdminClient();

  const { data: pedidos } = await supabaseAdmin
    .from("ecom_pedidos")
    .select("id, cliente_id, venda_erp_id, erp_tentativas")
    .eq("status", "pago")
    .returns<PedidoErpRow[]>();

  const resultados: ResultadoPushErp[] = [];

  for (const pedido of pedidos ?? []) {
    try {
      await empurrarPedidoParaErp(supabaseAdmin, pedido);
      resultados.push({ pedidoId: pedido.id, ok: true });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      const tentativas = pedido.erp_tentativas + 1;
      const novoStatus = tentativas >= MAX_TENTATIVAS ? "pago_pendente_erp" : "pago";
      console.error(`[ecommerce-pedidos-erp] pedido ${pedido.id} falhou (tentativa ${tentativas}): ${mensagem}`);
      await supabaseAdmin
        .from("ecom_pedidos")
        .update({ erp_tentativas: tentativas, erp_ultimo_erro: mensagem, status: novoStatus })
        .eq("id", pedido.id);
      resultados.push({ pedidoId: pedido.id, ok: false, erro: mensagem });
    }
  }

  return resultados;
}

/**
 * Varre pedidos `preparando` e consulta a venda no ERP — quando o funcionário
 * aprova na tela de Supervisão de Vendas, `GET /v2/sale/{id}` passa a
 * responder "finalizada" e o pedido vira `concluido`. Detecção é só por
 * polling: não existe webhook do MaxManager (fluxo já fixado no CLAUDE.md).
 */
export async function verificarPedidosPreparando(): Promise<ResultadoPushErp[]> {
  const supabaseAdmin = createAdminClient();

  const { data: pedidos } = await supabaseAdmin
    .from("ecom_pedidos")
    .select("id, cliente_id, venda_erp_id")
    .eq("status", "preparando")
    .returns<(PedidoErpRow & { venda_erp_id: number })[]>();

  const resultados: ResultadoPushErp[] = [];

  for (const pedido of pedidos ?? []) {
    try {
      if (!pedido.venda_erp_id) throw new Error("Pedido preparando sem venda_erp_id");

      const { data: cliente } = await supabaseAdmin
        .from("ecom_clientes")
        .select("loja_id")
        .eq("id", pedido.cliente_id)
        .maybeSingle();
      if (!cliente) throw new Error("Cliente do pedido não encontrado");

      const { maxApi } = await resolverIntegracoesLoja(supabaseAdmin, cliente.loja_id as string);
      const venda = await getSaleMaxApi(maxApi, supabaseAdmin, cliente.loja_id as string, pedido.venda_erp_id);

      if (venda.status === "finalizada") {
        await supabaseAdmin.from("ecom_pedidos").update({ status: "concluido" }).eq("id", pedido.id);
      }
      resultados.push({ pedidoId: pedido.id, ok: true });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      console.error(`[ecommerce-pedidos-erp] polling do pedido ${pedido.id} falhou: ${mensagem}`);
      resultados.push({ pedidoId: pedido.id, ok: false, erro: mensagem });
    }
  }

  return resultados;
}

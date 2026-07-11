/**
 * POST /api/internal/stock-check
 *
 * Estoque ao vivo no ERP, para o lc-storefront revalidar o carrinho ANTES de
 * cobrar o cliente. Server-to-server, autenticado por segredo compartilhado.
 *
 * Existe para que as credenciais de bridge e a ENCRYPTION_KEY NUNCA saiam deste
 * projeto: a vitrine é um deploy público e só fala HTTP com este endpoint.
 *
 * Regra de negócio (spec do e-commerce): estoque insuficiente é avisado ao
 * cliente ANTES do pagamento, nunca depois. Se a bridge estiver fora do ar, este
 * endpoint devolve 503 e o checkout NÃO deve cobrar.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { getLojaDbConfig } from "@/lib/db/tenants";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 10_000;

const schema = z.object({
  loja_id: z.string().uuid(),
  itens: z
    .array(
      z.object({
        external_id: z.number().int().positive(),
        quantidade: z.number().int().positive(),
      }),
    )
    .min(1)
    // Teto para o carrinho não virar uma consulta arbitrariamente grande no ERP.
    .max(100),
});

interface StockRow {
  proId: number;
  proEstoqueAtual: number;
  proVenda: number;
  proDesativaProd: number;
}

export async function POST(req: NextRequest) {
  const segredo = process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!segredo || authHeader !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { loja_id, itens } = parsed.data;

  const config = await getLojaDbConfig(loja_id);
  if (!config) {
    return NextResponse.json({ error: "Bridge SQL não configurada" }, { status: 404 });
  }

  const { sql, params } = resolveNamedQuery("GET_ECOMMERCE_STOCK", {
    empId: config.empId,
    proIds: itens.map((i) => i.external_id).join(","),
  });

  let linhas: StockRow[];
  try {
    linhas = await queryBridge<StockRow>(
      { url: config.bridgeUrl, token: config.token },
      sql,
      params,
      TIMEOUT_MS,
    );
  } catch (err) {
    // Nunca cobrar sem conseguir revalidar: o checkout trata 503 como bloqueio.
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[stock-check] bridge falhou para a loja ${loja_id}: ${mensagem}`);
    return NextResponse.json({ error: "bridge_indisponivel" }, { status: 503 });
  }

  const porProId = new Map(linhas.map((linha) => [linha.proId, linha]));

  const resultado = itens.map((item) => {
    const linha = porProId.get(item.external_id);

    // Produto ausente do ERP ou desativado (proDesativaProd: 0/NULL = ativo,
    // -1 = inativo) nunca é vendável, independentemente do estoque.
    const ativo = !!linha && Number(linha.proDesativaProd ?? 0) === 0;
    const estoque = ativo ? Number(linha.proEstoqueAtual ?? 0) : 0;

    return {
      external_id: item.external_id,
      quantidade_pedida: item.quantidade,
      estoque_atual: estoque,
      disponivel: ativo && estoque >= item.quantidade,
      preco_erp: linha ? Number(linha.proVenda ?? 0) : null,
    };
  });

  return NextResponse.json({
    loja_id,
    itens: resultado,
    tudo_disponivel: resultado.every((r) => r.disponivel),
  });
}

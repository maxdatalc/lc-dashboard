// Rota de re-sincronização de itens e pagamentos de vendas existentes
// Compensa syncs anteriores que não popularam venda_itens/venda_pagamentos
// Suporta paginação via ?offset=N&limit=N para evitar timeout em grandes lotes

export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";

// Campos possíveis nos itens de venda retornados pela API MaxData
interface MaxDataItem {
  produtoId?: number;
  descricaoProduto?: string;
  vdiProNome?: string;
  qtde?: number;
  vdiQtde?: number;
  valor?: number;
  vdiValor?: number;
  valorDesconto?: number;
  vdiValorDesconto?: number;
  valorTotal?: number;
  vdiValorTotal?: number;
}

// Campos possíveis nos pagamentos retornados pela API MaxData
interface MaxDataPagamento {
  formaPgto?: string;
  forma_pagamento?: string;
  valor?: number;
  qtdParcela?: number;
  parcelas?: number;
}

// Normaliza a resposta paginada ou array direto da API MaxData
function extrairArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  const obj = raw as Record<string, unknown>

  // API MaxData usa "docs" como chave principal
  if (Array.isArray(obj.docs)) return obj.docs as T[]

  // Fallbacks alternativos
  if (Array.isArray(obj.data)) return obj.data as T[]
  const nested = obj.data as Record<string, unknown> | undefined
  if (nested && Array.isArray(nested.data)) return nested.data as T[]
  if (nested && Array.isArray(nested.docs)) return nested.docs as T[]

  return []
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaId = searchParams.get("lojaId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (!lojaId) {
    return NextResponse.json({ error: "lojaId é obrigatório" }, { status: 400 });
  }

  // Verificar autenticação via sessão do usuário
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Credenciais da loja + token MaxData — reutiliza a lógica existente em lib/
  let token: string;
  let erpBaseUrl: string;
  try {
    const config = await getLojaConfig(lojaId);
    token = await getMaxDataToken(config);
    erpBaseUrl = config.baseUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Falha ao autenticar na API MaxData: ${msg}` }, { status: 502 });
  }

  // Admin client para escritas sem restrição de RLS (igual ao Edge Function)
  const adminClient = createAdminClient();

  // Buscar vendas da loja com paginação (mais recentes primeiro para priorizar dados novos)
  // source incluído para determinar o endpoint correto (sale vs serviceorder)
  const { data: vendas, error: vendasError } = await adminClient
    .from("vendas")
    .select("id, external_id, source")
    .eq("loja_id", lojaId)
    .not("external_id", "is", null)
    .order("data_venda", { ascending: false })
    .range(offset, offset + limit - 1);

  if (vendasError) {
    return NextResponse.json({ error: `Erro ao buscar vendas: ${vendasError.message}` }, { status: 500 });
  }

  const erros: string[] = [];
  let itensSincronizados = 0;
  let pagamentosSincronizados = 0;

  const BATCH_SIZE = 2;

  for (let i = 0; i < (vendas ?? []).length; i += BATCH_SIZE) {
    const batch = (vendas ?? []).slice(i, i + BATCH_SIZE);

    const resultados = await Promise.all(
      batch.map(async (venda) => {
        const externalId = venda.external_id as number | string;
        const isOs = (venda.source as string | null) === "os";
        let itens = 0;
        let pgtos = 0;
        const errosBatch: string[] = [];

        try {
          // ── ITENS ────────────────────────────────────────────────────────────
          const itemsEndpoint = isOs
            ? `${erpBaseUrl}/v2/serviceorder/${externalId}/items`
            : `${erpBaseUrl}/v2/sale/${externalId}/items`;

          const itensRes = await fetch(itemsEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
          });

          if (itensRes.ok) {
            const itensList = extrairArray<MaxDataItem>(await itensRes.json() as unknown);

            if (itensList.length > 0) {
              const mapeados = itensList.map((item) => {
                const qtde = item.qtde ?? item.vdiQtde ?? 0;
                const valorUnit = item.valor ?? item.vdiValor ?? 0;
                const desconto = item.valorDesconto ?? item.vdiValorDesconto ?? 0;
                return {
                  loja_id: lojaId,
                  venda_external_id: externalId,
                  produto_external_id: item.produtoId ?? null,
                  produto_nome: item.descricaoProduto ?? item.vdiProNome ?? null,
                  quantidade: qtde,
                  valor_unitario: valorUnit,
                  valor_desconto: desconto,
                  valor_total: qtde * valorUnit - desconto,
                };
              }).filter((i) => i.produto_nome !== null && i.produto_nome !== "");

              // Deletar antes de inserir — produto_external_id pode ser null,
              // impedindo upsert pelo constraint loja+venda+produto
              await adminClient
                .from("venda_itens")
                .delete()
                .eq("loja_id", lojaId)
                .eq("venda_external_id", externalId);

              const { error } = await adminClient.from("venda_itens").insert(mapeados);
              if (error) errosBatch.push(`Itens ${externalId}: ${error.message}`);
              else itens = mapeados.length;
            }
          } else if (itensRes.status !== 404) {
            errosBatch.push(`Itens ${externalId}: HTTP ${itensRes.status}`);
          }

          // ── PAGAMENTOS ───────────────────────────────────────────────────────
          const paymentEndpoint = isOs
            ? `${erpBaseUrl}/v2/serviceorder/${externalId}/payment`
            : `${erpBaseUrl}/v2/sale/${externalId}/payment`;

          const pgtoRes = await fetch(paymentEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
          });

          if (pgtoRes.ok) {
            const pgtoList = extrairArray<MaxDataPagamento>(await pgtoRes.json() as unknown);

            if (pgtoList.length > 0) {
              const mapeados = pgtoList.map((p) => ({
                loja_id: lojaId,
                venda_external_id: externalId,
                forma_pagamento: p.formaPgto ?? p.forma_pagamento ?? "Outra",
                valor: p.valor ?? 0,
                parcelas: p.qtdParcela ?? p.parcelas ?? 1,
              }));

              await adminClient
                .from("venda_pagamentos")
                .delete()
                .eq("loja_id", lojaId)
                .eq("venda_external_id", externalId);

              const { error } = await adminClient.from("venda_pagamentos").insert(mapeados);
              if (error) errosBatch.push(`Pgtos ${externalId}: ${error.message}`);
              else pgtos = mapeados.length;
            }
          } else if (pgtoRes.status !== 404) {
            errosBatch.push(`Pgtos ${externalId}: HTTP ${pgtoRes.status}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errosBatch.push(`Venda ${externalId}: ${msg}`);
        }

        return { itens, pgtos, erros: errosBatch };
      })
    );

    resultados.forEach((r) => {
      itensSincronizados += r.itens;
      pagamentosSincronizados += r.pgtos;
      erros.push(...r.erros);
    });

    // Pausa entre batches para não sobrecarregar a API MaxData
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return NextResponse.json({
    total_vendas: vendas?.length ?? 0,
    itens_sincronizados: itensSincronizados,
    pagamentos_sincronizados: pagamentosSincronizados,
    erros,
    offset,
    limit,
    // Indica se há mais vendas para processar (chamar novamente com offset += limit)
    tem_mais: (vendas?.length ?? 0) === limit,
  });
}

// Rota de re-sincronização de itens e pagamentos de vendas existentes
// Compensa syncs anteriores que não popularam venda_itens/venda_pagamentos
// Suporta paginação via ?offset=N&limit=N para evitar timeout em grandes lotes

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

  // Para cada venda, buscar itens e pagamentos na API MaxData e salvar no banco
  for (const venda of vendas ?? []) {
    const externalId = venda.external_id as number | string;
    // OS usa endpoint /serviceorder; vendas normais usam /sale
    const isOs = (venda.source as string | null) === "os";
    const itemsEndpoint = isOs
      ? `${erpBaseUrl}/v2/serviceorder/${externalId}/items`
      : `${erpBaseUrl}/v2/sale/${externalId}/items`;
    const paymentEndpoint = isOs
      ? `${erpBaseUrl}/v2/serviceorder/${externalId}/payment`
      : `${erpBaseUrl}/v2/sale/${externalId}/payment`;

    try {
      // ── ITENS DA VENDA ──────────────────────────────────────────────────────
      const itensRes = await fetch(itemsEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (itensRes.ok) {
        const itens = extrairArray<MaxDataItem>(await itensRes.json() as unknown);

        if (itens.length > 0) {
          const itensMapeados = itens.map((item) => ({
            loja_id: lojaId,
            venda_external_id: externalId,
            produto_external_id: item.produtoId ?? null,
            produto_nome: item.descricaoProduto ?? item.vdiProNome ?? "Produto",
            quantidade: item.qtde ?? item.vdiQtde ?? 0,
            valor_unitario: item.valor ?? item.vdiValor ?? 0,
            valor_desconto: item.valorDesconto ?? item.vdiValorDesconto ?? 0,
            valor_total: item.valorTotal ?? item.vdiValorTotal ?? 0,
          }));

          // Substituir itens antigos (delete + insert para garantir consistência)
          await adminClient
            .from("venda_itens")
            .delete()
            .eq("venda_external_id", externalId)
            .eq("loja_id", lojaId);

          const { error: insertErr } = await adminClient
            .from("venda_itens")
            .insert(itensMapeados);

          if (insertErr) {
            erros.push(`Itens venda ${externalId}: ${insertErr.message}`);
          } else {
            itensSincronizados += itensMapeados.length;
          }
        }
      } else if (itensRes.status !== 404) {
        // 404 é esperado para vendas sem itens — ignorar silenciosamente
        erros.push(`Itens venda ${externalId}: HTTP ${itensRes.status}`);
      }

      // ── PAGAMENTOS DA VENDA ─────────────────────────────────────────────────
      const pgtoRes = await fetch(paymentEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (pgtoRes.ok) {
        const pagamentos = extrairArray<MaxDataPagamento>(await pgtoRes.json() as unknown);

        if (pagamentos.length > 0) {
          const pgtosMapeados = pagamentos.map((p) => ({
            loja_id: lojaId,
            venda_external_id: externalId,
            forma_pagamento: p.formaPgto ?? p.forma_pagamento ?? "Outra",
            valor: p.valor ?? 0,
            parcelas: p.qtdParcela ?? p.parcelas ?? 1,
          }));

          await adminClient
            .from("venda_pagamentos")
            .delete()
            .eq("venda_external_id", externalId)
            .eq("loja_id", lojaId);

          const { error: insertErr } = await adminClient
            .from("venda_pagamentos")
            .insert(pgtosMapeados);

          if (insertErr) {
            erros.push(`Pagamentos venda ${externalId}: ${insertErr.message}`);
          } else {
            pagamentosSincronizados += pgtosMapeados.length;
          }
        }
      } else if (pgtoRes.status !== 404) {
        erros.push(`Pagamentos venda ${externalId}: HTTP ${pgtoRes.status}`);
      }

      // Pausa de 100ms para não sobrecarregar a API MaxData
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      erros.push(`Venda ${externalId}: ${msg}`);
    }
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

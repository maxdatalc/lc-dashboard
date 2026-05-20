// Sincronização histórica de vendas — roda no Node.js (Next.js)
// Busca um mês específico de vendas da API MaxData e salva no Supabase

import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface MesSyncResult {
  mes: string;    // formato 'YYYY-MM'
  vendas: number; // quantidade sincronizada
  erro?: string;
}

interface MaxDataVenda {
  id: number;
  abertura?: string;
  fechamento?: string;
  clienteId?: number;
  clienteNome?: string;
  valorTotalLiquidoProduto?: number;
  valorTotal?: number;
  totalNf?: number;
  vlrPago?: number;
  valorTotalDesconto?: number;
  status?: string;
}

interface PaginatedResponse {
  docs: MaxDataVenda[];
  pages: number;
  total: number;
}

export async function syncMesVendas(
  lojaId: string,
  ano: number,
  mes: number
): Promise<MesSyncResult> {
  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataInicial = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFinal = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  try {
    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);

    // Paginação manual — loop com fetch nativo do Node.js
    const results: MaxDataVenda[] = [];
    const MAX_PAGINAS = 60;

    for (let page = 1; page <= MAX_PAGINAS; page++) {
      // Sem filtro de status — salvamos o status real para que cancelamentos
      // históricos sejam refletidos corretamente no banco
      const url =
        `${config.baseUrl}/v2/sale` +
        `?dataInicial=${dataInicial}&dataFinal=${dataFinal}` +
        `&page=${page}&limit=50`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Erro na API MaxData: HTTP ${response.status}`);
      }

      const data = (await response.json()) as PaginatedResponse;

      if (!data.docs || data.docs.length === 0) break;

      results.push(...data.docs);

      if (page >= (data.pages ?? 1)) break;

      // Pausa entre páginas para não sobrecarregar a API da loja
      await new Promise((r) => setTimeout(r, 100));
    }

    if (results.length === 0) {
      return { mes: mesStr, vendas: 0 };
    }

    // Deduplicar por id mantendo a primeira ocorrência
    const seen = new Set<number>();
    const unicos = results.filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });

    const agora = new Date().toISOString();
    const rows = unicos.map((v) => ({
      loja_id: lojaId,
      external_id: v.id,
      numero_venda: String(v.id),
      data_venda: (v.fechamento ?? v.abertura ?? dataInicial).split("T")[0],
      cliente_external_id: v.clienteId ?? null,
      cliente_nome: v.clienteNome ?? null,
      valor_bruto: v.valorTotalLiquidoProduto ?? v.valorTotal ?? 0,
      valor_desconto: v.valorTotalDesconto ?? 0,
      valor_total: v.totalNf ?? v.vlrPago ?? 0,
      status: (v.status ?? "finalizada").toLowerCase(),
      sincronizado_em: agora,
    }));

    // Inserir em lotes de 200 para evitar payload grande
    const supabase = createAdminClient();
    const LOTE = 200;

    for (let i = 0; i < rows.length; i += LOTE) {
      const lote = rows.slice(i, i + LOTE);
      const { error } = await supabase
        .from("vendas")
        .upsert(lote, { onConflict: "loja_id,external_id" });

      if (error) throw new Error(`Erro ao salvar vendas: ${error.message}`);
    }

    return { mes: mesStr, vendas: unicos.length };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
    return { mes: mesStr, vendas: 0, erro: mensagem };
  }
}

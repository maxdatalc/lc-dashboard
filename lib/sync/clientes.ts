// Sincronização completa de clientes — roda no Node.js (Next.js)
// Busca todos os clientes da API MaxData e salva no Supabase

import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface ClienteSyncResult {
  total: number;
  erro?: string;
}

interface MaxDataCliente {
  id: number;
  nome?: string;
  nomeCliente?: string;
  cnpj?: string;
  cpf?: string;
  cpfCnpj?: string;
  email?: string;
  celular?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  enderecos?: { cidade?: string; uf?: string }[];
  ativo?: boolean;
}

interface PaginatedResponse {
  docs: MaxDataCliente[];
  pages: number;
  total: number;
}

// Remove pontuação de CPF/CNPJ para armazenar apenas dígitos
function normalizarDocumento(doc?: string | null): string | null {
  if (!doc) return null;
  const limpo = doc.replace(/[.\-\s/]/g, "").trim();
  return limpo || null;
}

export async function syncTodosClientes(lojaId: string): Promise<ClienteSyncResult> {
  try {
    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);

    // Paginação manual — loop com fetch nativo do Node.js
    const results: MaxDataCliente[] = [];
    const MAX_PAGINAS = 200;

    for (let page = 1; page <= MAX_PAGINAS; page++) {
      const url = `${config.baseUrl}/v2/client?page=${page}&limit=50`;

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
      return { total: 0 };
    }

    // Deduplicar por external_id mantendo a primeira ocorrência
    const seen = new Set<number>();
    const unicos = results.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    const agora = new Date().toISOString();
    const rows = unicos.map((c) => ({
      loja_id: lojaId,
      external_id: c.id,
      nome: c.nome ?? c.nomeCliente ?? "Sem nome",
      cnpj_cpf: normalizarDocumento(c.cnpj ?? c.cpf ?? c.cpfCnpj),
      email: c.email ?? null,
      telefone: c.celular ?? c.telefone ?? null,
      cidade: c.enderecos?.[0]?.cidade ?? null,
      estado: c.enderecos?.[0]?.uf ?? null,
      ativo: c.ativo ?? true,
      sincronizado_em: agora,
    }));

    // Inserir em lotes de 200 para evitar payload grande
    const supabase = createAdminClient();
    const LOTE = 200;

    for (let i = 0; i < rows.length; i += LOTE) {
      const lote = rows.slice(i, i + LOTE);
      const { error } = await supabase
        .from("clientes")
        .upsert(lote, { onConflict: "loja_id,external_id" });

      if (error) throw new Error(`Erro ao salvar clientes: ${error.message}`);
    }

    return { total: unicos.length };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
    return { total: 0, erro: mensagem };
  }
}

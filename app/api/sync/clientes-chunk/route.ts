// API route para sincronização de clientes em chunks paginados
// Suporta bases com 130.000+ registros sem timeout — cada chamada processa até 100 páginas

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";

interface MaxDataCliente {
  id: number;
  nome?: string;
  nomeCliente?: string;
  cpfCnpj?: string;
  email?: string;
  celular?: string;
  telefone?: string;
  enderecos?: { cidade?: string; uf?: string }[];
}

interface PaginatedResponse {
  docs: MaxDataCliente[];
  pages: number;
  total: number;
}

// Remove pontuação de CPF/CNPJ, retorna null se vazio
function normalizarDocumento(doc?: string | null): string | null {
  if (!doc) return null;
  const limpo = doc.replace(/[.\-\s/]/g, "").trim();
  return limpo || null;
}

const PAGINAS_POR_CHUNK = 100;
const LIMITE_POR_PAGINA = 50;
const DELAY_MS = 500; // respeitoso com o servidor da loja

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const lojaId = await getSelectedLojaId();
    if (!lojaId) {
      return NextResponse.json({ error: "Selecione uma loja" }, { status: 400 });
    }

    // Offset em itens — converter para página inicial
    const body = await req.json().catch(() => ({})) as { offset?: number };
    const offset = body.offset ?? 0;
    const startPage = Math.floor(offset / LIMITE_POR_PAGINA) + 1;

    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);
    const adminClient = createAdminClient();

    const resultados: MaxDataCliente[] = [];
    let totalPaginas = 1;
    let paginasNoChunk = 0;

    for (let i = 0; i < PAGINAS_POR_CHUNK; i++) {
      const page = startPage + i;
      const url = `${config.baseUrl}/v2/client?page=${page}&limit=${LIMITE_POR_PAGINA}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Erro na API MaxData: HTTP ${response.status}`);
      }

      const data = (await response.json()) as PaginatedResponse;

      // Capturar totalPaginas na primeira resposta do chunk
      if (i === 0) {
        totalPaginas = data.pages ?? 1;
      }

      if (!data.docs || data.docs.length === 0) break;

      resultados.push(...data.docs);
      paginasNoChunk++;

      if (page >= totalPaginas) break;

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    // Deduplicar por external_id antes do upsert
    const seen = new Set<number>();
    const unicos = resultados.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    if (unicos.length > 0) {
      const agora = new Date().toISOString();
      const rows = unicos.map((c) => ({
        loja_id: lojaId,
        external_id: c.id,
        nome: c.nome ?? c.nomeCliente ?? "Sem nome",
        cnpj_cpf: normalizarDocumento(c.cpfCnpj),
        email: c.email ?? null,
        telefone: c.celular ?? c.telefone ?? null,
        cidade: c.enderecos?.[0]?.cidade ?? null,
        estado: c.enderecos?.[0]?.uf ?? null,
        ativo: true,
        sincronizado_em: agora,
      }));

      // Upsert em lotes de 200 para evitar payload grande
      const LOTE = 200;
      for (let i = 0; i < rows.length; i += LOTE) {
        const { error } = await adminClient
          .from("clientes")
          .upsert(rows.slice(i, i + LOTE), { onConflict: "loja_id,external_id" });

        if (error) throw new Error(`Erro ao salvar clientes: ${error.message}`);
      }
    }

    const paginasProcessadas = startPage - 1 + paginasNoChunk;
    const proximoOffset = paginasProcessadas * LIMITE_POR_PAGINA;

    return NextResponse.json({
      success: true,
      sincronizados: unicos.length,
      totalPaginas,
      paginasProcessadas,
      concluido: paginasProcessadas >= totalPaginas,
      proximoOffset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

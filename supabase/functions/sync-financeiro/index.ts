// Edge Function sync-financeiro
// Sincroniza contas a receber da API MaxData por batch de clientes
// Usa sync_log como controle de offset para retomar entre invocações

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "./crypto.ts";
import { getMaxDataToken, maxdataGet } from "./maxdata-client.ts";

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
}

interface ClienteRow {
  id: string;
  external_id: number;
  nome: string;
  cnpj_cpf: string;
}

interface FinanceiroRecord {
  id?: number;
  valor?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  situacao?: string;
  clienteNome?: string;
  numDoc?: string;
  obs?: string;
}

// Valida CPF (11 dígitos) ou CNPJ (14 dígitos) e rejeita sequências triviais
function isDocumentoValido(doc: string): boolean {
  const limpo = doc.replace(/\D/g, "");
  if (limpo.length !== 11 && limpo.length !== 14) return false;
  // Rejeita documentos com todos os dígitos iguais (ex: 00000000000)
  if (limpo.split("").every((d) => d === limpo[0])) return false;
  return true;
}

// Helper para criar Response JSON padronizada
function resposta(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Buscar loja ativa
  const { data: lojas } = await supabase
    .from("lojas")
    .select("*")
    .eq("is_active", true);

  if (!lojas?.length) {
    return resposta({ processados: 0, msg: "Sem lojas ativas" });
  }

  const loja = lojas[0] as LojaRow;

  // 2. Descriptografar terminal e autenticar na API MaxData
  const terminal = await decrypt(loja.terminal_encrypted);
  const token = await getMaxDataToken({
    baseUrl: loja.erp_base_url,
    empId: loja.emp_id,
    terminal,
  });

  // 3. Determinar offset do batch atual usando sync_log como controle de estado
  const dataHoje = new Date().toISOString().split("T")[0];
  const chaveOffset = `financeiro_offset_${loja.id}_${dataHoje}`;

  const { data: offsetLog } = await supabase
    .from("sync_log")
    .select("total_registros")
    .eq("loja_id", loja.id)
    .eq("tabela", chaveOffset)
    .maybeSingle();

  const offset = offsetLog?.total_registros ?? 0;
  const BATCH_SIZE = 50;

  // 4. Buscar próximo batch de clientes com documento válido
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, external_id, nome, cnpj_cpf")
    .eq("loja_id", loja.id)
    .not("cnpj_cpf", "is", null)
    .neq("cnpj_cpf", "")
    .range(offset, offset + BATCH_SIZE - 1)
    .order("id");

  const clientesValidos = ((clientes ?? []) as ClienteRow[]).filter((c) =>
    isDocumentoValido(c.cnpj_cpf)
  );

  if (!clientesValidos.length) {
    // Remover controle de offset — sync do dia concluído
    await supabase
      .from("sync_log")
      .delete()
      .eq("loja_id", loja.id)
      .eq("tabela", chaveOffset);

    return resposta({
      processados: 0,
      msg: "Sync financeiro do dia completo",
      offset,
    });
  }

  // 5. Para cada cliente, buscar contas financeiras na API
  let totalRegistros = 0;
  const erros: string[] = [];

  for (const cliente of clientesValidos) {
    try {
      const cpfCnpjLimpo = cliente.cnpj_cpf.replace(/\D/g, "");

      const dados = await maxdataGet<FinanceiroRecord[]>(
        token,
        loja.erp_base_url,
        `/client/finance/list/${cpfCnpjLimpo}`
      );

      if (!Array.isArray(dados) || !dados.length) continue;

      const rows = dados
        .map((f) => ({
          loja_id: loja.id,
          external_id: f.id ?? 0,
          cliente_cnpj: cpfCnpjLimpo,
          cliente_nome: f.clienteNome ?? cliente.nome,
          tipo: "receber",
          valor: f.valor ?? 0,
          data_vencimento: f.dataVencimento?.split("T")[0] ?? dataHoje,
          data_pagamento: f.dataPagamento?.split("T")[0] ?? null,
          situacao: f.situacao ?? "aberto",
          sincronizado_em: new Date().toISOString(),
        }))
        .filter((r) => r.external_id > 0);

      if (!rows.length) continue;

      // Deduplicar por external_id mantendo a primeira ocorrência
      const seen = new Set<number>();
      const rowsUnicos = rows.filter((r) => {
        if (seen.has(r.external_id)) return false;
        seen.add(r.external_id);
        return true;
      });

      // DELETE + INSERT garante que boletos pagos (removidos da API) sejam apagados do banco
      // A API só retorna boletos em aberto — upsert deixaria registros pagos órfãos
      await supabase
        .from("financeiro")
        .delete()
        .eq("loja_id", loja.id)
        .eq("cliente_cnpj", cpfCnpjLimpo);

      const { error } = await supabase
        .from("financeiro")
        .insert(rowsUnicos);

      if (!error) totalRegistros += rowsUnicos.length;

      // Pausa entre clientes para não sobrecarregar a API da loja
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      erros.push(`${cliente.nome}: ${msg}`);
    }
  }

  // 6. Avançar o offset no sync_log para o próximo batch
  const novoOffset = offset + BATCH_SIZE;
  await supabase.from("sync_log").upsert(
    {
      loja_id: loja.id,
      tabela: chaveOffset,
      status: "em_andamento",
      total_registros: novoOffset,
      inicio: new Date().toISOString(),
    },
    { onConflict: "loja_id,tabela" }
  );

  return resposta({
    processados: clientesValidos.length,
    registros: totalRegistros,
    proximoOffset: novoOffset,
    erros: erros.length,
    msg: `Batch ${offset}–${novoOffset} concluído`,
  });
});

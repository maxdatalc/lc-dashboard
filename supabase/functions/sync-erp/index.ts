// Entry point da Edge Function sync-erp
// Itera sobre todas as lojas ativas e sincroniza vendas do ERP

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "./crypto.ts";
import { getMaxDataToken } from "./maxdata-client.ts";
import { syncVendas } from "./syncers.ts";

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
}

interface SyncLogEntry {
  id: string;
}

interface LojaResult {
  lojaId: string;
  status: "concluido" | "erro";
  vendas?: number;
  erro?: string;
  debug?: { isInicial: boolean; dataInicial: string; dataFinal: string }; // remover em produção
}

// Formata uma data com timezone de Brasília (UTC-3) para a API MaxData
// A API interpreta datas sem timezone como meia-noite UTC, perdendo vendas do dia
function toBrazilianISOString(date: Date): string {
  const offset = -3 * 60; // UTC-3 em minutos
  const localDate = new Date(date.getTime() + offset * 60 * 1000);
  return localDate.toISOString().replace("Z", "-03:00");
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Aceitar lojaId opcional no body — usado pelo sync manual para isolar a loja selecionada
  // Quando ausente (pg_cron), sincroniza todas as lojas ativas
  const body = await req.json().catch(() => ({}));
  const lojaIdFiltro: string | null = body.lojaId ?? null;

  // Buscar lojas ativas — filtrar por lojaId quando fornecido
  let lojasQuery = supabase.from("lojas").select("*").eq("is_active", true);
  if (lojaIdFiltro) {
    lojasQuery = lojasQuery.eq("id", lojaIdFiltro);
  }
  const { data: lojas, error: lojasError } = await lojasQuery;

  if (lojasError) {
    return new Response(
      JSON.stringify({ success: false, error: lojasError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const resultados: LojaResult[] = [];

  for (const loja of (lojas ?? []) as LojaRow[]) {
    console.log(`[sync-erp] Iniciando loja ${loja.id} (empId=${loja.emp_id})`);

    // Inserir registro de controle no sync_log
    const { data: logEntry } = await supabase
      .from("sync_log")
      .insert({ loja_id: loja.id, status: "em_andamento", inicio: new Date().toISOString() })
      .select("id")
      .single();

    const syncLogId = (logEntry as SyncLogEntry | null)?.id;

    try {
      // Descriptografar terminal e autenticar na API MaxData
      const terminal = await decrypt(loja.terminal_encrypted);
      const token = await getMaxDataToken({
        baseUrl: loja.erp_base_url,
        empId: loja.emp_id,
        terminal,
      });

      // Buscar o último sync bem-sucedido desta loja (aceita status com e sem acento)
      const { data: ultimoSyncRow } = await supabase
        .from("sync_log")
        .select("fim")
        .eq("loja_id", loja.id)
        .in("status", ["concluido", "concluído"])
        .not("fim", "is", null)
        .order("fim", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`[sync-erp] ultimoSync loja ${loja.id}:`, JSON.stringify(ultimoSyncRow));

      const agora = new Date();
      const isInicial = !ultimoSyncRow?.fim;

      let dataInicial: string;
      let dataFinal: string;

      if (isInicial) {
        // Sync inicial: buscar 1 ano de histórico a partir da meia-noite (Brasília)
        const umAnoAtras = new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000);
        dataInicial = toBrazilianISOString(new Date(umAnoAtras.setHours(0, 0, 0, 0)));
        dataFinal = toBrazilianISOString(agora);
      } else {
        // Sync incremental: desde o último sync com 1 hora de margem de segurança
        const ultimoFim = new Date(ultimoSyncRow!.fim);
        const comMargem = new Date(ultimoFim.getTime() - 60 * 60 * 1000);
        dataInicial = toBrazilianISOString(comMargem);
        dataFinal = toBrazilianISOString(agora);
      }

      console.log(
        `[sync-erp] Loja ${loja.id} (empId=${loja.emp_id}) — ` +
        `${isInicial ? "INICIAL" : "INCREMENTAL"} ` +
        `período: ${dataInicial} → ${dataFinal}`
      );

      // Sincronizar apenas vendas (produtos e clientes são sincronizados via rota dedicada)
      const totalVendas = await syncVendas(supabase, token, loja, dataInicial, dataFinal, isInicial);

      // Atualizar sync_log como concluído
      if (syncLogId) {
        await supabase
          .from("sync_log")
          .update({ status: "concluido", fim: new Date().toISOString(), total_registros: totalVendas })
          .eq("id", syncLogId);
      }

      console.log(`[sync-erp] Loja ${loja.id} concluída — vendas=${totalVendas}`);

      resultados.push({
        lojaId: loja.id,
        status: "concluido",
        vendas: totalVendas,
        debug: { isInicial, dataInicial, dataFinal }, // remover em produção
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[sync-erp] Erro na loja ${loja.id}:`, mensagem);

      // Registrar falha no sync_log sem interromper as outras lojas
      if (syncLogId) {
        await supabase
          .from("sync_log")
          .update({
            status: "erro",
            fim: new Date().toISOString(),
            erro: mensagem.substring(0, 500),
          })
          .eq("id", syncLogId);
      }

      resultados.push({ lojaId: loja.id, status: "erro", erro: mensagem });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      lojas_processadas: resultados.length,
      resultados,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

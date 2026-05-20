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
}

// Formata uma data para YYYY-MM-DD
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
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

      // Determinar janela de datas: inicial (30 dias) ou incremental (25 minutos)
      const { data: ultimoSync } = await supabase
        .from("sync_log")
        .select("id")
        .eq("loja_id", loja.id)
        .eq("status", "concluido")
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      const agora = new Date();
      const isInicial = !ultimoSync;

      const dataFinal = toDateString(agora);
      const dataInicial = isInicial
        ? toDateString(new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000))
        : toDateString(new Date(agora.getTime() - 25 * 60 * 1000));

      console.log(`[sync-erp] Loja ${loja.id} — ${isInicial ? "sync inicial" : "sync incremental"} (${dataInicial} → ${dataFinal})`);

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

      resultados.push({ lojaId: loja.id, status: "concluido", vendas: totalVendas });
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

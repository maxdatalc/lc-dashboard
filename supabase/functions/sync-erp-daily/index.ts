// Edge Function: sync-erp-daily
// Roda às 16:00 (horário de Brasília) via pg_cron — equivale a 19:00 UTC
// Busca vendas + pagamentos das últimas 24h + produtos atualizados (preços e custos)

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken } from "../sync-erp/maxdata-client.ts";
import { syncVendas, syncProdutosIncremental, syncVendedores, LojaRow } from "../sync-erp/syncers.ts";

// Estende LojaRow com campos necessários para autenticação
interface LojaCompleta extends LojaRow {
  terminal_encrypted: string;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("[sync-daily] Iniciando sync diário");

  // Buscar todas as lojas ativas
  const { data: lojas, error } = await supabase
    .from("lojas")
    .select("*")
    .eq("is_active", true);

  if (error || !lojas?.length) {
    console.log("[sync-daily] Nenhuma loja ativa");
    return new Response(
      JSON.stringify({ success: true, lojas: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const resultados: Array<{
    lojaId: string;
    status: "concluido" | "erro";
    vendas?: number;
    produtos?: number;
    vendedores?: number;
    erro?: string;
  }> = [];

  for (const loja of lojas as LojaCompleta[]) {
    console.log(`[sync-daily] Processando loja ${loja.id}`);

    try {
      const terminal = await decrypt(loja.terminal_encrypted);
      const token = await getMaxDataToken({
        baseUrl: loja.erp_base_url,
        empId: loja.emp_id,
        terminal,
      });

      // Sync vendas das últimas 24h (1440 minutos) — cobre cancelamentos e ajustes do dia
      const totalVendas = await syncVendas(
        supabase, token, loja,
        "", "", false,
        1440
      );

      // Sync produtos — atualiza preços, custos e estoque
      const totalProdutos = await syncProdutosIncremental(supabase, token, loja);

      // Sync vendedores — atualiza lista de atendentes para o dashboard
      const totalVendedores = await syncVendedores(supabase, token, loja);

      console.log(
        `[sync-daily] Loja ${loja.id}: ${totalVendas} vendas, ${totalProdutos} produtos, ${totalVendedores} vendedores`
      );

      resultados.push({
        lojaId: loja.id,
        status: "concluido",
        vendas: totalVendas,
        produtos: totalProdutos,
        vendedores: totalVendedores,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-daily] Erro loja ${loja.id}:`, msg);
      resultados.push({ lojaId: loja.id, status: "erro", erro: msg });
    }
  }

  return new Response(
    JSON.stringify({ success: true, lojas: resultados.length, resultados }),
    { headers: { "Content-Type": "application/json" } }
  );
});

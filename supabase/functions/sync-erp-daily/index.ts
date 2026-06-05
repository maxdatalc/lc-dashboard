// Edge Function: sync-erp-daily
// Roda às 19:00 (horário de Brasília) via pg_cron
// Resiliente: 3 tentativas com backoff de 5min se ERP estiver offline
// Janela estendida: cobre o dia atual + reprocessa dias com falha anterior

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken } from "../sync-erp/maxdata-client.ts";
import {
  syncVendas,
  syncProdutosIncremental,
  syncVendedores,
  LojaRow,
} from "../sync-erp/syncers.ts";
import { comRetry } from "../sync-erp/retry.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LojaCompleta extends LojaRow {
  terminal_encrypted: string;
}

interface ResultadoLoja {
  lojaId: string;
  status: "concluido" | "erro" | "parcial";
  vendas?: number;
  produtos?: number;
  vendedores?: number;
  tentativas?: number;
  erro?: string;
  janelasCobertas?: string[];
}

// Busca o último sync diário bem-sucedido desta loja
// Retorna null se nunca houve sync bem-sucedido
async function ultimoSyncDiarioBemSucedido(
  supabase: ReturnType<typeof createClient>,
  lojaId: string
): Promise<Date | null> {
  const { data } = await supabase
    .from("sync_log")
    .select("fim")
    .eq("loja_id", lojaId)
    .eq("tabela", "sync_daily")
    .in("status", ["concluido", "concluído"])
    .not("fim", "is", null)
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.fim ? new Date(data.fim) : null;
}

// Calcula as janelas de tempo que precisam ser sincronizadas
// Se houve falha nos dias anteriores, estende a janela para cobrir o gap
function calcularJanelas(ultimoSucesso: Date | null): Array<{ inicio: Date; fim: Date; label: string }> {
  const agora = new Date();
  const janelas: Array<{ inicio: Date; fim: Date; label: string }> = [];

  if (!ultimoSucesso) {
    // Nunca sincronizou — cobrir últimas 25h (margem de segurança)
    janelas.push({
      inicio: new Date(agora.getTime() - 25 * 60 * 60 * 1000),
      fim: agora,
      label: "últimas 25h (primeiro sync)",
    });
    return janelas;
  }

  const diffHoras = (agora.getTime() - ultimoSucesso.getTime()) / (1000 * 60 * 60);

  if (diffHoras <= 26) {
    // Caso normal: última sync foi ontem → cobrir 25h com margem
    janelas.push({
      inicio: new Date(ultimoSucesso.getTime() - 60 * 60 * 1000), // 1h de margem
      fim: agora,
      label: `desde último sync (${Math.round(diffHoras)}h atrás)`,
    });
  } else {
    // Gap detectado: ERP ficou offline por mais de 26h
    // Quebrar em janelas de 24h para não sobrecarregar
    console.log(`[sync-daily] Gap de ${Math.round(diffHoras)}h detectado — cobrindo em janelas`);

    let cursor = new Date(ultimoSucesso.getTime() - 60 * 60 * 1000);
    let janela = 1;

    while (cursor < agora) {
      const fimJanela = new Date(Math.min(
        cursor.getTime() + 25 * 60 * 60 * 1000,
        agora.getTime()
      ));
      janelas.push({
        inicio: cursor,
        fim: fimJanela,
        label: `janela ${janela} (gap recovery)`,
      });
      cursor = fimJanela;
      janela++;
    }
  }

  return janelas;
}

function toISO(date: Date): string {
  const offset = -3 * 60;
  const local = new Date(date.getTime() + offset * 60 * 1000);
  return local.toISOString().replace("Z", "-03:00");
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("[sync-daily] Iniciando sync diário resiliente");

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

  const resultados: ResultadoLoja[] = [];

  for (const loja of lojas as LojaCompleta[]) {
    console.log(`[sync-daily] Processando loja ${loja.id}`);

    // Registrar início no log
    const { data: logEntry } = await supabase
      .from("sync_log")
      .insert({
        loja_id: loja.id,
        tabela: "sync_daily",
        status: "em_andamento",
        inicio: new Date().toISOString(),
      })
      .select("id")
      .single();

    const logId = logEntry?.id;

    try {
      // ── Autenticar com retry ──────────────────────────────────────────────
      // Se ERP estiver offline na autenticação, tentar 3x com 5min de intervalo
      let token: string;
      let tentativasAuth = 0;

      token = await comRetry(
        async () => {
          const terminal = await decrypt(loja.terminal_encrypted);
          return getMaxDataToken({
            baseUrl: loja.erp_base_url,
            empId: loja.emp_id,
            terminal,
          });
        },
        {
          tentativas: 3,
          intervaloMs: 5 * 60 * 1000, // 5 minutos entre tentativas
          onTentativa: (n, erro) => {
            tentativasAuth = n;
            console.warn(
              `[sync-daily] Loja ${loja.id} — auth tentativa ${n}/3 falhou: ${erro}`
            );
          },
        }
      );

      console.log(
        `[sync-daily] Loja ${loja.id} autenticada` +
        (tentativasAuth > 1 ? ` (após ${tentativasAuth} tentativas)` : "")
      );

      // ── Calcular janelas de tempo a cobrir ────────────────────────────────
      const ultimoSucesso = await ultimoSyncDiarioBemSucedido(supabase, loja.id);
      const janelas = calcularJanelas(ultimoSucesso);

      console.log(
        `[sync-daily] Loja ${loja.id} — ${janelas.length} janela(s): ` +
        janelas.map((j) => j.label).join(", ")
      );

      let totalVendas = 0;
      const janelasCobertas: string[] = [];

      // ── Processar cada janela com retry ───────────────────────────────────
      for (const janela of janelas) {
        const dataInicial = toISO(janela.inicio);
        const dataFinal = toISO(janela.fim);
        const diffMin = Math.round((janela.fim.getTime() - janela.inicio.getTime()) / 60000);

        console.log(
          `[sync-daily] Loja ${loja.id} — processando ${janela.label}: ` +
          `${dataInicial} → ${dataFinal} (${diffMin}min)`
        );

        const vendasJanela = await comRetry(
          () => syncVendas(
            supabase, token, loja,
            dataInicial, dataFinal,
            false, // nunca isInicial no daily — usa filtro de data sempre
            diffMin
          ),
          {
            tentativas: 3,
            intervaloMs: 5 * 60 * 1000,
            onTentativa: (n, erro) => {
              console.warn(
                `[sync-daily] Loja ${loja.id} janela "${janela.label}" ` +
                `tentativa ${n}/3 falhou: ${erro}`
              );
            },
          }
        );

        totalVendas += vendasJanela;
        janelasCobertas.push(janela.label);

        // Pequena pausa entre janelas para não sobrecarregar ERP
        if (janelas.indexOf(janela) < janelas.length - 1) {
          await sleep(2000);
        }
      }

      // ── Produtos e vendedores com retry ───────────────────────────────────
      const totalProdutos = await comRetry(
        () => syncProdutosIncremental(supabase, token, loja),
        {
          tentativas: 3,
          intervaloMs: 5 * 60 * 1000,
          onTentativa: (n, erro) =>
            console.warn(`[sync-daily] Produtos loja ${loja.id} tentativa ${n}/3: ${erro}`),
        }
      );

      const totalVendedores = await comRetry(
        () => syncVendedores(supabase, token, loja),
        {
          tentativas: 3,
          intervaloMs: 5 * 60 * 1000,
          onTentativa: (n, erro) =>
            console.warn(`[sync-daily] Vendedores loja ${loja.id} tentativa ${n}/3: ${erro}`),
        }
      );

      // ── Marcar sync como concluído ────────────────────────────────────────
      if (logId) {
        await supabase
          .from("sync_log")
          .update({
            status: "concluido",
            fim: new Date().toISOString(),
            total_registros: totalVendas,
          })
          .eq("id", logId);
      }

      console.log(
        `[sync-daily] Loja ${loja.id} CONCLUÍDO — ` +
        `vendas=${totalVendas} produtos=${totalProdutos} vendedores=${totalVendedores}`
      );

      resultados.push({
        lojaId: loja.id,
        status: "concluido",
        vendas: totalVendas,
        produtos: totalProdutos,
        vendedores: totalVendedores,
        tentativas: tentativasAuth,
        janelasCobertas,
      });

    } catch (err) {
      // Chegou aqui = 3 tentativas esgotadas em alguma etapa crítica
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-daily] Loja ${loja.id} FALHOU após todas as tentativas:`, msg);

      // Marcar como erro para que a próxima execução do daily detecte o gap
      // e reprocesse automaticamente via calcularJanelas()
      if (logId) {
        await supabase
          .from("sync_log")
          .update({
            status: "erro",
            fim: new Date().toISOString(),
            erro: msg.substring(0, 500),
          })
          .eq("id", logId);
      }

      resultados.push({
        lojaId: loja.id,
        status: "erro",
        erro: msg,
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      lojas: resultados.length,
      resultados,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

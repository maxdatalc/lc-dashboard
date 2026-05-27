// Edge Function: sync-erp-inicial
// Processa UM mês de vendas por invocação.
// Chamada sequencialmente pelo frontend (SyncInicialModal) até completar 13 meses.
// Itens e pagamentos por venda são omitidos aqui — o sync incremental os preenche.

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken, fetchAllPages } from "../sync-erp/maxdata-client.ts";

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
  sync_services_enabled: boolean;
}

interface MaxDataVenda {
  id: number;
  cfop?: number;
  abertura?: string;
  fechamento?: string;
  clienteId?: number;
  clienteNome?: string;
  cpfCnpj?: string;
  valorTotalLiquidoProduto?: number;
  valorTotal?: number;
  totalNf?: number;
  vlrPago?: number;
  valorTotalDesconto?: number;
  status?: string;
}

interface CfopRow {
  cfop: number;
  tipo: string;
  subtipo: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toBrazilianISOString(date: Date): string {
  const offset = -3 * 60;
  const local = new Date(date.getTime() + offset * 60 * 1000);
  return local.toISOString().replace("Z", "-03:00");
}

Deno.serve(async (req) => {
  try {
    const body = await req.json() as {
      lojaId: string;
      mes: string;
      chunkAtual: number;
      totalChunks: number;
    };
    const { lojaId, mes, chunkAtual, totalChunks } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar dados da loja
    const { data: loja, error: lojaError } = await supabase
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted, sync_services_enabled")
      .eq("id", lojaId)
      .single();

    if (lojaError || !loja) {
      return new Response(
        JSON.stringify({ error: "Loja não encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const lojaRow = loja as LojaRow;

    // 2. Autenticar na API MaxData
    const terminal = await decrypt(lojaRow.terminal_encrypted);
    const token = await getMaxDataToken({
      baseUrl: lojaRow.erp_base_url,
      empId: lojaRow.emp_id,
      terminal,
    });

    // 3. Calcular range do mês alvo
    const [ano, mesNum] = mes.split("-").map(Number);
    const inicio = new Date(ano, mesNum - 1, 1, 0, 0, 0);
    const fim = new Date(ano, mesNum, 0, 23, 59, 59); // último dia do mês

    const dataInicial = toBrazilianISOString(inicio);
    const dataFinal = toBrazilianISOString(fim);

    console.log(
      `[sync-inicial] chunk ${chunkAtual}/${totalChunks} — ` +
      `${mes} (${dataInicial} → ${dataFinal})`
    );

    // 4. Buscar vendas (tenta filtro de data, fallback sem filtro + filtro JS)
    let vendas = await fetchAllPages<MaxDataVenda>(
      token,
      lojaRow.erp_base_url,
      "/sale",
      { dataInicial, dataFinal },
      300 // máx 300 páginas × 50 = 15.000 vendas por mês
    );

    if (vendas.length === 0) {
      console.log(`[sync-inicial] ${mes}: filtro de data retornou 0 — buscando sem filtro e filtrando no JS`);
      const todas = await fetchAllPages<MaxDataVenda>(
        token,
        lojaRow.erp_base_url,
        "/sale",
        {},
        300
      );
      vendas = todas.filter((v) => {
        const raw = v.fechamento ?? v.abertura;
        if (!raw) return false;
        const d = new Date(raw);
        return d.getFullYear() === ano && (d.getMonth() + 1) === mesNum;
      });
    }

    console.log(`[sync-inicial] ${mes}: ${vendas.length} vendas encontradas`);

    // 5. Buscar mapa de CFOPs
    const { data: cfopRows } = await supabase
      .from("cfop_classificacoes")
      .select("cfop, tipo, subtipo");

    const cfopMap = new Map<number, { tipo: string; subtipo: string | null }>(
      ((cfopRows ?? []) as CfopRow[]).map((r) => [
        r.cfop,
        { tipo: r.tipo, subtipo: r.subtipo },
      ])
    );

    // 6. Mapear, deduplicar e salvar vendas em lotes de 200
    let vendasSalvasNesteMes = 0;

    if (vendas.length > 0) {
      const agora = new Date().toISOString();

      const rows = vendas.map((v) => {
        const cl = v.cfop ? cfopMap.get(v.cfop) : undefined;
        return {
          loja_id: lojaId,
          external_id: v.id,
          source: "sale",
          numero_venda: String(v.id),
          data_venda: (v.fechamento ?? v.abertura ?? dataInicial).split("T")[0],
          cliente_external_id: v.clienteId ?? null,
          cliente_nome: v.clienteNome ?? null,
          cpf_cnpj: v.cpfCnpj ?? null,
          valor_bruto: v.valorTotalLiquidoProduto ?? v.valorTotal ?? 0,
          valor_desconto: v.valorTotalDesconto ?? 0,
          valor_total: v.totalNf ?? v.vlrPago ?? 0,
          status: (v.status ?? "finalizada").toLowerCase(),
          cfop: v.cfop ?? null,
          tipo: cl?.tipo ?? "outro",
          subtipo: cl?.subtipo ?? null,
          sincronizado_em: agora,
        };
      });

      // Deduplicar por external_id (mantém primeira ocorrência)
      const seen = new Set<number>();
      const unicos = rows.filter((r) => {
        if (seen.has(r.external_id)) return false;
        seen.add(r.external_id);
        return true;
      });

      for (let i = 0; i < unicos.length; i += 200) {
        const lote = unicos.slice(i, i + 200);
        const { error } = await supabase
          .from("vendas")
          .upsert(lote, { onConflict: "loja_id,external_id,source" });
        if (error) throw new Error(error.message);
        await sleep(50);
      }

      vendasSalvasNesteMes = unicos.length;
    }

    // 7. Sincronizar Ordens de Serviço do mês (se habilitado para esta loja)
    if (lojaRow.sync_services_enabled) {
      console.log(`[sync-inicial] Loja ${lojaId}: buscando ordens de serviço para ${mes}`);

      let todasOs = await fetchAllPages<Record<string, unknown>>(
        token,
        lojaRow.erp_base_url,
        "/serviceorder",
        { dataInicial, dataFinal },
        300
      );

      // Fallback sem filtro de data se retornou 0
      if (todasOs.length === 0) {
        const todas = await fetchAllPages<Record<string, unknown>>(
          token,
          lojaRow.erp_base_url,
          "/serviceorder",
          {},
          300
        );
        todasOs = todas.filter((os) => {
          const raw = (os.dataFechamento ?? os.dataAbertura) as string | undefined;
          if (!raw) return false;
          const d = new Date(raw);
          return d.getFullYear() === ano && (d.getMonth() + 1) === mesNum;
        });
      }

      console.log(`[sync-inicial] ${mes}: ${todasOs.length} OS encontradas`);

      if (todasOs.length > 0) {
        const agora = new Date().toISOString();

        interface OsRow {
          loja_id: string;
          external_id: number;
          numero_venda: string;
          data_venda: string;
          cliente_external_id: number | null;
          cliente_nome: string | null;
          cpf_cnpj: string | null;
          valor_bruto: number;
          valor_desconto: number;
          valor_total: number;
          status: string;
          cfop: number;
          tipo: string;
          subtipo: string;
          source: string;
          os_equipamento: string | null;
          os_placa: string | null;
          sincronizado_em: string;
        }

        const osRows: OsRow[] = todasOs.map((os) => ({
          loja_id: lojaId,
          external_id: os.id as number,
          numero_venda: `OS-${os.id as number}`,
          data_venda: ((os.dataFechamento ?? os.dataAbertura ?? dataInicial) as string).split("T")[0],
          cliente_external_id: (os.clienteId as number) ?? null,
          cliente_nome: (os.clienteNome as string) ?? null,
          cpf_cnpj: (os.cpf as string) ?? null,
          valor_bruto: (os.totalNf ?? os.valorTotalServico ?? 0) as number,
          valor_desconto: (os.valorTotalDesconto ?? 0) as number,
          valor_total: (os.totalNf ?? os.valorTotalServico ?? 0) as number,
          status: ((os.status ?? os.statusOs ?? "pendente") as string).toLowerCase(),
          cfop: 5933, // ISSQN padrão para serviços
          tipo: "venda",
          subtipo: "servico",
          source: "os",
          os_equipamento: (os.equipamento as string) ?? null,
          os_placa: (os.placa as string) ?? null,
          sincronizado_em: agora,
        }));

        // Deduplicar por external_id
        const seenOs = new Set<number>();
        const osUnicos = osRows.filter((r) => {
          if (seenOs.has(r.external_id)) return false;
          seenOs.add(r.external_id);
          return true;
        });

        for (let i = 0; i < osUnicos.length; i += 200) {
          const lote = osUnicos.slice(i, i + 200);
          const { error: osErr } = await supabase
            .from("vendas")
            .upsert(lote, { onConflict: "loja_id,external_id,source" });
          // Erros em OS não interrompem o sync — apenas loga
          if (osErr) console.error(`[sync-inicial] Erro ao salvar OS lote ${i}:`, osErr.message);
          await sleep(50);
        }

        // Sincronizar itens que vêm embutidos no objeto OS
        for (const os of todasOs) {
          const osExternalId = os.id as number;
          const itens = os.itens as Array<Record<string, unknown>> | undefined;
          if (!itens || itens.length === 0) continue;

          const itensMapped = itens.map((item) => ({
            loja_id: lojaId,
            venda_external_id: osExternalId,
            produto_external_id: (item.produtoId as number) ?? null,
            produto_nome: (item.produtoDescricao as string) ?? "Serviço",
            quantidade: (item.qtde as number) ?? 0,
            valor_unitario: (item.valor as number) ?? 0,
            valor_desconto: (item.desconto ?? item.valorDesconto ?? 0) as number,
            valor_total: ((item.qtde as number) ?? 0) * ((item.valor as number) ?? 0),
          }));

          await supabase
            .from("venda_itens")
            .upsert(itensMapped, { onConflict: "loja_id,venda_external_id,produto_external_id" });
          await sleep(100);
        }

        vendasSalvasNesteMes += osUnicos.length;
      }
    }

    // 8. (era 7) Calcular próximo mês e verificar se concluiu
    const proxData = new Date(ano, mesNum, 1); // mês seguinte
    const proximoMes =
      `${proxData.getFullYear()}-${String(proxData.getMonth() + 1).padStart(2, "0")}`;

    const hoje = new Date();
    const mesAtualStr =
      `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const concluido = mes >= mesAtualStr;

    // 8. Contar total de vendas salvas para esta loja
    const { count: totalVendasSalvas } = await supabase
      .from("vendas")
      .select("id", { count: "exact", head: true })
      .eq("loja_id", lojaId);

    // 9. Atualizar progresso no sync_inicial
    await supabase
      .from("sync_inicial")
      .update({
        status: concluido ? "concluido" : "em_andamento",
        chunk_atual: chunkAtual,
        mes_atual: mes,
        vendas_salvas: totalVendasSalvas ?? 0,
        atualizado_em: new Date().toISOString(),
        ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
      })
      .eq("loja_id", lojaId);

    return new Response(
      JSON.stringify({
        mes_processado: mes,
        vendas_salvas: vendasSalvasNesteMes,
        proximo_mes: concluido ? null : proximoMes,
        concluido,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-inicial] Erro:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

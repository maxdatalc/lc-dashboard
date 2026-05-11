// API route para sincronização manual — dispara sync-erp e sync-financeiro em paralelo
// Throttle de 5 minutos por loja para evitar sobrecarga da API MaxData

import { NextResponse, NextRequest } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  try {
    // 1. Verificar loja selecionada
    const lojaId = await getSelectedLojaId();
    if (!lojaId) {
      return NextResponse.json({ error: "Selecione uma loja" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 2. Verificar throttle — impedir sync se houve um nos últimos 5 minutos
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentSync } = await supabase
      .from("sync_log")
      .select("inicio")
      .eq("loja_id", lojaId)
      .eq("tabela", "manual_sync")
      .gte("inicio", cincoMinAtras)
      .maybeSingle();

    if (recentSync) {
      const segundosRestantes = Math.ceil(
        (new Date(recentSync.inicio).getTime() + 5 * 60 * 1000 - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: "Aguarde", segundosRestantes },
        { status: 429 }
      );
    }

    // 3. Registrar início do sync manual no log
    await supabase.from("sync_log").insert({
      loja_id: lojaId,
      tabela: "manual_sync",
      status: "em_andamento",
      inicio: new Date().toISOString(),
    });

    // 4. Resetar offset financeiro para forçar resync completo do dia
    const hojeStr = new Date().toISOString().split("T")[0];
    await supabase
      .from("sync_log")
      .delete()
      .eq("loja_id", lojaId)
      .like("tabela", `financeiro_offset_%${hojeStr}%`);

    // 5. Configurar headers para chamada às Edge Functions
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 6. Disparar sync-erp e sync-financeiro em paralelo
    const [erpResult, finResult] = await Promise.allSettled([
      fetch(`${supabaseUrl}/functions/v1/sync-erp`, {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(120_000),
      }).then((r) => r.json()),
      fetch(`${supabaseUrl}/functions/v1/sync-financeiro`, {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(60_000),
      }).then((r) => r.json()),
    ]);

    // 7. Marcar sync como concluído no log
    await supabase
      .from("sync_log")
      .update({ status: "concluido", fim: new Date().toISOString() })
      .eq("loja_id", lojaId)
      .eq("tabela", "manual_sync");

    // 8. Consolidar resposta
    const erpData = erpResult.status === "fulfilled" ? erpResult.value : null;
    const finData = finResult.status === "fulfilled" ? finResult.value : null;

    return NextResponse.json({
      success: true,
      vendas: erpData?.resultados?.[0]?.vendas ?? 0,
      contasProcessadas: finData?.processados ?? 0,
      registrosFinanceiros: finData?.registros ?? 0,
      sincronizadoEm: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

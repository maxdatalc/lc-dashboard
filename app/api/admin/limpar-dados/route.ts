// Rota de limpeza de dados sincronizados de uma loja
// Exige autenticação como system admin e confirmação textual explícita

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    // 2. Validar body
    const body = await req.json() as { lojaId?: string; confirmacao?: string };
    const { lojaId, confirmacao } = body;

    if (!lojaId) {
      return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });
    }

    if (confirmacao !== "LIMPAR DADOS") {
      return NextResponse.json(
        { error: "Confirmação inválida. Digite exatamente: LIMPAR DADOS" },
        { status: 400 }
      );
    }

    // 3. Verificar se loja existe
    const adminClient = createAdminClient();
    const { data: loja } = await adminClient
      .from("lojas")
      .select("id, name, tenant_id")
      .eq("id", lojaId)
      .maybeSingle();

    if (!loja) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // 4. Deletar em ordem respeitando FKs
    // venda_pagamentos → venda_itens → vendas → financeiro → clientes → sync_log → sync_inicial
    const resultados: Record<string, number> = {
      venda_pagamentos: 0,
      venda_itens: 0,
      vendas: 0,
      financeiro: 0,
      clientes: 0,
      sync_log: 0,
      sync_inicial: 0,
    };

    const deletar = async (tabela: string) => {
      const { error, count } = await adminClient
        .from(tabela)
        .delete()
        .eq("loja_id", lojaId);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      resultados[tabela] = count ?? 0;
    };

    await deletar("venda_pagamentos");
    await deletar("venda_itens");
    await deletar("vendas");

    // financeiro e clientes podem não existir em todas as instâncias
    try { await deletar("financeiro"); } catch {}
    try { await deletar("clientes"); } catch {}

    await deletar("sync_log");
    await deletar("sync_inicial");

    // Log de auditoria (sem PII — apenas IDs e contagens)
    const lojaRow = loja as { id: string; name: string };
    console.log(
      `[limpar-dados] userId=${user.id} limpou loja=${lojaRow.name} (${lojaId})`,
      resultados
    );

    return NextResponse.json({
      sucesso: true,
      loja: lojaRow.name,
      executado_em: new Date().toISOString(),
      registros_deletados: resultados,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[limpar-dados] Erro:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

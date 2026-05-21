// API route para o sync inicial por mês
// POST — inicializa o controle e proxy para a Edge Function sync-erp-inicial
// GET  — retorna o status atual do sync de uma loja específica

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

// ── POST: processa um chunk (mês) ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // 2. Parsear corpo
    const body = await req.json() as {
      lojaId: string;
      mes: string;
      chunkAtual: number;
      totalChunks: number;
    };
    const { lojaId, mes, chunkAtual, totalChunks } = body;

    if (!lojaId || !mes || !chunkAtual || !totalChunks) {
      return NextResponse.json({ error: "Campos obrigatórios: lojaId, mes, chunkAtual, totalChunks" }, { status: 400 });
    }

    // 3. No primeiro chunk: inicializar registro de controle no sync_inicial
    if (chunkAtual === 1) {
      const adminClient = createAdminClient();
      await adminClient.from("sync_inicial").upsert(
        {
          loja_id: lojaId,
          status: "em_andamento",
          chunk_atual: 0,
          total_chunks: totalChunks,
          mes_atual: mes,
          vendas_salvas: 0,
          erros: null,
          iniciado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "loja_id" }
      );
    }

    // 4. Chamar a Edge Function sync-erp-inicial
    const efResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-erp-inicial`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lojaId, mes, chunkAtual, totalChunks }),
      }
    );

    if (!efResponse.ok) {
      const errText = await efResponse.text();
      // Registrar erro no sync_inicial
      const adminClient = createAdminClient();
      await adminClient
        .from("sync_inicial")
        .update({ status: "erro", erros: errText.substring(0, 500), atualizado_em: new Date().toISOString() })
        .eq("loja_id", lojaId);
      return NextResponse.json({ error: `Edge Function: ${errText}` }, { status: 502 });
    }

    const data = await efResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET: retorna status atual do sync de uma loja ─────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const lojaId = req.nextUrl.searchParams.get("lojaId");
    if (!lojaId) return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("sync_inicial")
      .select("*")
      .eq("loja_id", lojaId)
      .maybeSingle();

    return NextResponse.json(data ?? { status: "pendente" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

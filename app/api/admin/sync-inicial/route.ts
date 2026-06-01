// API route para o sync inicial por mês
// POST — inicializa o controle e proxy para a Edge Function sync-erp-inicial
// GET  — retorna o status atual do sync de uma loja específica

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

// ── POST: processa um período (semana) ───────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // 2. Parsear corpo — novo formato: semana por semana
    const body = await req.json() as {
      lojaId: string;
      dataInicial: string; // "YYYY-MM-DD"
      dataFinal: string;   // "YYYY-MM-DD"
    };
    const { lojaId, dataInicial, dataFinal } = body;

    if (!lojaId || !dataInicial || !dataFinal) {
      return NextResponse.json(
        { error: "Campos obrigatórios: lojaId, dataInicial, dataFinal" },
        { status: 400 }
      );
    }

    // 3. Chamar a Edge Function sync-erp-inicial
    console.log("[sync-inicial] Chamando Edge Function com:", { lojaId, dataInicial, dataFinal });

    const efResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-erp-inicial`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lojaId, dataInicial, dataFinal }),
      }
    );

    console.log("[sync-inicial] Status da resposta:", efResponse.status);
    const responseText = await efResponse.text();
    console.log("[sync-inicial] Body da resposta:", responseText);

    if (!efResponse.ok) {
      return NextResponse.json({ error: `Edge Function: ${responseText}` }, { status: 502 });
    }

    const data = JSON.parse(responseText) as unknown;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[sync-inicial] Erro completo:", err);
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

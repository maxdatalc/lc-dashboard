// API route para o sync inicial por mês
// POST — inicializa o controle e proxy para a Edge Function sync-erp-inicial
// GET  — retorna o status atual do sync de uma loja específica

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

// ── POST: proxy para sync-direto (Next.js nativo, sem Edge Function) ─────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Redirecionar para sync-direto que processa sem Edge Function
    const res = await fetch(
      new URL("/api/admin/sync-direto", req.url).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Repassar cookies de sessão para autenticação na rota destino
          Cookie: req.headers.get("cookie") ?? "",
        },
        body,
      }
    );

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
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

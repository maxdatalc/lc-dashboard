/**
 * POST /api/sieg/sync
 *
 * Dispara a sincronização de XMLs para o SIEG.
 * Pode ser chamado:
 *   - Pelo Vercel Cron (header Authorization: Bearer {CRON_SECRET})
 *   - Manualmente pelo admin/dashboard (com sessão autenticada)
 *
 * Body JSON opcional:
 *   { lojaId?: string, empId?: number }
 *   → se omitido, sincroniza todas as lojas/empresas ativas
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executarSyncSieg } from "@/lib/sieg/sieg-sync";

async function verificarAutorizacao(req: NextRequest): Promise<boolean> {
  // Cron: Bearer CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Sessão de usuário admin autenticado via Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const cookieHeader = req.headers.get("cookie") ?? "";
  const { data: { user } } = await supabase.auth.getUser(
    cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1] ?? "",
  );
  if (!user) return false;

  const { data: u } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  return u?.role === "admin";
}

export async function POST(req: NextRequest) {
  const autorizado = await verificarAutorizacao(req);
  if (!autorizado) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  let lojaId: string | undefined;
  let empId: number | undefined;
  try {
    const body = await req.json() as { lojaId?: string; empId?: number };
    lojaId = body.lojaId;
    empId  = body.empId;
  } catch {
    // body vazio — sincroniza tudo
  }

  try {
    const resultados = await executarSyncSieg(lojaId, empId);

    const totalEnviados  = resultados.reduce((s, r) => s + r.enviados,  0);
    const totalErros     = resultados.reduce((s, r) => s + r.erros,     0);
    const totalIgnorados = resultados.reduce((s, r) => s + r.ignorados, 0);

    return NextResponse.json({
      ok: true,
      empresas: resultados.length,
      totalEnviados,
      totalErros,
      totalIgnorados,
      detalhes: resultados,
    });
  } catch (err) {
    console.error("[sieg/sync] Erro crítico:", err);
    return NextResponse.json(
      { ok: false, erro: (err as Error).message },
      { status: 500 },
    );
  }
}

// Vercel Cron — GET alternativo para compatibilidade com vercel.json crons
export async function GET(req: NextRequest) {
  return POST(req);
}

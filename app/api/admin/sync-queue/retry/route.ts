// Rota para resetar jobs com erro de volta para pendente
// O pg_cron retoma de onde parou (offset/pagina_atual preservados)

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { lojaId } = await req.json() as { lojaId: string };
    if (!lojaId) return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });

    const adminClient = createAdminClient();

    // Resetar jobs com erro para pendente — retoma do offset/pagina_atual salvo
    const { data, error } = await adminClient
      .from("sync_queue")
      .update({
        status: "pendente",
        erro: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("loja_id", lojaId)
      .eq("status", "erro")
      .select("id, tipo");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resetados = data?.length ?? 0;

    return NextResponse.json({
      sucesso: true,
      resetados,
      mensagem: `${resetados} job(s) resetados. Retomando em até 1 minuto.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

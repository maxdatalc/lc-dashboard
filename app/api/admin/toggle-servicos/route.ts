// Ativa ou desativa sync_services_enabled para uma loja
// POST — exige autenticação como system admin

import { NextResponse, NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await req.json() as { lojaId: string; valor: boolean };
    const { lojaId, valor } = body;

    if (!lojaId || typeof valor !== "boolean") {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("lojas")
      .update({ sync_services_enabled: valor })
      .eq("id", lojaId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[toggle-servicos] Loja ${lojaId}: sync_services_enabled = ${valor}`);

    // Revalidar cache para refletir o novo estado em recargas do Server Component
    revalidatePath("/admin/clientes", "layout");

    return NextResponse.json({ sucesso: true, lojaId, valor });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

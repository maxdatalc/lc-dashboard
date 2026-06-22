import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { updateClienteBase } from "@/lib/db/clientes-base";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, string | null>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const allowed = ["codigo_externo", "razao_social", "nome_fantasia", "cnpj_cpf", "segmento", "cidade", "telefone"];
  const updates: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  try {
    await updateClienteBase(id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { getLojaAdmin } from "@/lib/db/tenants";
import { clientIpFromHeaders } from "@/lib/api/request-meta";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const loja = await getLojaAdmin(id);
  if (!loja || !loja.bridgeToken) {
    return NextResponse.json({ error: "Token não configurado" }, { status: 404 });
  }

  // Fail-closed: sem auditoria gravada, não revela o token.
  const supabaseAdmin = createAdminClient();
  const { error: auditError } = await supabaseAdmin
    .from("bridge_token_reveals")
    .insert({
      loja_id: loja.id,
      tenant_id: loja.tenantId,
      actor_id: user.id,
      ip: clientIpFromHeaders(req.headers),
      user_agent: req.headers.get("user-agent"),
    });

  if (auditError) {
    return NextResponse.json({ error: "Falha ao registrar auditoria" }, { status: 500 });
  }

  return NextResponse.json(
    { token: loja.bridgeToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}

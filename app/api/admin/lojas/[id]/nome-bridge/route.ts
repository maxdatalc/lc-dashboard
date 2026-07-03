import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: loja, error } = await supabaseAdmin
    .from("lojas")
    .select("emp_id, sql_bridge_url, sql_bridge_token, sql_enabled")
    .eq("id", id)
    .maybeSingle();

  if (error || !loja) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const l = loja as { emp_id: number; sql_bridge_url: string | null; sql_bridge_token: string | null; sql_enabled: boolean };

  if (!l.sql_enabled || !l.sql_bridge_url || !l.sql_bridge_token) {
    return NextResponse.json({ error: "Bridge não configurada para esta loja" }, { status: 400 });
  }

  const token = decrypt(l.sql_bridge_token);

  try {
    const rows = await queryBridge<{ cofEmpApelido: string }>(
      { bridgeUrl: l.sql_bridge_url, token },
      `SELECT cofEmpApelido FROM config WHERE cofId = ${l.emp_id}`
    );

    const nome = rows[0]?.cofEmpApelido?.trim() || null;
    if (!nome) {
      return NextResponse.json({ error: "Nome não encontrado no ERP para este EmpId" }, { status: 404 });
    }

    return NextResponse.json({ success: true, nome });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : (e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

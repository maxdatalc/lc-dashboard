import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

export const dynamic = "force-dynamic";

export type ErpUserItem = {
  cliId: number;
  cliNome: string;
  cliEmail: string;
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

    const ok = await isSystemAdmin(user.id);
    if (!ok) return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const lojaId = searchParams.get("lojaId");
    if (!lojaId) return NextResponse.json({ erro: "lojaId obrigatório" }, { status: 400 });

    const admin = createAdminClient();
    const { data: loja } = await admin
      .from("lojas")
      .select("emp_id, sql_bridge_url, sql_bridge_token")
      .eq("id", lojaId)
      .maybeSingle();

    if (!loja) return NextResponse.json({ erro: "Loja não encontrada" }, { status: 404 });

    const row = loja as Record<string, unknown>;
    if (!row.sql_bridge_url || !row.sql_bridge_token) {
      return NextResponse.json({ erro: "Bridge SQL não configurada para esta loja" }, { status: 422 });
    }

    const bridge = {
      url: row.sql_bridge_url as string,
      token: decrypt(row.sql_bridge_token as string),
    };
    const empId = Number(row.emp_id);

    const { sql, params } = resolveNamedQuery("LIST_ERP_USERS", { empId });
    const rows = await queryBridge<ErpUserItem>(bridge, sql, params);

    return NextResponse.json({ users: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

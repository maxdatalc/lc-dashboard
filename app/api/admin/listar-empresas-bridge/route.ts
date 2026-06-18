import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export interface EmpresaBridge {
  empId: number;
  razao: string;
  fantasia: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { bridgeUrl, token } = (await req.json()) as { bridgeUrl?: string; token?: string };

  if (!bridgeUrl || !token) {
    return NextResponse.json({ success: false, error: "bridgeUrl e token são obrigatórios" });
  }

  try {
    const rows = await queryBridge<{ cofId: number; cofEmpRazao: string; cofEmpFantasia: string }>(
      { bridgeUrl, token },
      `SELECT cofId, cofEmpRazao, cofEmpFantasia FROM config ORDER BY cofId`
    );

    const empresas: EmpresaBridge[] = rows.map((r) => ({
      empId: r.cofId,
      razao: r.cofEmpRazao ?? "",
      fantasia: r.cofEmpFantasia ?? "",
    }));

    return NextResponse.json({ success: true, empresas });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: msg });
  }
}

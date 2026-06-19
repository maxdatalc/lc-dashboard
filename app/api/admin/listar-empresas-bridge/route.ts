import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

function isSafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return false;
    const blocked = ["169.254.", "127.", "localhost", "metadata.google"];
    return !blocked.some((b) => h === b || h.startsWith(b));
  } catch {
    return false;
  }
}

export interface EmpresaBridge {
  empId: number;
  razao: string;
  fantasia: string;
}

async function fetchEmpresas(bridgeUrl: string, token: string): Promise<EmpresaBridge[]> {
  const rows = await queryBridge<{ cofId: number; cofEmpRazao: string; cofEmpFantasia: string }>(
    { bridgeUrl, token },
    `SELECT cofId, cofEmpRazao, cofEmpFantasia FROM config ORDER BY cofId`
  );
  return rows.map((r) => ({
    empId: r.cofId,
    razao: r.cofEmpRazao ?? "",
    fantasia: r.cofEmpFantasia ?? "",
  }));
}

// GET ?tenantId=xxx — usa credenciais da bridge já cadastrada no tenant
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ success: false, error: "tenantId obrigatório" });

  const supabaseAdmin = await createAdminClient();
  const { data: lojas } = await supabaseAdmin
    .from("lojas")
    .select("name, emp_id, sql_bridge_url, sql_bridge_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("sql_bridge_url", "is", null)
    .not("sql_bridge_token", "is", null);

  if (!lojas?.length) {
    return NextResponse.json({ success: true, empresas: [], bridgeUrl: null, lojaOrigem: null });
  }

  const loja = lojas[0] as Record<string, string>;
  const bridgeUrl = loja.sql_bridge_url;
  const token = decrypt(loja.sql_bridge_token);

  // empIds já cadastrados para excluir da lista de "disponíveis"
  const empIdsUsados = (lojas as Record<string, unknown>[]).map((l) => Number(l.emp_id));

  try {
    const todas = await fetchEmpresas(bridgeUrl, token);
    const disponiveis = todas.filter((e) => !empIdsUsados.includes(e.empId));
    return NextResponse.json({
      success: true,
      empresas: todas,
      disponiveis,
      bridgeUrl,
      lojaOrigem: loja.name,
    });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: msg });
  }
}

// POST { bridgeUrl, token } — credenciais novas informadas manualmente
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

  if (!isSafeUrl(bridgeUrl)) {
    return NextResponse.json({ success: false, error: "URL inválida ou não permitida" });
  }

  try {
    const empresas = await fetchEmpresas(bridgeUrl, token);
    return NextResponse.json({ success: true, empresas, disponiveis: empresas });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: msg });
  }
}

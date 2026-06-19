import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { bridgeUrl, token } = (await req.json()) as { bridgeUrl?: string; token?: string };

  if (!bridgeUrl || !token) {
    return NextResponse.json({ success: false, erro: "bridgeUrl e token são obrigatórios" });
  }

  if (!isSafeUrl(bridgeUrl)) {
    return NextResponse.json({ success: false, erro: "URL inválida ou não permitida" });
  }

  try {
    // Health check primeiro
    const health = await fetch(`${bridgeUrl}/health`, { cache: "no-store" }).catch(() => null);
    if (!health?.ok) {
      return NextResponse.json({ success: false, erro: "Bridge não respondeu ao health check. Verifique se está rodando e o túnel está ativo." });
    }

    // Query de teste real — retorna a primeira linha da tabela venda
    const rows = await queryBridge<Record<string, unknown>>(
      { bridgeUrl, token },
      "SELECT TOP 1 * FROM venda"
    );

    return NextResponse.json({ success: true, rows });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, erro: msg });
  }
}

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { criarTunnelCompleto } from "@/lib/cloudflare/tunnels";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { nome } = (await req.json()) as { nome: string };
    if (!nome?.trim()) return NextResponse.json({ error: "Informe o nome do tunnel" }, { status: 400 });

    const result = await criarTunnelCompleto(nome.trim().toLowerCase().replace(/\s+/g, "-"));

    return NextResponse.json({
      success: true,
      tunnelId: result.tunnelId,
      tunnelToken: result.tunnelToken,
      bridgeUrl: result.bridgeUrl,
      installCommand: `cloudflared.exe service install ${result.tunnelToken}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

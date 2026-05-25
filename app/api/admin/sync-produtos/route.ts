// Proxy para a Edge Function sync-produtos-inicial
// POST — auth check + repassa lojaId e pagina para a função Deno

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await req.json() as { lojaId: string; pagina: number };
    const { lojaId, pagina } = body;

    if (!lojaId || !pagina) {
      return NextResponse.json({ error: "Campos obrigatórios: lojaId, pagina" }, { status: 400 });
    }

    const efResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-produtos-inicial`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lojaId, pagina }),
      }
    );

    const responseText = await efResponse.text();

    if (!efResponse.ok) {
      return NextResponse.json({ error: `Edge Function: ${responseText}` }, { status: 502 });
    }

    const data = JSON.parse(responseText) as unknown;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

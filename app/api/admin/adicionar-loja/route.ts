// API route para adicionar uma loja a um tenant existente
// Exige autenticação como system admin

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin, adicionarLoja } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // 2. Parsear e validar corpo
    const body = await req.json() as {
      tenantId: string;
      name: string;
      empId: number;
      erpBaseUrl: string;
      terminal: string;
    };

    const { tenantId, name, empId, erpBaseUrl, terminal } = body;

    if (!tenantId || !name || !empId || !erpBaseUrl || !terminal) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
    }

    // 3. Adicionar loja (terminal é criptografado internamente por createLoja)
    const lojaId = await adicionarLoja(tenantId, { name, empId, erpBaseUrl, terminal });

    return NextResponse.json({ success: true, lojaId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

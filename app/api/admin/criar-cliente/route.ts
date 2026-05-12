// API route para criação de novo cliente pelo painel administrativo
// Exige autenticação como system admin antes de executar qualquer operação

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin, createNovoCliente, type NovoClienteInput } from "@/lib/db/admin";
import { getCoreFeatures } from "@/lib/features";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2. Verificar privilégio de system admin
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 3. Parsear corpo da requisição
    const input = (await req.json()) as NovoClienteInput;

    if (!input.tenant?.name || !input.tenant?.slug) {
      return NextResponse.json({ error: "Dados da empresa incompletos" }, { status: 400 });
    }
    if (!Array.isArray(input.lojas) || input.lojas.length === 0) {
      return NextResponse.json({ error: "Informe ao menos uma loja" }, { status: 400 });
    }
    for (let i = 0; i < input.lojas.length; i++) { const loja = input.lojas[i];
      if (!loja.name || !loja.empId || !loja.erpBaseUrl || !loja.terminal) {
        return NextResponse.json(
          { error: `Dados incompletos na Loja ${i + 1}` },
          { status: 400 }
        );
      }
    }
    if (!input.usuario?.email || !input.usuario?.senha || !input.usuario?.nomeCompleto) {
      return NextResponse.json({ error: "Dados do usuário incompletos" }, { status: 400 });
    }

    // 4. Incluir features core automaticamente (não podem ser removidas)
    const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...(input.features ?? [])]));

    // 5. Criar cliente completo
    const resultado = await createNovoCliente({ ...input, features: featuresFinais });

    return NextResponse.json({
      success: true,
      tenantId: resultado.tenantId,
      lojaIds: resultado.lojaIds,
      usuarioId: resultado.usuarioId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

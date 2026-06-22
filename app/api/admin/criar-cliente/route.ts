import { NextResponse, NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin, createNovoCliente, type NovoClienteInput } from "@/lib/db/admin";
import { getCoreFeatures } from "@/lib/features";
import { vincularClientesPorCnpjs } from "@/lib/db/clientes-base";
import { encrypt } from "@/lib/crypto";

type BodyExtra = {
  tunnelId?: string;
  tunnelToken?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = (await req.json()) as NovoClienteInput & BodyExtra;
    const { tunnelId, tunnelToken, ...input } = body;

    if (!input.tenant?.name || !input.tenant?.slug)
      return NextResponse.json({ error: "Dados da empresa incompletos" }, { status: 400 });
    if (!Array.isArray(input.lojas) || input.lojas.length === 0)
      return NextResponse.json({ error: "Informe ao menos uma loja" }, { status: 400 });
    for (let i = 0; i < input.lojas.length; i++) {
      const loja = input.lojas[i];
      if (!loja.name || !loja.empId)
        return NextResponse.json({ error: `Nome e EmpId obrigatórios na Loja ${i + 1}` }, { status: 400 });
    }
    const temUsuario = !!(input.usuario?.email || input.usuario?.senha || input.usuario?.nomeCompleto);
    if (temUsuario && (!input.usuario?.email || !input.usuario?.senha || !input.usuario?.nomeCompleto))
      return NextResponse.json({ error: "Preencha todos os dados do usuário ou deixe todos em branco." }, { status: 400 });

    const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...(input.features ?? [])]));
    const resultado = await createNovoCliente({ ...input, features: featuresFinais });

    const cnpjs = input.lojas.map((l) => l.cnpj).filter((c): c is string => !!c);
    const clientesVinculados = await vincularClientesPorCnpjs(resultado.tenantId, cnpjs);

    // Salvar tunnel já criado no passo anterior (se existir)
    if (tunnelId && tunnelToken) {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin
        .from("tenants")
        .update({
          cloudflare_tunnel_id: tunnelId,
          cloudflare_tunnel_token: encrypt(tunnelToken),
        })
        .eq("id", resultado.tenantId);
    }

    revalidatePath("/admin/empresas", "layout");
    revalidatePath("/admin/clientes", "layout");

    return NextResponse.json({
      success: true,
      tenantId: resultado.tenantId,
      lojaIds: resultado.lojaIds,
      usuarioId: resultado.usuarioId,
      clientesVinculados,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

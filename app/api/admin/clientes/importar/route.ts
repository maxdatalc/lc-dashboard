import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { upsertClientesBase } from "@/lib/db/clientes-base";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: { clientes?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.clientes) || body.clientes.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente no payload" }, { status: 400 });
  }

  type Row = {
    codigo_externo?: string;
    razao_social?: string;
    nome_fantasia?: string;
    cnpj_cpf?: string;
    segmento?: string;
    cidade?: string;
    telefone?: string;
  };

  const clientes = (body.clientes as Row[])
    .filter((r) => typeof r.razao_social === "string" && r.razao_social.trim())
    .map((r) => ({
      codigo_externo: r.codigo_externo?.trim() || null,
      razao_social:   r.razao_social!.trim(),
      nome_fantasia:  r.nome_fantasia?.trim() || null,
      cnpj_cpf:       r.cnpj_cpf?.trim() || null,
      segmento:       r.segmento?.trim() || null,
      cidade:         r.cidade?.trim() || null,
      telefone:       r.telefone?.trim() || null,
    }));

  if (clientes.length === 0) {
    return NextResponse.json({ error: "Nenhum registro válido" }, { status: 400 });
  }

  try {
    const resultado = await upsertClientesBase(clientes);
    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

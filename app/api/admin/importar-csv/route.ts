import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { uploadCSV } from "@/app/actions/admin-importacao";

type Entidade = "vendas" | "venda_itens" | "venda_pagamentos" | "produtos" | "vendedores" | "clientes";

const ENTIDADES_VALIDAS: Entidade[] = [
  "vendas",
  "venda_itens",
  "venda_pagamentos",
  "produtos",
  "vendedores",
  "clientes",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = (await req.json()) as {
      lojaId: string;
      entidade: string;
      nomeArquivo: string;
      conteudoBase64: string;
    };

    const { lojaId, entidade, nomeArquivo, conteudoBase64 } = body;

    if (!lojaId || !entidade || !nomeArquivo || !conteudoBase64) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    if (!ENTIDADES_VALIDAS.includes(entidade as Entidade)) {
      return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
    }

    const resultado = await uploadCSV(lojaId, entidade as Entidade, nomeArquivo, conteudoBase64);

    if (resultado.error) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import {
  criarImportacao,
  processarChunk,
  finalizarUpload,
} from "@/app/actions/admin-importacao";

const ENTIDADES_VALIDAS = [
  "vendas",
  "venda_itens",
  "venda_pagamentos",
  "produtos",
  "vendedores",
  "clientes",
] as const;

type Entidade = (typeof ENTIDADES_VALIDAS)[number];

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
      acao: "criar" | "chunk" | "finalizar";
      lojaId?: string;
      entidade?: string;
      nomeArquivo?: string;
      totalLinhas?: number;
      importacaoId?: string;
      rows?: Record<string, string>[];
      offsetInicio?: number;
      totalValidas?: number;
      totalInvalidas?: number;
      errosAmostra?: string[];
    };

    if (body.acao === "criar") {
      const { lojaId, entidade, nomeArquivo, totalLinhas } = body;
      if (!lojaId || !entidade || !nomeArquivo || !totalLinhas) {
        return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
      }
      if (!ENTIDADES_VALIDAS.includes(entidade as Entidade)) {
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
      }
      const resultado = await criarImportacao(
        lojaId,
        entidade as Entidade,
        nomeArquivo,
        totalLinhas,
        user.id
      );
      if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
      return NextResponse.json(resultado);
    }

    if (body.acao === "chunk") {
      const { importacaoId, lojaId, entidade, rows, offsetInicio } = body;
      if (!importacaoId || !lojaId || !entidade || !rows || offsetInicio === undefined) {
        return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
      }
      if (!ENTIDADES_VALIDAS.includes(entidade as Entidade)) {
        return NextResponse.json({ error: "Entidade inválida" }, { status: 400 });
      }
      const resultado = await processarChunk(
        importacaoId,
        lojaId,
        entidade as Entidade,
        rows,
        offsetInicio
      );
      if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
      return NextResponse.json(resultado);
    }

    if (body.acao === "finalizar") {
      const { importacaoId, totalValidas, totalInvalidas, errosAmostra } = body;
      if (!importacaoId || totalValidas === undefined || totalInvalidas === undefined) {
        return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
      }
      const resultado = await finalizarUpload(
        importacaoId,
        totalValidas,
        totalInvalidas,
        errosAmostra ?? []
      );
      if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
      return NextResponse.json({ success: true, validas: totalValidas, invalidas: totalInvalidas });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

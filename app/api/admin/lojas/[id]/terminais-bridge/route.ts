import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export interface TerminalBridge {
  terminalId: string;
  terminalNome: string;
  tipo: number; // 0 = desktop, 1 = mobile
  ultimaConexao: string | null;
  naEmpresa: boolean;
}

/**
 * Lista os dispositivos/terminais ativos cadastrados no MaxManager (tela 470,
 * tabela MaxdataControleAcesso) para preencher o campo Terminal da MaxAPI.
 *
 * O mesmo mcaMaquinaId aparece uma vez por empId, então agrupamos por máquina
 * e devolvemos todos os ativos com a flag `naEmpresa` — filtrar pelo empId da
 * loja esconderia terminais válidos do grupo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: loja, error } = await supabaseAdmin
    .from("lojas")
    .select("emp_id, sql_bridge_url, sql_bridge_token, sql_enabled")
    .eq("id", id)
    .maybeSingle();

  if (error || !loja) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const l = loja as {
    emp_id: number;
    sql_bridge_url: string | null;
    sql_bridge_token: string | null;
    sql_enabled: boolean;
  };

  if (!l.sql_enabled || !l.sql_bridge_url || !l.sql_bridge_token) {
    return NextResponse.json({ error: "Bridge não configurada para esta loja" }, { status: 400 });
  }

  const token = decrypt(l.sql_bridge_token);
  const empId = Number(l.emp_id);

  try {
    // RTRIM é obrigatório: mcaMaquinaId é varchar(254) e pode vir com padding —
    // um terminal com espaço autentica errado na MaxAPI.
    const rows = await queryBridge<{
      terminalId: string;
      terminalNome: string;
      tipo: number;
      ultimaConexao: string | null;
      naEmpresa: number;
    }>(
      { bridgeUrl: l.sql_bridge_url, token },
      `SELECT RTRIM(mcaMaquinaId)                                AS terminalId,
              RTRIM(MAX(ISNULL(mcaMaquinaNome, '')))             AS terminalNome,
              MAX(CAST(mcaTipo AS INT))                          AS tipo,
              CONVERT(VARCHAR(23), MAX(mcaDataUltimaConexao), 126) AS ultimaConexao,
              MAX(CASE WHEN empId = ${empId} THEN 1 ELSE 0 END)  AS naEmpresa
       FROM   MaxdataControleAcesso
       WHERE  mcaAtivo = 1
       GROUP BY RTRIM(mcaMaquinaId)
       ORDER BY MAX(mcaDataUltimaConexao) DESC`
    );

    const terminais: TerminalBridge[] = rows
      .filter((r) => (r.terminalId ?? "").trim() !== "")
      .map((r) => ({
        terminalId: r.terminalId.trim(),
        terminalNome: (r.terminalNome ?? "").trim(),
        tipo: Number(r.tipo ?? 0),
        ultimaConexao: r.ultimaConexao ?? null,
        naEmpresa: Number(r.naEmpresa ?? 0) === 1,
      }));

    return NextResponse.json({ success: true, terminais });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : (e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

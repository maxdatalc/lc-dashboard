import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

type LojaRow = {
  id: string;
  name: string;
  emp_id: number;
  sql_bridge_url: string | null;
  sql_bridge_token: string | null;
};

/**
 * Importa de uma vez o apelido de todas as empresas do grupo (config.cofEmpApelido)
 * e atualiza o nome das lojas do tenant — evita clicar "Bridge" loja a loja.
 *
 * Usa cofEmpApelido para bater com o botão individual (lojas/[id]/nome-bridge).
 * As lojas são agrupadas por bridge distinta: um tenant normalmente tem só uma,
 * mas assim nunca atualizamos lojas de uma bridge com dados de outra.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id: tenantId } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: lojasData } = await supabaseAdmin
    .from("lojas")
    .select("id, name, emp_id, sql_bridge_url, sql_bridge_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("sql_bridge_url", "is", null)
    .not("sql_bridge_token", "is", null);

  const lojas = (lojasData ?? []) as LojaRow[];
  if (lojas.length === 0) {
    return NextResponse.json({ error: "Nenhuma loja com Bridge configurada neste grupo" }, { status: 400 });
  }

  // Agrupa por bridge distinta
  const porBridge = new Map<string, LojaRow[]>();
  for (const l of lojas) {
    const chave = l.sql_bridge_url!;
    const atual = porBridge.get(chave);
    if (atual) atual.push(l);
    else porBridge.set(chave, [l]);
  }

  const atualizadas: { id: string; de: string; para: string }[] = [];
  const semCorrespondencia: number[] = [];

  try {
    for (const [bridgeUrl, lojasDaBridge] of porBridge) {
      const token = decrypt(lojasDaBridge[0].sql_bridge_token!);
      const rows = await queryBridge<{ cofId: number; cofEmpApelido: string }>(
        { bridgeUrl, token },
        `SELECT cofId, cofEmpApelido FROM config ORDER BY cofId`
      );

      const apelidoPorEmpId = new Map<number, string>();
      for (const r of rows) {
        const apelido = (r.cofEmpApelido ?? "").trim();
        if (apelido) apelidoPorEmpId.set(Number(r.cofId), apelido);
      }

      for (const loja of lojasDaBridge) {
        const novo = apelidoPorEmpId.get(Number(loja.emp_id));
        if (!novo) {
          semCorrespondencia.push(loja.emp_id);
          continue;
        }
        if (novo === loja.name) continue;

        const { error } = await supabaseAdmin
          .from("lojas")
          .update({ name: novo })
          .eq("id", loja.id);
        if (error) throw new Error(error.message);

        atualizadas.push({ id: loja.id, de: loja.name, para: novo });
      }
    }

    return NextResponse.json({ success: true, atualizadas, semCorrespondencia });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : (e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

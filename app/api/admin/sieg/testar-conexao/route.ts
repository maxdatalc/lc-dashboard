import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { getSiegJWT, renovarSiegJWT } from "@/lib/sieg/sieg-client";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      lojaId: string;
      empId: number;
      oauthToken?: string; // se passado, usa este; senão busca do Supabase
    };

    // Testa nível 1: JWT do integrador
    try {
      await renovarSiegJWT();
    } catch (err) {
      return NextResponse.json({
        ok: false,
        erro: `JWT do sistema integrador falhou: ${(err as Error).message}. Verifique SIEG_CLIENT_ID e SIEG_SECRET_KEY.`,
      });
    }

    // Testa nível 2: OAuth Token do cliente
    let oauthToken = body.oauthToken;
    if (!oauthToken) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data } = await supabase
        .from("sieg_configuracoes")
        .select("oauth_token")
        .eq("loja_id", body.lojaId)
        .eq("emp_id", body.empId)
        .maybeSingle<{ oauth_token: string }>();

      if (!data?.oauth_token) {
        return NextResponse.json({ ok: false, erro: "OAuth Token não encontrado para esta empresa." });
      }
      oauthToken = decrypt(data.oauth_token);
    }

    // Teste real: envia uma requisição ao SIEG com XML mínimo para validar autenticação
    // Usamos um XML fictício curto — se retornar 422/400 (XML inválido) mas não 401/403,
    // significa que a autenticação funcionou
    const jwt = await getSiegJWT();
    const res = await fetch("https://api.sieg.com/api/v1/send-xml", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "X-OAuth-Token": oauthToken,
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: "<?xml version='1.0'?><test/>",
    });

    // 401/403 = autenticação falhou
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        erro: `Autenticação rejeitada pela SIEG (HTTP ${res.status}). Verifique o OAuth Token.`,
      });
    }

    // Qualquer outro código (200, 400, 422) = autenticação OK
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: (err as Error).message }, { status: 500 });
  }
}

// API route para testar credenciais do ERP antes de salvar um novo cliente
// Verifica autenticação como system admin e tenta conectar à API MaxData

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, erro: "Não autenticado" }, { status: 401 });
    }

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ success: false, erro: "Acesso negado" }, { status: 403 });
    }

    // 2. Receber credenciais de teste
    const { erpBaseUrl, empId, terminal } = (await req.json()) as {
      erpBaseUrl: string;
      empId: number;
      terminal: string;
    };

    if (!erpBaseUrl || !empId || !terminal) {
      return NextResponse.json(
        { success: false, erro: "Campos obrigatórios: erpBaseUrl, empId, terminal" },
        { status: 400 }
      );
    }

    // 3. Normalizar URL — garantir protocolo e remover trailing slash
    const comProtocolo = erpBaseUrl.startsWith("http") ? erpBaseUrl : `https://${erpBaseUrl}`;
    const baseUrl = comProtocolo.replace(/\/+$/, "");
    const authUrl = `${baseUrl}/v2/auth`;

    console.log("[testar-conexao] Tentando:", authUrl, "empId:", empId);

    // 4. Tentar autenticar na API MaxData com timeout de 10 segundos
    let response: Response;
    try {
      response = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId, terminal }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (fetchErr) {
      const err = fetchErr as Error;
      if (err.name === "AbortError") {
        return NextResponse.json({
          success: false,
          erro: "Timeout: API demorou mais de 10s",
        });
      }
      if (err instanceof TypeError) {
        return NextResponse.json({
          success: false,
          erro: `Erro de rede: ${err.message}`,
        });
      }
      return NextResponse.json({
        success: false,
        erro: `Erro: ${err.message}`,
      });
    }

    // 4. Analisar resposta da API
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        success: false,
        erro: "Credenciais inválidas. Verifique o EmpId e o Terminal MaxData.",
      });
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        erro: `Resposta inesperada da API: HTTP ${response.status}`,
      });
    }

    const data = (await response.json()) as { empId?: number; token?: string };

    return NextResponse.json({
      success: true,
      empIdConfirmado: data.empId ?? empId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, erro: message }, { status: 500 });
  }
}

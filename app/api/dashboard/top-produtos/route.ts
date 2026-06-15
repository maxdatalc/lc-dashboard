import { NextRequest, NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function limitesMesAtual(): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dataInicio: `${ano}-${pad(mes + 1)}-01`,
    dataFim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}`,
  };
}

interface ProdutoRanking {
  nome: string;
  quantidade: number;
  total: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const { dataInicio: fallbackInicio, dataFim: fallbackFim } = limitesMesAtual();
  const dataInicio = searchParams.get("dataInicio") ?? fallbackInicio;
  const dataFim = searchParams.get("dataFim") ?? fallbackFim;

  const lojaId = await getSelectedLojaId();
  if (!lojaId) {
    return NextResponse.json({ error: "Selecione uma loja no dashboard" }, { status: 400 });
  }

  const guard = await requireTenantAccess([lojaId]);
  if (guard instanceof NextResponse) return guard;

  const config = await getLojaDbConfig(lojaId).catch(() => null);
  if (!config) return NextResponse.json([]);

  try {
    const rows = await queryBridge<{ nome: string; quantidade: number; total: number }>(
      config,
      `SELECT TOP 10
        vi.vdiProNome                              AS nome,
        ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade,
        ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS total
      FROM vendaItem vi
      JOIN venda v ON vi.vdiVedId = v.vedId
      WHERE v.vedStatus = 'F'
        AND v.vedTipo IN ('OS','VE')
        AND v.empId = @empId
        AND vi.vdiCancel = 0
        AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
      GROUP BY vi.vdiProNome
      ORDER BY total DESC`,
      { start: dataInicio, end: dataFim, empId: config.empId }
    );

    const resultado: ProdutoRanking[] = rows.map((r) => ({
      nome: r.nome ?? "Produto",
      quantidade: Number(r.quantidade),
      total: Number(r.total),
    }));

    return NextResponse.json(resultado);
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    console.error("[top-produtos] bridge error:", msg);
    return NextResponse.json([]);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

// Produto "coringa" — ver PRO_ID_CURINGA em lib/db/produtos-estoque.ts (mesma ressalva:
// convenção observada num cliente específico, não uma regra universal do MaxManager).
const VDI_ITEM_ID_CURINGA = 1;

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

  // Aceita lojaIds (multi, mesmo padrão dos demais endpoints); mantém getSelectedLojaId()
  // como fallback para compatibilidade com o único chamador conhecido hoje (cookie de loja
  // única). Sem TOP na query por loja: um produto pode ficar fora do TOP 10 de cada loja
  // individualmente e ainda ser o líder ao somar todas as lojas selecionadas — o corte
  // "TOP 10" só é seguro depois de mesclar por nome entre lojas (ver abaixo).
  const lojaIdsParam = searchParams.get("lojaIds");
  let lojaIds = lojaIdsParam ? lojaIdsParam.split(",").filter(Boolean) : [];
  if (lojaIds.length === 0) {
    const selecionada = await getSelectedLojaId();
    if (!selecionada) {
      return NextResponse.json({ error: "Selecione uma loja no dashboard" }, { status: 400 });
    }
    lojaIds = [selecionada];
  }

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const acumulado = new Map<string, { quantidade: number; total: number }>();
  let bridgeFound = false;

  await Promise.all(
    lojaIds.map(async (id) => {
      const config = await getLojaDbConfig(id).catch(() => null);
      if (!config) return;
      bridgeFound = true;

      try {
        const rows = await queryBridge<{ nome: string; quantidade: number; total: number }>(
          config,
          `SELECT
            vi.vdiProNome                              AS nome,
            ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS total
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.empId = @empId
            AND vi.vdiCancel = 0
            AND vi.vdiItemId <> ${VDI_ITEM_ID_CURINGA}
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY vi.vdiProNome`,
          { start: dataInicio, end: dataFim, empId: config.empId }
        );

        for (const r of rows) {
          const nome = r.nome ?? "Produto";
          const cur = acumulado.get(nome) ?? { quantidade: 0, total: 0 };
          acumulado.set(nome, {
            quantidade: cur.quantidade + Number(r.quantidade ?? 0),
            total: cur.total + Number(r.total ?? 0),
          });
        }
      } catch (e) {
        const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
        console.error(`[top-produtos] bridge error loja ${id}:`, msg);
      }
    })
  );

  if (!bridgeFound) return NextResponse.json([]);

  const resultado: ProdutoRanking[] = Array.from(acumulado.entries())
    .map(([nome, v]) => ({ nome, quantidade: v.quantidade, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json(resultado);
}

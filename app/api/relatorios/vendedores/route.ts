import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

interface VendedorRow {
  VendedorId: number;
  Nome: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);

  if (lojaIds.length === 0)
    return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const config = await getLojaDbConfig(lojaIds[0]).catch(() => null);
  if (!config)
    return NextResponse.json({ error: "Bridge não configurada" }, { status: 503 });

  const rows = await queryBridge<VendedorRow>(
    config,
    `SELECT DISTINCT
       c.cliId   AS VendedorId,
       c.cliNome AS Nome
     FROM cliente c
     INNER JOIN lotacUsuario lu ON lu.ltuUsuId = c.cliId AND lu.empId = @empId
     INNER JOIN depto d         ON d.depId = lu.ltuDeptoId
     WHERE d.depNome             = 'VENDAS'
       AND c.cliUsuarioUsaSistema = 1
     ORDER BY c.cliNome`,
    { empId: config.empId }
  );

  return NextResponse.json(rows);
}

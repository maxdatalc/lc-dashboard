"use client";

import Link from "next/link";
import type { OrdemServico } from "@/lib/fiscal-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

function tipoAtendStyle(cor: string, corFundo: string) {
  const textHex = cor && cor.toUpperCase() !== "000000" ? `#${cor}` : undefined;
  const isLightBg = !corFundo || corFundo.toUpperCase() === "FFFFFF";
  const bg = textHex
    ? isLightBg
      ? `${textHex}22`
      : `#${corFundo}`
    : undefined;
  const border = textHex ? `${textHex}55` : undefined;
  return { color: textHex, backgroundColor: bg, borderColor: border };
}

export function ServiceOrderList({ ordens }: { ordens: OrdemServico[] }) {
  if (ordens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border bg-card py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">Nenhuma O.S encontrada.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Ajuste os filtros e clique em Buscar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">N.O.S</TableHead>
            <TableHead className="w-20">Cód.</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-40">Marca / Modelo</TableHead>
            <TableHead className="w-24">Placa</TableHead>
            <TableHead className="w-24">Abertura</TableHead>
            <TableHead className="w-28 text-right">Valor</TableHead>
            <TableHead className="w-44">Tipo Atendimento</TableHead>
            <TableHead className="w-16 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordens.map((os) => {
            const cor = os.tipoAtendCor ?? "";
            const corFundo = os.tipoAtendCorFundo ?? "";
            const tipoStyle = tipoAtendStyle(cor, corFundo);
            const marcaModelo = [os.marca, os.equipamento].filter(Boolean).join(" ");

            return (
              <TableRow key={os.id}>
                <TableCell className="font-mono text-sm font-medium">{os.numero}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {os.cliId || "—"}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <span className="block truncate" title={os.cliente}>
                    {os.cliente || "—"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[160px]">
                  {marcaModelo ? (
                    <span
                      className="block truncate text-sm text-muted-foreground"
                      title={marcaModelo}
                    >
                      {marcaModelo}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {os.placa || <span className="text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {os.data
                    ? new Date(os.data).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {(os.valorTotal ?? 0) > 0
                    ? (os.valorTotal ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : <span className="text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell>
                  {os.tipoAtendDesc ? (
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                      style={tipoStyle}
                    >
                      {os.tipoAtendDesc}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/os/${os.id}`}>Abrir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

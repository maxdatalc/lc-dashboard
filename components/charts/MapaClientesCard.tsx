"use client";

import dynamic from "next/dynamic";
import type { CliGeoItem } from "./CliGeoRanking";

const Inner = dynamic(() => import("./MapaBrasilInner"), {
  ssr: false,
  loading: () => (
    <div className="shimmer rounded-xl" style={{ height: 430 }} />
  ),
});

export interface ClienteVenda { cliId: number; nome: string; cidade: string; uf: string; receita: number; vendas: number; }

interface Props {
  data: CliGeoItem[];
  totalBase: number;
  selectedCidade: string | null;
  onSelect: (cidade: string | null) => void;
  clientesAgg?: ClienteVenda[];
}

export function MapaClientesCard(props: Props) {
  return <Inner {...props} />;
}

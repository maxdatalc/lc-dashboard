"use client";

import dynamic from "next/dynamic";
import type { CliGeoItem } from "./CliGeoRanking";

const Inner = dynamic(() => import("./MapaBrasilInner"), {
  ssr: false,
  loading: () => (
    <div className="shimmer rounded-xl" style={{ height: 430 }} />
  ),
});

interface Props {
  data: CliGeoItem[];
  totalBase: number;
  selectedCidade: string | null;
  onSelect: (cidade: string | null) => void;
  geoStats?: Record<string, { receita: number; vendas: number }>;
}

export function MapaClientesCard(props: Props) {
  return <Inner {...props} />;
}

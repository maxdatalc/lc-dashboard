"use client";

// Gráfico horizontal de top produtos do período — busca dados da API com cache Redis

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Loader2 } from "lucide-react";

interface Props {
  dataInicio: string;
  dataFim: string;
}

interface ProdutoRanking {
  nome: string;
  quantidade: number;
  total: number;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ProdutoRanking }>;
  label?: string;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", padding: "10px 14px" }} className="text-sm space-y-1">
      <p className="font-medium truncate max-w-[200px]" style={{ color: "hsl(var(--foreground))" }}>{d.nome}</p>
      <p className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>{formatarMoeda(d.total)}</p>
      <p style={{ color: "hsl(var(--muted-foreground))" }}>{d.quantidade} un vendidas</p>
    </div>
  );
}

function truncar(nome: string): string {
  return nome.length > 15 ? nome.slice(0, 15) + "..." : nome;
}

export function GraficoTopProdutos({ dataInicio, dataFim }: Props) {
  const [dados, setDados] = useState<ProdutoRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function fetchDados() {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch(
          `/api/dashboard/top-produtos?dataInicio=${dataInicio}&dataFim=${dataFim}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProdutoRanking[];
        if (!cancelado) setDados(json);
      } catch (err) {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : "Erro ao carregar");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    fetchDados();
    return () => { cancelado = true; };
  }, [dataInicio, dataFim]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-slate-400" />
            <CardTitle className="text-sm font-medium text-slate-600">
              Top Produtos do Período
            </CardTitle>
          </div>
          {/* Badge "Ao vivo" — dados frescos da API MaxData via Redis */}
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
            Ao vivo
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[320px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
            </div>
          ) : erro || dados.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center">
              <p className="text-slate-400 text-sm">Sem dados para o período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                layout="vertical"
                data={dados}
                margin={{ top: 5, right: 60, bottom: 5, left: 0 }}
              >
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={120}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={truncar}
                />
                <XAxis type="number" hide={true} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="total"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationBegin={300}
                >
                  {dados.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index < 3 ? "#1D4ED8" : "#1E3A7A"}
                    />
                  ))}
                  <LabelList
                    dataKey="quantidade"
                    position="right"
                    formatter={(v: unknown) => `${Number(v)} un`}
                    style={{ fontSize: 11, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

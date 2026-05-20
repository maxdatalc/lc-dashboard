// Consultas ao Supabase para os KPIs do dashboard
// Usa createClient (respeita RLS — dados isolados por sessão do usuário)

import { createClient } from "@/lib/supabase/server";

// ── Tipos e helpers de período ──────────────────────────────────────────────

export type PeriodoDates = {
  dataInicio: string;
  dataFim: string;
  label: string;
};

// Converte Date para YYYY-MM-DD sem depender de fuso horário
function toStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Retorna o primeiro e último dia do mês de uma data
function limitesMes(data: Date): { primeiro: string; ultimo: string } {
  const ano = data.getFullYear();
  const mes = data.getMonth();
  return {
    primeiro: toStr(new Date(ano, mes, 1)),
    ultimo: toStr(new Date(ano, mes + 1, 0)),
  };
}

function formatarDataLabel(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function getPeriodoDates(
  periodo: string,
  customDe?: string,
  customAte?: string
): PeriodoDates {
  const hoje = new Date();
  const hojeStr = toStr(hoje);
  const y = hoje.getFullYear();
  const m = hoje.getMonth();

  switch (periodo) {
    case "custom":
      if (customDe && customAte) {
        return {
          dataInicio: customDe,
          dataFim: customAte,
          label: `de ${formatarDataLabel(customDe)} até ${formatarDataLabel(customAte)}`,
        };
      }
      // fallback para mês atual se datas custom ausentes
      return getPeriodoDates("mes");

    case "hoje":
      return { dataInicio: hojeStr, dataFim: hojeStr, label: "Hoje" };

    case "7dias":
      return {
        dataInicio: toStr(new Date(hoje.getTime() - 6 * 86400000)),
        dataFim: hojeStr,
        label: "Últimos 7 dias",
      };

    case "3meses":
      return {
        dataInicio: toStr(new Date(y, m - 3, 1)),
        dataFim: hojeStr,
        label: "Últimos 3 meses",
      };

    case "6meses":
      return {
        dataInicio: toStr(new Date(y, m - 6, 1)),
        dataFim: hojeStr,
        label: "Últimos 6 meses",
      };

    case "ano":
      return {
        dataInicio: `${y}-01-01`,
        dataFim: hojeStr,
        label: "Este ano",
      };

    case "mes":
    default: {
      const { primeiro } = limitesMes(hoje);
      return { dataInicio: primeiro, dataFim: hojeStr, label: "Este mês" };
    }
  }
}

export function getPeriodoAnteriorDates(
  periodo: string,
  customDe?: string,
  customAte?: string
): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();

  switch (periodo) {
    case "hoje": {
      const ontem = toStr(new Date(hoje.getTime() - 86400000));
      return { dataInicio: ontem, dataFim: ontem };
    }

    case "7dias":
      // Atual: hoje-6 a hoje (7 dias) → anterior: hoje-13 a hoje-7 (7 dias)
      return {
        dataInicio: toStr(new Date(hoje.getTime() - 13 * 86400000)),
        dataFim: toStr(new Date(hoje.getTime() - 7 * 86400000)),
      };

    case "3meses": {
      const inicioAtual = new Date(y, m - 3, 1);
      return {
        dataInicio: toStr(new Date(y, m - 6, 1)),
        dataFim: toStr(new Date(inicioAtual.getTime() - 86400000)),
      };
    }

    case "6meses": {
      const inicioAtual = new Date(y, m - 6, 1);
      return {
        dataInicio: toStr(new Date(y, m - 12, 1)),
        dataFim: toStr(new Date(inicioAtual.getTime() - 86400000)),
      };
    }

    case "ano":
      return {
        dataInicio: `${y - 1}-01-01`,
        dataFim: `${y - 1}-12-31`,
      };

    case "custom": {
      if (customDe && customAte) {
        const de = new Date(customDe + "T12:00:00");
        const ate = new Date(customAte + "T12:00:00");
        // Mesmo intervalo de dias imediatamente antes do período custom
        const diffDias = Math.round((ate.getTime() - de.getTime()) / 86400000) + 1;
        const novoFim = new Date(de.getTime() - 86400000);
        const novoInicio = new Date(novoFim.getTime() - (diffDias - 1) * 86400000);
        return { dataInicio: toStr(novoInicio), dataFim: toStr(novoFim) };
      }
      // fallback para mês anterior
      const { primeiro } = limitesMes(new Date(y, m - 1, 1));
      return { dataInicio: primeiro, dataFim: toStr(new Date(y, m, 0)) };
    }

    case "mes":
    default: {
      const mesAnterior = new Date(y, m - 1, 1);
      const { primeiro, ultimo } = limitesMes(mesAnterior);
      return { dataInicio: primeiro, dataFim: ultimo };
    }
  }
}

// ── Helper de ISO week number ───────────────────────────────────────────────

function getNumeroSemana(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

// ── Funções de KPI ─────────────────────────────────────────────────────────

export async function getFaturamento(
  lojaId: string,
  dataInicio: string,
  dataFim: string
): Promise<number> {
  const supabase = await createClient();

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .gte("data_venda", dataInicio)
    .lte("data_venda", dataFim);

  return (data ?? []).reduce((acc, v) => acc + (v.valor_bruto ?? 0), 0);
}

export async function getVendasPeriodo(
  lojaId: string,
  dataInicio: string,
  dataFim: string
): Promise<{ quantidade: number; total: number }> {
  const supabase = await createClient();

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .gte("data_venda", dataInicio)
    .lte("data_venda", dataFim);

  const registros = data ?? [];
  return {
    quantidade: registros.length,
    total: registros.reduce((acc, v) => acc + (v.valor_bruto ?? 0), 0),
  };
}

export async function getVendasHoje(
  lojaId: string
): Promise<{ quantidade: number; total: number }> {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .eq("data_venda", hoje);

  const registros = data ?? [];
  return {
    quantidade: registros.length,
    total: registros.reduce((acc, v) => acc + (v.valor_bruto ?? 0), 0),
  };
}

export async function getTicketMedio(
  lojaId: string,
  dataInicio: string,
  dataFim: string
): Promise<number> {
  const supabase = await createClient();

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .gte("data_venda", dataInicio)
    .lte("data_venda", dataFim);

  const registros = data ?? [];
  if (registros.length === 0) return 0;

  const total = registros.reduce((acc, v) => acc + (v.valor_bruto ?? 0), 0);
  return total / registros.length;
}

export async function getVendasAgrupadas(
  lojaId: string,
  dataInicio: string,
  dataFim: string,
  _periodo: string
): Promise<{ label: string; total: number }[]> {
  const supabase = await createClient();

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("data_venda, valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .gte("data_venda", dataInicio)
    .lte("data_venda", dataFim);

  if (!data || data.length === 0) return [];

  const inicio = new Date(dataInicio + "T12:00:00");
  const fim = new Date(dataFim + "T12:00:00");
  const diffDias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);

  const agrupado: Record<string, { label: string; total: number }> = {};

  for (const v of data) {
    const date = new Date((v.data_venda as string) + "T12:00:00");
    let key: string;
    let label: string;

    if (diffDias <= 31) {
      // Agrupamento diário
      key = v.data_venda as string;
      label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } else if (diffDias <= 180) {
      // Agrupamento semanal
      const semana = getNumeroSemana(date);
      key = `${date.getFullYear()}-W${String(semana).padStart(2, "0")}`;
      label = `Sem ${semana}`;
    } else {
      // Agrupamento mensal
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    }

    if (!agrupado[key]) agrupado[key] = { label, total: 0 };
    agrupado[key].total += (v.valor_bruto as number) ?? 0;
  }

  return Object.entries(agrupado)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ── Top Clientes ───────────────────────────────────────────────────────────

export type ClienteRanking = {
  nome: string;
  total: number;
  quantidade: number;
  ultimaCompra: string;
};

export async function getTopClientes(
  lojaId: string,
  dataInicio: string,
  dataFim: string
): Promise<ClienteRanking[]> {
  try {
    const supabase = await createClient();

    // Exclui canceladas e vendas sem cliente identificado
    const { data, error } = await supabase
      .from("vendas")
      .select("cliente_nome, cliente_external_id, valor_bruto, data_venda")
      .eq("loja_id", lojaId)
      .not("status", "ilike", "cancelada")
      .not("cliente_nome", "is", null)
      .gte("data_venda", dataInicio)
      .lte("data_venda", dataFim);

    if (error || !data) return [];

    // Agrupar por cliente acumulando total, quantidade e última compra
    const agrupado: Record<string, ClienteRanking> = {};

    for (const v of data) {
      const key = `${v.cliente_external_id ?? ""}:${v.cliente_nome as string}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          nome: v.cliente_nome as string,
          total: 0,
          quantidade: 0,
          ultimaCompra: "",
        };
      }
      agrupado[key].total += (v.valor_bruto as number) ?? 0;
      agrupado[key].quantidade += 1;
      if (!agrupado[key].ultimaCompra || (v.data_venda as string) > agrupado[key].ultimaCompra) {
        agrupado[key].ultimaCompra = v.data_venda as string;
      }
    }

    return Object.values(agrupado)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ── Vendas por Dia da Semana ───────────────────────────────────────────────

export type DiaSemanaData = {
  dia: string;
  total: number;
  quantidade: number;
  media: number;
};

const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getVendasPorDiaSemana(
  lojaId: string,
  dataInicio: string,
  dataFim: string
): Promise<DiaSemanaData[]> {
  const supabase = await createClient();

  // Exclui vendas canceladas — status real vem do ERP via sync
  const { data } = await supabase
    .from("vendas")
    .select("data_venda, valor_bruto")
    .eq("loja_id", lojaId)
    .not("status", "ilike", "cancelada")
    .gte("data_venda", dataInicio)
    .lte("data_venda", dataFim);

  // Acumuladores para os 7 dias da semana (0=Dom...6=Sáb)
  const acumulado = Array.from({ length: 7 }, () => ({ total: 0, quantidade: 0 }));

  for (const v of data ?? []) {
    const dayOfWeek = new Date((v.data_venda as string) + "T12:00:00").getDay();
    acumulado[dayOfWeek].total += (v.valor_bruto as number) ?? 0;
    acumulado[dayOfWeek].quantidade += 1;
  }

  return acumulado.map((acc, i) => ({
    dia: NOMES_DIAS[i],
    total: acc.total,
    quantidade: acc.quantidade,
    media: acc.quantidade > 0 ? acc.total / acc.quantidade : 0,
  }));
}

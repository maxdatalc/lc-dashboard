// Consultas ao Supabase para o módulo financeiro (contas a receber)
// Usa createClient (respeita RLS — dados isolados por sessão)

import { createClient } from "@/lib/supabase/server";

// ── Tipos exportados ───────────────────────────────────────────────────────

export type ResumoFinanceiro = {
  totalVencido: number;
  totalAVencer30: number;
  totalAVencer7: number;
  qtdInadimplentes: number;
  qtdAVencer30: number;
  totalGeral: number;
  clientesSemDocumento: number;
};

export type ClienteInadimplente = {
  nome: string;
  cnpj: string;
  quantidadeBoletos: number;
  totalDevido: number;
  boletoMaisAntigo: string;  // YYYY-MM-DD
  boletoMaisRecente: string; // YYYY-MM-DD
  diasMaiorAtraso: number;   // positivo = dias em atraso, negativo = dias até vencer
};

// ── Helpers de data ────────────────────────────────────────────────────────

function hojeStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

function diffDias(dataStr: string): number {
  const hoje = new Date(hojeStr() + "T00:00:00");
  const data = new Date(dataStr + "T00:00:00");
  return Math.round((hoje.getTime() - data.getTime()) / 86400000);
}

// ── Funções de consulta ────────────────────────────────────────────────────

export async function getResumoFinanceiro(
  lojaId: string
): Promise<ResumoFinanceiro> {
  const supabase = await createClient();
  const hoje = hojeStr();
  const em7Dias = addDias(7);
  const em30Dias = addDias(30);

  // Buscar todos os registros em aberto de uma vez
  const { data } = await supabase
    .from("financeiro")
    .select("valor, data_vencimento, cliente_cnpj")
    .eq("loja_id", lojaId);

  const registros = data ?? [];

  let totalVencido = 0;
  let totalAVencer30 = 0;
  let totalAVencer7 = 0;
  let totalGeral = 0;
  const cnpjsVencidos = new Set<string>();
  const cnpjsAVencer30 = new Set<string>();

  for (const r of registros) {
    const venc = r.data_vencimento as string;
    const valor = (r.valor as number) ?? 0;
    const cnpj = r.cliente_cnpj as string;

    totalGeral += valor;

    if (venc < hoje) {
      totalVencido += valor;
      cnpjsVencidos.add(cnpj);
    } else {
      if (venc <= em30Dias) {
        totalAVencer30 += valor;
        cnpjsAVencer30.add(cnpj);
      }
      if (venc <= em7Dias) {
        totalAVencer7 += valor;
      }
    }
  }

  // Contar clientes sem CPF/CNPJ cadastrado (ficam de fora do sync financeiro)
  const { count: semDoc } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("loja_id", lojaId)
    .is("cnpj_cpf", null);

  return {
    totalVencido,
    totalAVencer30,
    totalAVencer7,
    qtdInadimplentes: cnpjsVencidos.size,
    qtdAVencer30: cnpjsAVencer30.size,
    totalGeral,
    clientesSemDocumento: semDoc ?? 0,
  };
}

export async function getClientesInadimplentes(
  lojaId: string,
  filtro: "vencido" | "a_vencer" | "todos"
): Promise<ClienteInadimplente[]> {
  const supabase = await createClient();
  const hoje = hojeStr();

  let query = supabase
    .from("financeiro")
    .select("cliente_cnpj, cliente_nome, valor, data_vencimento")
    .eq("loja_id", lojaId);

  // Aplicar filtro de data conforme seleção
  if (filtro === "vencido") {
    query = query.lt("data_vencimento", hoje);
  } else if (filtro === "a_vencer") {
    query = query.gte("data_vencimento", hoje);
  }

  const { data } = await query;
  const registros = data ?? [];

  // Agrupar por cliente_cnpj acumulando totais e datas extremas
  const agrupado: Record<
    string,
    {
      nome: string;
      total: number;
      quantidade: number;
      maisAntigo: string;
      maisRecente: string;
    }
  > = {};

  for (const r of registros) {
    const cnpj = r.cliente_cnpj as string;
    const venc = r.data_vencimento as string;

    if (!agrupado[cnpj]) {
      agrupado[cnpj] = {
        nome: r.cliente_nome as string,
        total: 0,
        quantidade: 0,
        maisAntigo: venc,
        maisRecente: venc,
      };
    }

    agrupado[cnpj].total += (r.valor as number) ?? 0;
    agrupado[cnpj].quantidade += 1;
    if (venc < agrupado[cnpj].maisAntigo) agrupado[cnpj].maisAntigo = venc;
    if (venc > agrupado[cnpj].maisRecente) agrupado[cnpj].maisRecente = venc;
  }

  return Object.entries(agrupado)
    .map(([cnpj, acc]) => ({
      nome: acc.nome,
      cnpj,
      quantidadeBoletos: acc.quantidade,
      totalDevido: acc.total,
      boletoMaisAntigo: acc.maisAntigo,
      boletoMaisRecente: acc.maisRecente,
      // Positivo = dias em atraso, negativo = dias até vencer
      diasMaiorAtraso: diffDias(acc.maisAntigo),
    }))
    .sort((a, b) => b.totalDevido - a.totalDevido);
}

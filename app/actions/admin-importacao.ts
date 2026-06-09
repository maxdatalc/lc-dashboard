"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

async function verificarAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
  return user.id;
}

const ENTIDADES_CONFIG = {
  vendas: {
    colunas_obrigatorias: ["external_id", "data_venda", "valor_bruto", "valor_total", "status", "source"],
    tabela_staging: "staging_vendas",
  },
  venda_itens: {
    colunas_obrigatorias: ["venda_external_id", "produto_nome", "quantidade", "valor_unitario", "valor_total"],
    tabela_staging: "staging_venda_itens",
  },
  venda_pagamentos: {
    colunas_obrigatorias: ["venda_external_id", "forma_pagamento", "valor"],
    tabela_staging: "staging_venda_pagamentos",
  },
  produtos: {
    colunas_obrigatorias: ["external_id", "nome", "estoque_atual"],
    tabela_staging: "staging_produtos",
  },
  vendedores: {
    colunas_obrigatorias: ["external_id", "nome"],
    tabela_staging: "staging_vendedores",
  },
  clientes: {
    colunas_obrigatorias: ["external_id", "nome"],
    tabela_staging: "staging_clientes",
  },
} as const;

type Entidade = keyof typeof ENTIDADES_CONFIG;

function parsearCSV(conteudo: string): { headers: string[]; rows: Record<string, string>[] } {
  const linhas = conteudo
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (linhas.length < 2) return { headers: [], rows: [] };

  const headers = linhas[0].split(";").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const rows = linhas.slice(1).map((linha) => {
    const valores = linha.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = valores[i] ?? ""; });
    return row;
  });

  return { headers, rows };
}

function validarLinha(
  row: Record<string, string>,
  entidade: Entidade,
  linhaNum: number
): { valido: boolean; erro?: string; dado: Record<string, unknown> } {
  const config = ENTIDADES_CONFIG[entidade];
  const erros: string[] = [];

  for (const col of config.colunas_obrigatorias) {
    if (!row[col] || row[col].trim() === "") {
      erros.push(`coluna obrigatória ausente: ${col}`);
    }
  }

  if (erros.length > 0) {
    return { valido: false, erro: erros.join("; "), dado: {} };
  }

  try {
    if (entidade === "vendas") {
      const externalId = parseInt(row.external_id);
      if (isNaN(externalId) || externalId <= 0) throw new Error("external_id inválido");
      const dataVenda = new Date(row.data_venda);
      if (isNaN(dataVenda.getTime())) throw new Error("data_venda inválida");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          external_id: externalId,
          data_venda: row.data_venda,
          cliente_external_id: row.cliente_external_id ? parseInt(row.cliente_external_id) || null : null,
          cliente_nome: row.cliente_nome || null,
          cpf_cnpj: row.cpf_cnpj || null,
          valor_bruto: parseFloat(row.valor_bruto?.replace(",", ".")) || 0,
          valor_desconto: parseFloat(row.valor_desconto?.replace(",", ".")) || 0,
          valor_total: parseFloat(row.valor_total?.replace(",", ".")) || 0,
          status: row.status || "finalizada",
          cfop: row.cfop ? parseInt(row.cfop) || null : null,
          atendente_id: row.atendente_id ? parseInt(row.atendente_id) || null : null,
          source: row.source || "sale",
        },
      };
    }

    if (entidade === "venda_itens") {
      const vendaId = parseInt(row.venda_external_id);
      if (isNaN(vendaId) || vendaId <= 0) throw new Error("venda_external_id inválido");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          venda_external_id: vendaId,
          produto_external_id: row.produto_external_id ? parseInt(row.produto_external_id) || null : null,
          produto_nome: row.produto_nome || "Produto",
          quantidade: parseFloat(row.quantidade?.replace(",", ".")) || 0,
          valor_unitario: parseFloat(row.valor_unitario?.replace(",", ".")) || 0,
          valor_desconto: parseFloat(row.valor_desconto?.replace(",", ".")) || 0,
          valor_total: parseFloat(row.valor_total?.replace(",", ".")) || 0,
          custo_produto: parseFloat(row.custo_produto?.replace(",", ".")) || 0,
        },
      };
    }

    if (entidade === "venda_pagamentos") {
      const vendaId = parseInt(row.venda_external_id);
      if (isNaN(vendaId) || vendaId <= 0) throw new Error("venda_external_id inválido");
      const valor = parseFloat(row.valor?.replace(",", ".")) || 0;
      if (valor <= 0) throw new Error("valor deve ser maior que zero");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          venda_external_id: vendaId,
          forma_pagamento: row.forma_pagamento || "Outros",
          valor,
          parcelas: parseInt(row.parcelas) || 1,
        },
      };
    }

    if (entidade === "produtos") {
      const externalId = parseInt(row.external_id);
      if (isNaN(externalId) || externalId <= 0) throw new Error("external_id inválido");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          external_id: externalId,
          codigo: row.codigo || null,
          nome: row.nome || "Produto",
          grupo_id: row.grupo_id ? parseInt(row.grupo_id) || null : null,
          grupo_nome: row.grupo_nome || null,
          sub_grupo_id: row.sub_grupo_id ? parseInt(row.sub_grupo_id) || null : null,
          sub_grupo_nome: row.sub_grupo_nome || null,
          preco_venda: parseFloat(row.preco_venda?.replace(",", ".")) || 0,
          valor_custo: parseFloat(row.valor_custo?.replace(",", ".")) || 0,
          estoque_atual: parseFloat(row.estoque_atual?.replace(",", ".")) || 0,
          estoque_minimo: parseFloat(row.estoque_minimo?.replace(",", ".")) || 0,
          ativo: row.ativo?.toLowerCase() !== "false",
          usa_ecommerce: row.usa_ecommerce?.toLowerCase() === "true",
          peso: parseFloat(row.peso?.replace(",", ".")) || 0,
          peso_liq: parseFloat(row.peso_liq?.replace(",", ".")) || 0,
          largura: parseFloat(row.largura?.replace(",", ".")) || 0,
          altura: parseFloat(row.altura?.replace(",", ".")) || 0,
          comprimento: parseFloat(row.comprimento?.replace(",", ".")) || 0,
        },
      };
    }

    if (entidade === "vendedores") {
      const externalId = parseInt(row.external_id);
      if (isNaN(externalId) || externalId <= 0) throw new Error("external_id inválido");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          external_id: externalId,
          nome: row.nome || "Vendedor",
          apelido: row.apelido || null,
          email: row.email || null,
          perfil: parseInt(row.perfil) || 0,
          ativo: row.ativo?.toLowerCase() !== "false",
        },
      };
    }

    if (entidade === "clientes") {
      const externalId = parseInt(row.external_id);
      if (isNaN(externalId) || externalId <= 0) throw new Error("external_id inválido");
      return {
        valido: true,
        dado: {
          linha: linhaNum,
          external_id: externalId,
          nome: row.nome || "",
          cnpj_cpf: row.cnpj_cpf || null,
          email: row.email || null,
          telefone: row.telefone || null,
          cidade: row.cidade || null,
          estado: row.estado || null,
          ativo: row.ativo?.toLowerCase() !== "false",
        },
      };
    }

    return { valido: false, erro: "entidade desconhecida", dado: {} };
  } catch (err) {
    return {
      valido: false,
      erro: err instanceof Error ? err.message : "Erro de transformação",
      dado: {},
    };
  }
}

// ── Upload e validação de CSV ─────────────────────────────────────────────

export async function uploadCSV(
  lojaId: string,
  entidade: Entidade,
  nomeArquivo: string,
  conteudoBase64: string
): Promise<{ error?: string; importacaoId?: string; validas?: number; invalidas?: number; errosAmostra?: string[] }> {
  try {
    const userId = await verificarAdmin();
    const adminClient = createAdminClient();

    const { data: loja } = await adminClient
      .from("lojas")
      .select("id, name")
      .eq("id", lojaId)
      .eq("is_active", true)
      .maybeSingle();

    if (!loja) return { error: "Loja não encontrada ou inativa" };

    const conteudo = Buffer.from(conteudoBase64, "base64").toString("utf-8");
    const { headers, rows } = parsearCSV(conteudo);

    if (rows.length === 0) return { error: "Arquivo CSV vazio ou sem dados" };

    const config = ENTIDADES_CONFIG[entidade];
    const colunasAusentes = config.colunas_obrigatorias.filter((col) => !headers.includes(col));
    if (colunasAusentes.length > 0) {
      return { error: `Colunas obrigatórias ausentes no cabeçalho: ${colunasAusentes.join(", ")}` };
    }

    const { data: importacao, error: importErr } = await adminClient
      .from("staging_importacoes")
      .insert({
        loja_id: lojaId,
        entidade,
        arquivo_nome: nomeArquivo,
        total_linhas: rows.length,
        status: "validando",
        importado_por: userId,
      })
      .select("id, import_batch_id")
      .single();

    if (importErr || !importacao) {
      return { error: `Erro ao criar registro de importação: ${importErr?.message}` };
    }

    const CHUNK = 500;
    let validas = 0;
    let invalidas = 0;
    const errosAmostra: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const linhasValidas: Record<string, unknown>[] = [];
      const linhasInvalidas: Record<string, unknown>[] = [];

      chunk.forEach((row, idx) => {
        const linhaNum = i + idx + 2;
        const resultado = validarLinha(row, entidade, linhaNum);

        const base = {
          importacao_id: importacao.id,
          loja_id: lojaId,
          ...resultado.dado,
          valido: resultado.valido,
          erro_validacao: resultado.erro ?? null,
        };

        if (resultado.valido) {
          validas++;
          linhasValidas.push(base);
        } else {
          invalidas++;
          linhasInvalidas.push(base);
          if (errosAmostra.length < 5) {
            errosAmostra.push(`Linha ${linhaNum}: ${resultado.erro}`);
          }
        }
      });

      const todasLinhas = [...linhasValidas, ...linhasInvalidas];
      if (todasLinhas.length > 0) {
        const { error: insertErr } = await adminClient
          .from(config.tabela_staging)
          .insert(todasLinhas);
        if (insertErr) {
          await adminClient
            .from("staging_importacoes")
            .update({ status: "erro", concluido_em: new Date().toISOString() })
            .eq("id", importacao.id);
          return { error: `Erro ao inserir staging: ${insertErr.message}` };
        }
      }
    }

    await adminClient
      .from("staging_importacoes")
      .update({
        status: invalidas === rows.length ? "erro" : "validado",
        linhas_validas: validas,
        linhas_invalidas: invalidas,
        erros_amostra: errosAmostra,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", importacao.id);

    revalidatePath("/admin/empresas");
    return { importacaoId: importacao.id, validas, invalidas, errosAmostra };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Funções de upload em chunks ───────────────────────────────────────────

export async function criarImportacao(
  lojaId: string,
  entidade: Entidade,
  nomeArquivo: string,
  totalLinhas: number,
  userId: string
): Promise<{ error?: string; importacaoId?: string; batchId?: string }> {
  const adminClient = createAdminClient();

  const { data: loja } = await adminClient
    .from("lojas")
    .select("id")
    .eq("id", lojaId)
    .eq("is_active", true)
    .maybeSingle();

  if (!loja) return { error: "Loja não encontrada ou inativa" };

  const { data: importacao, error } = await adminClient
    .from("staging_importacoes")
    .insert({
      loja_id: lojaId,
      entidade,
      arquivo_nome: nomeArquivo,
      total_linhas: totalLinhas,
      status: "validando",
      importado_por: userId,
    })
    .select("id, import_batch_id")
    .single();

  if (error || !importacao) {
    return { error: error?.message ?? "Erro ao criar importação" };
  }

  return {
    importacaoId: importacao.id as string,
    batchId: importacao.import_batch_id as string,
  };
}

export async function processarChunk(
  importacaoId: string,
  lojaId: string,
  entidade: Entidade,
  rows: Record<string, string>[],
  offsetInicio: number
): Promise<{ error?: string; validas: number; invalidas: number; erros: string[] }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    const { data: importacao } = await adminClient
      .from("staging_importacoes")
      .select("id, loja_id, status")
      .eq("id", importacaoId)
      .eq("loja_id", lojaId)
      .maybeSingle();

    if (!importacao) return { error: "Importação não encontrada", validas: 0, invalidas: 0, erros: [] };
    if (importacao.status === "concluido") return { error: "Importação já concluída", validas: 0, invalidas: 0, erros: [] };

    const config = ENTIDADES_CONFIG[entidade];
    const linhasValidas: Record<string, unknown>[] = [];
    const linhasInvalidas: Record<string, unknown>[] = [];
    const erros: string[] = [];

    rows.forEach((row, idx) => {
      const linhaNum = offsetInicio + idx + 2;
      const resultado = validarLinha(row, entidade, linhaNum);
      const base = {
        importacao_id: importacaoId,
        loja_id: lojaId,
        ...resultado.dado,
        valido: resultado.valido,
        erro_validacao: resultado.erro ?? null,
      };
      if (resultado.valido) {
        linhasValidas.push(base);
      } else {
        linhasInvalidas.push(base);
        if (erros.length < 5) erros.push(`Linha ${linhaNum}: ${resultado.erro}`);
      }
    });

    const todas = [...linhasValidas, ...linhasInvalidas];
    if (todas.length > 0) {
      const { error: insertErr } = await adminClient
        .from(config.tabela_staging)
        .insert(todas);
      if (insertErr) return { error: insertErr.message, validas: 0, invalidas: 0, erros: [] };
    }

    return { validas: linhasValidas.length, invalidas: linhasInvalidas.length, erros };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro",
      validas: 0,
      invalidas: 0,
      erros: [],
    };
  }
}

export async function finalizarUpload(
  importacaoId: string,
  totalValidas: number,
  totalInvalidas: number,
  errosAmostra: string[]
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    await adminClient
      .from("staging_importacoes")
      .update({
        status: totalInvalidas === totalValidas + totalInvalidas ? "erro" : "validado",
        linhas_validas: totalValidas,
        linhas_invalidas: totalInvalidas,
        erros_amostra: errosAmostra,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", importacaoId);

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Confirmar UMA PÁGINA do staging → tabelas finais (sem timeout) ──────────
// Chamada em loop pelo frontend, 1000 linhas por request.

export async function confirmarPagina(
  importacaoId: string,
  pagina: number
): Promise<{
  error?: string;
  importados: number;
  pagina: number;
  totalPaginas: number;
  concluido: boolean;
}> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();
    const PAGE_SIZE = 1000;

    const { data: importacao } = await adminClient
      .from("staging_importacoes")
      .select("*")
      .eq("id", importacaoId)
      .in("status", ["validado", "importando"])
      .maybeSingle();

    if (!importacao) return { error: "Importação não encontrada ou não está validada", importados: 0, pagina, totalPaginas: 0, concluido: false };

    const lojaId = importacao.loja_id as string;
    const entidade = importacao.entidade as Entidade;
    const batchId = importacao.import_batch_id as string;
    const totalValidas = (importacao.linhas_validas as number) ?? 0;
    const totalPaginas = Math.ceil(totalValidas / PAGE_SIZE);
    const agora = new Date().toISOString();

    if (pagina === 0) {
      await adminClient
        .from("staging_importacoes")
        .update({ status: "importando" })
        .eq("id", importacaoId);
    }

    const offset = pagina * PAGE_SIZE;
    let importados = 0;

    if (entidade === "vendas") {
      const { data: linhas } = await adminClient
        .from("staging_vendas")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          source: r.source ?? "sale",
          numero_venda: String(r.external_id),
          data_venda: r.data_venda,
          cliente_external_id: r.cliente_external_id,
          cliente_nome: r.cliente_nome,
          cpf_cnpj: r.cpf_cnpj,
          valor_bruto: r.valor_bruto,
          valor_desconto: r.valor_desconto,
          valor_total: r.valor_total,
          status: r.status,
          cfop: r.cfop,
          atendente_id: r.atendente_id,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("vendas")
          .upsert(rows, { onConflict: "loja_id,external_id,source" });
        if (error) throw new Error(`Erro upsert vendas p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    if (entidade === "venda_itens") {
      const { data: linhas } = await adminClient
        .from("staging_venda_itens")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const vendaIds = [...new Set(linhas.map((r: Record<string, unknown>) => r.venda_external_id as number))];
        await adminClient.from("venda_itens").delete().eq("loja_id", lojaId).in("venda_external_id", vendaIds);
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          venda_external_id: r.venda_external_id,
          produto_external_id: r.produto_external_id,
          produto_nome: r.produto_nome,
          quantidade: r.quantidade,
          valor_unitario: r.valor_unitario,
          valor_desconto: r.valor_desconto,
          valor_total: r.valor_total,
          custo_produto: r.custo_produto,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient.from("venda_itens").insert(rows);
        if (error) throw new Error(`Erro insert venda_itens p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    if (entidade === "venda_pagamentos") {
      const { data: linhas } = await adminClient
        .from("staging_venda_pagamentos")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          venda_external_id: r.venda_external_id,
          forma_pagamento: r.forma_pagamento,
          valor: r.valor,
          parcelas: r.parcelas,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("venda_pagamentos")
          .upsert(rows, { onConflict: "loja_id,venda_external_id,forma_pagamento" });
        if (error) throw new Error(`Erro upsert venda_pagamentos p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    if (entidade === "produtos") {
      const { data: linhas } = await adminClient
        .from("staging_produtos")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          codigo: r.codigo,
          nome: r.nome,
          grupo_id: r.grupo_id,
          grupo_nome: r.grupo_nome,
          sub_grupo_id: r.sub_grupo_id,
          sub_grupo_nome: r.sub_grupo_nome,
          preco_venda: r.preco_venda,
          valor_custo: r.valor_custo,
          estoque_atual: r.estoque_atual,
          estoque_minimo: r.estoque_minimo,
          ativo: r.ativo,
          usa_ecommerce: r.usa_ecommerce,
          peso: r.peso,
          peso_liq: r.peso_liq,
          largura: r.largura,
          altura: r.altura,
          comprimento: r.comprimento,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("produtos")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert produtos p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    if (entidade === "vendedores") {
      const { data: linhas } = await adminClient
        .from("staging_vendedores")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          nome: r.nome,
          apelido: r.apelido,
          email: r.email,
          perfil: r.perfil,
          ativo: r.ativo,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("vendedores")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert vendedores p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    if (entidade === "clientes") {
      const { data: linhas } = await adminClient
        .from("staging_clientes")
        .select("*")
        .eq("importacao_id", importacaoId)
        .eq("valido", true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (linhas && linhas.length > 0) {
        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          nome: r.nome,
          cnpj_cpf: r.cnpj_cpf,
          email: r.email,
          telefone: r.telefone,
          cidade: r.cidade,
          estado: r.estado,
          ativo: r.ativo,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("clientes")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert clientes p${pagina}: ${error.message}`);
        importados = rows.length;
      }
    }

    const concluido = pagina >= totalPaginas - 1;

    if (concluido) {
      await adminClient.from("sync_log").insert({
        loja_id: lojaId,
        tabela: "csv_import",
        status: "concluido",
        inicio: agora,
        fim: agora,
        total_registros: totalValidas,
      });
      await adminClient
        .from("staging_importacoes")
        .update({ status: "concluido", concluido_em: agora })
        .eq("id", importacaoId);
    }

    revalidatePath("/admin/empresas");
    return { importados, pagina, totalPaginas, concluido };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await createAdminClient()
      .from("staging_importacoes")
      .update({ status: "erro", concluido_em: new Date().toISOString() })
      .eq("id", importacaoId);
    return { error: msg, importados: 0, pagina, totalPaginas: 0, concluido: false };
  }
}

// ── Confirmar importação: staging → tabelas finais (mantido por compatibilidade) ──

export async function confirmarImportacao(
  importacaoId: string
): Promise<{ error?: string; importados?: number }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    const { data: importacao } = await adminClient
      .from("staging_importacoes")
      .select("*")
      .eq("id", importacaoId)
      .eq("status", "validado")
      .maybeSingle();

    if (!importacao) return { error: "Importação não encontrada ou não está validada" };

    const lojaId = importacao.loja_id as string;
    const entidade = importacao.entidade as Entidade;
    const batchId = importacao.import_batch_id as string;
    const agora = new Date().toISOString();

    await adminClient
      .from("staging_importacoes")
      .update({ status: "importando" })
      .eq("id", importacaoId);

    let totalImportados = 0;
    const PAGE_SIZE = 1000;

    if (entidade === "vendas") {
      let paginaVendas = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_vendas")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaVendas * PAGE_SIZE, (paginaVendas + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          source: r.source ?? "sale",
          numero_venda: String(r.external_id),
          data_venda: r.data_venda,
          cliente_external_id: r.cliente_external_id,
          cliente_nome: r.cliente_nome,
          cpf_cnpj: r.cpf_cnpj,
          valor_bruto: r.valor_bruto,
          valor_desconto: r.valor_desconto,
          valor_total: r.valor_total,
          status: r.status,
          cfop: r.cfop,
          atendente_id: r.atendente_id,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("vendas")
          .upsert(rows, { onConflict: "loja_id,external_id,source" });
        if (error) throw new Error(`Erro upsert vendas: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaVendas++;
      }
    }

    if (entidade === "venda_itens") {
      let paginaItens = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_venda_itens")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaItens * PAGE_SIZE, (paginaItens + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          venda_external_id: r.venda_external_id,
          produto_external_id: r.produto_external_id,
          produto_nome: r.produto_nome,
          quantidade: r.quantidade,
          valor_unitario: r.valor_unitario,
          valor_desconto: r.valor_desconto,
          valor_total: r.valor_total,
          custo_produto: r.custo_produto,
          import_batch_id: batchId,
        }));
        const vendaIds = [...new Set(linhas.map((r: Record<string, unknown>) => r.venda_external_id as number))];
        await adminClient
          .from("venda_itens")
          .delete()
          .eq("loja_id", lojaId)
          .in("venda_external_id", vendaIds);
        const { error } = await adminClient.from("venda_itens").insert(rows);
        if (error) throw new Error(`Erro insert venda_itens: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaItens++;
      }
    }

    if (entidade === "venda_pagamentos") {
      let paginaPagamentos = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_venda_pagamentos")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaPagamentos * PAGE_SIZE, (paginaPagamentos + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          venda_external_id: r.venda_external_id,
          forma_pagamento: r.forma_pagamento,
          valor: r.valor,
          parcelas: r.parcelas,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("venda_pagamentos")
          .upsert(rows, { onConflict: "loja_id,venda_external_id,forma_pagamento" });
        if (error) throw new Error(`Erro upsert venda_pagamentos: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaPagamentos++;
      }
    }

    if (entidade === "produtos") {
      let paginaProdutos = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_produtos")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaProdutos * PAGE_SIZE, (paginaProdutos + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          codigo: r.codigo,
          nome: r.nome,
          grupo_id: r.grupo_id,
          grupo_nome: r.grupo_nome,
          sub_grupo_id: r.sub_grupo_id,
          sub_grupo_nome: r.sub_grupo_nome,
          preco_venda: r.preco_venda,
          valor_custo: r.valor_custo,
          estoque_atual: r.estoque_atual,
          estoque_minimo: r.estoque_minimo,
          ativo: r.ativo,
          usa_ecommerce: r.usa_ecommerce,
          peso: r.peso,
          peso_liq: r.peso_liq,
          largura: r.largura,
          altura: r.altura,
          comprimento: r.comprimento,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("produtos")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert produtos: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaProdutos++;
      }
    }

    if (entidade === "vendedores") {
      let paginaVendedores = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_vendedores")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaVendedores * PAGE_SIZE, (paginaVendedores + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          nome: r.nome,
          apelido: r.apelido,
          email: r.email,
          perfil: r.perfil,
          ativo: r.ativo,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("vendedores")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert vendedores: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaVendedores++;
      }
    }

    if (entidade === "clientes") {
      let paginaClientes = 0;
      while (true) {
        const { data: linhas } = await adminClient
          .from("staging_clientes")
          .select("*")
          .eq("importacao_id", importacaoId)
          .eq("valido", true)
          .range(paginaClientes * PAGE_SIZE, (paginaClientes + 1) * PAGE_SIZE - 1);

        if (!linhas || linhas.length === 0) break;

        const rows = linhas.map((r: Record<string, unknown>) => ({
          loja_id: lojaId,
          external_id: r.external_id,
          nome: r.nome,
          cnpj_cpf: r.cnpj_cpf,
          email: r.email,
          telefone: r.telefone,
          cidade: r.cidade,
          estado: r.estado,
          ativo: r.ativo,
          sincronizado_em: agora,
          import_batch_id: batchId,
        }));
        const { error } = await adminClient
          .from("clientes")
          .upsert(rows, { onConflict: "loja_id,external_id" });
        if (error) throw new Error(`Erro upsert clientes: ${error.message}`);
        totalImportados += rows.length;

        if (linhas.length < PAGE_SIZE) break;
        paginaClientes++;
      }
    }

    await adminClient.from("sync_log").insert({
      loja_id: lojaId,
      tabela: "csv_import",
      status: "concluido",
      inicio: agora,
      fim: agora,
      total_registros: totalImportados,
    });

    await adminClient
      .from("staging_importacoes")
      .update({ status: "concluido", concluido_em: new Date().toISOString() })
      .eq("id", importacaoId);

    revalidatePath("/admin/empresas");
    return { importados: totalImportados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await createAdminClient()
      .from("staging_importacoes")
      .update({ status: "erro", concluido_em: new Date().toISOString() })
      .eq("id", importacaoId);
    return { error: msg };
  }
}

// ── Reverter importação por batch ─────────────────────────────────────────

export async function reverterImportacao(
  importacaoId: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    const { data: importacao } = await adminClient
      .from("staging_importacoes")
      .select("loja_id, entidade, import_batch_id, status")
      .eq("id", importacaoId)
      .maybeSingle();

    if (!importacao) return { error: "Importação não encontrada" };
    if (importacao.status !== "concluido") return { error: "Só é possível reverter importações concluídas" };

    const lojaId = importacao.loja_id as string;
    const batchId = importacao.import_batch_id as string;
    const entidade = importacao.entidade as string;

    const tabelas: Record<string, string> = {
      vendas: "vendas",
      venda_itens: "venda_itens",
      venda_pagamentos: "venda_pagamentos",
      produtos: "produtos",
      vendedores: "vendedores",
      clientes: "clientes",
    };

    const tabela = tabelas[entidade];
    if (tabela) {
      await adminClient
        .from(tabela)
        .delete()
        .eq("loja_id", lojaId)
        .eq("import_batch_id", batchId);
    }

    await adminClient
      .from("staging_importacoes")
      .update({ status: "revertido" })
      .eq("id", importacaoId);

    revalidatePath("/admin/empresas");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao reverter" };
  }
}

// ── Listar importações de uma loja ────────────────────────────────────────

export async function listarImportacoes(lojaId: string) {
  await verificarAdmin();
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("staging_importacoes")
    .select(
      "id, entidade, arquivo_nome, total_linhas, linhas_validas, linhas_invalidas, status, erros_amostra, iniciado_em, concluido_em"
    )
    .eq("loja_id", lojaId)
    .order("iniciado_em", { ascending: false })
    .limit(50);

  return data ?? [];
}

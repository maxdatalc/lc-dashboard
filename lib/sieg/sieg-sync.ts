/**
 * SIEG Sync Engine — server-side only.
 *
 * Busca NFs não enviadas via Bridge SQL, decodifica o XML e envia para SIEG.
 * Registra resultado por chave de acesso na tabela sieg_envios (Supabase).
 */

import zlib from "zlib";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { siegEnviarXml } from "./sieg-client";

const LOTE_SIZE = 50; // XMLs por ciclo (respeita rate limit 2000/min)
const BACK_OFF_HORAS = [1, 4, 24, 48, 168]; // horas até próxima tentativa por nível de erro

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SiegConfig {
  id: string;
  loja_id: string;
  emp_id: number;
  cnpj: string;
  razao_social: string | null;
  oauth_token: string; // encriptado
  data_inicio: string; // ISO — só sincroniza NFs emitidas a partir desta data
  sql_bridge_url: string;
  sql_bridge_token: string; // encriptado
}

interface NfRow {
  nfIdNFe: string;
  nfDataEmissao: string;
  nfTipoNfSped: string;
  nfTipoNf: string;
  nfVlrTotalNota: number;
  nfNFeXMLDestinatarioBase64Zip: string;
  nfNFeXMLCancelamento: string | null;
}

export interface SyncResult {
  lojaId: string;
  empId: number;
  cnpj: string;
  enviados: number;
  erros: number;
  ignorados: number;
  detalhes: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodificarXml(base64Zip: string): string {
  return zlib.inflateSync(Buffer.from(base64Zip, "base64")).toString("utf-8");
}

function calcularProximaTentativa(tentativas: number): Date {
  const horas = BACK_OFF_HORAS[Math.min(tentativas, BACK_OFF_HORAS.length - 1)];
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Query de NFs pendentes ───────────────────────────────────────────────────

async function buscarNfsPendentes(
  bridgeUrl: string,
  bridgeToken: string,
  empId: number,
  dataInicio: string,
  chavesJaEnviadas: Set<string>,
): Promise<NfRow[]> {
  const rows = await queryBridge<NfRow>(
    { url: bridgeUrl, token: bridgeToken },
    `
    SELECT TOP ${LOTE_SIZE}
      nfIdNFe,
      nfDataEmissao,
      nfTipoNfSped,
      nfTipoNf,
      nfVlrTotalNota,
      nfNFeXMLDestinatarioBase64Zip,
      nfNFeXMLCancelamento
    FROM nf
    WHERE empId             = @empId
      AND nfNfeAutorizado   = 1
      AND nfTipoNfSped      IN ('55', '65')
      AND nfDataEmissao     >= @dataInicio
      AND LEN(ISNULL(nfNFeXMLDestinatarioBase64Zip, '')) > 0
    ORDER BY nfDataEmissao ASC
    `,
    { empId, dataInicio },
  );

  // Filtra chaves já enviadas com sucesso (vindas do Supabase)
  return rows.filter((r) => !chavesJaEnviadas.has(r.nfIdNFe));
}

// ─── Busca chaves já enviadas no Supabase ─────────────────────────────────────

async function buscarChavesEnviadas(
  supabase: ReturnType<typeof supabaseAdmin>,
  lojaId: string,
  empId: number,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("sieg_envios")
    .select("chave_acesso")
    .eq("loja_id", lojaId)
    .eq("emp_id", empId)
    .eq("status", "enviado");

  return new Set((data ?? []).map((r: { chave_acesso: string }) => r.chave_acesso));
}

// ─── Busca NFs com erro e tentativa vencida ───────────────────────────────────

async function buscarChavesParaRetentativa(
  supabase: ReturnType<typeof supabaseAdmin>,
  lojaId: string,
  empId: number,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("sieg_envios")
    .select("chave_acesso")
    .eq("loja_id", lojaId)
    .eq("emp_id", empId)
    .eq("status", "erro")
    .lte("proxima_tentativa", new Date().toISOString());

  return new Set((data ?? []).map((r: { chave_acesso: string }) => r.chave_acesso));
}

// ─── Registra resultado no Supabase ──────────────────────────────────────────

async function registrarEnvio(
  supabase: ReturnType<typeof supabaseAdmin>,
  lojaId: string,
  empId: number,
  nf: NfRow,
  resultado: { ok: boolean; erro?: string; sieg_response?: unknown },
  tentativasAnterior = 0,
) {
  const tentativas = tentativasAnterior + 1;
  const agora = new Date().toISOString();

  const payload = {
    loja_id:       lojaId,
    emp_id:        empId,
    chave_acesso:  nf.nfIdNFe,
    tipo_sped:     nf.nfTipoNfSped,
    tipo_op:       nf.nfTipoNf,
    data_emissao:  nf.nfDataEmissao,
    valor_total:   nf.nfVlrTotalNota,
    status:        resultado.ok ? "enviado" : "erro",
    tentativas,
    data_envio:    resultado.ok ? agora : null,
    erro_msg:      resultado.erro ?? null,
    sieg_response: resultado.sieg_response ? JSON.stringify(resultado.sieg_response) : null,
    proxima_tentativa: resultado.ok ? null : calcularProximaTentativa(tentativas).toISOString(),
    atualizado_em: agora,
  };

  await supabase
    .from("sieg_envios")
    .upsert(payload, { onConflict: "loja_id,emp_id,chave_acesso" });
}

// ─── Sync de uma empresa ──────────────────────────────────────────────────────

async function sincronizarEmpresa(
  supabase: ReturnType<typeof supabaseAdmin>,
  config: SiegConfig,
): Promise<SyncResult> {
  const result: SyncResult = {
    lojaId:    config.loja_id,
    empId:     config.emp_id,
    cnpj:      config.cnpj,
    enviados:  0,
    erros:     0,
    ignorados: 0,
    detalhes:  [],
  };

  const oauthToken    = decrypt(config.oauth_token);
  const bridgeToken   = decrypt(config.sql_bridge_token);

  // Chaves já enviadas com sucesso → excluir da query
  const chavesEnviadas = await buscarChavesEnviadas(supabase, config.loja_id, config.emp_id);

  // Chaves com erro prontas para retentativa
  const paraRetentativa = await buscarChavesParaRetentativa(supabase, config.loja_id, config.emp_id);

  // Busca NFs pendentes no MaxManager (somente a partir de data_inicio)
  let nfs: NfRow[];
  try {
    nfs = await buscarNfsPendentes(config.sql_bridge_url, bridgeToken, config.emp_id, config.data_inicio, chavesEnviadas);
  } catch (err) {
    result.detalhes.push(`Bridge erro: ${(err as Error).message}`);
    return result;
  }

  // Adiciona NFs com erro prontas para retentativa (já estão no banco, mas precisam ser re-enviadas)
  const nfsParaEnviar = nfs.filter(
    (nf) => !chavesEnviadas.has(nf.nfIdNFe) || paraRetentativa.has(nf.nfIdNFe),
  );

  for (const nf of nfsParaEnviar) {
    // Busca tentativas anteriores para back-off correto
    const { data: envioAnterior } = await supabase
      .from("sieg_envios")
      .select("tentativas")
      .eq("loja_id", config.loja_id)
      .eq("emp_id", config.emp_id)
      .eq("chave_acesso", nf.nfIdNFe)
      .maybeSingle();

    const tentativasAnterior = (envioAnterior as { tentativas: number } | null)?.tentativas ?? 0;

    let xmlContent: string;
    try {
      xmlContent = decodificarXml(nf.nfNFeXMLDestinatarioBase64Zip);
    } catch {
      result.ignorados++;
      result.detalhes.push(`${nf.nfIdNFe}: erro ao decodificar XML`);
      await registrarEnvio(supabase, config.loja_id, config.emp_id, nf,
        { ok: false, erro: "Falha ao decodificar Base64+zlib" }, tentativasAnterior);
      continue;
    }

    const res = await siegEnviarXml(oauthToken, xmlContent);

    if (res.ok) {
      result.enviados++;
    } else {
      result.erros++;
      result.detalhes.push(`${nf.nfIdNFe}: ${res.erro}`);
    }

    await registrarEnvio(supabase, config.loja_id, config.emp_id, nf, {
      ok:            res.ok,
      erro:          res.erro,
      sieg_response: res.body,
    }, tentativasAnterior);

    // Pequena pausa entre envios para respeitar rate limit (2000/min = ~30ms por req)
    await new Promise((r) => setTimeout(r, 40));
  }

  return result;
}

// ─── Entry point público ──────────────────────────────────────────────────────

/**
 * Sincroniza todas as empresas ativas configuradas no SIEG.
 * Se lojaId for passado, sincroniza apenas aquela loja.
 */
export async function executarSyncSieg(
  lojaId?: string,
  empId?: number,
): Promise<SyncResult[]> {
  const supabase = supabaseAdmin();

  // Busca configs ativas com dados do Bridge da loja
  let query = supabase
    .from("sieg_configuracoes")
    .select(`
      id, loja_id, emp_id, cnpj, razao_social, oauth_token, data_inicio, ativo,
      lojas!inner ( sql_bridge_url, sql_bridge_token )
    `)
    .eq("ativo", true)
    .not("lojas.sql_bridge_url", "is", null);

  if (lojaId) query = query.eq("loja_id", lojaId);
  if (empId !== undefined) query = query.eq("emp_id", empId);

  const { data: configs, error } = await query;

  if (error) throw new Error(`Erro ao buscar sieg_configuracoes: ${error.message}`);
  if (!configs?.length) return [];

  const resultados: SyncResult[] = [];

  for (const cfg of configs) {
    const loja = (cfg.lojas as unknown as { sql_bridge_url: string; sql_bridge_token: string });
    if (!loja?.sql_bridge_url || !loja?.sql_bridge_token) continue;

    try {
      const r = await sincronizarEmpresa(supabase, {
        id:               cfg.id as string,
        loja_id:          cfg.loja_id as string,
        emp_id:           cfg.emp_id as number,
        cnpj:             cfg.cnpj as string,
        razao_social:     cfg.razao_social as string | null,
        oauth_token:      cfg.oauth_token as string,
        data_inicio:      cfg.data_inicio as string,
        sql_bridge_url:   loja.sql_bridge_url,
        sql_bridge_token: loja.sql_bridge_token,
      });
      resultados.push(r);
    } catch (err) {
      resultados.push({
        lojaId:    cfg.loja_id as string,
        empId:     cfg.emp_id as number,
        cnpj:      cfg.cnpj as string,
        enviados:  0,
        erros:     1,
        ignorados: 0,
        detalhes:  [`Erro crítico: ${(err as Error).message}`],
      });
    }
  }

  return resultados;
}

// ─── Limpeza periódica de envios antigos ──────────────────────────────────────

/**
 * Remove registros de envios com status 'enviado' ou 'ignorado' mais antigos que retencaoDias.
 * Chamado mensalmente pelo cron de manutenção.
 */
export async function limparEnviosAntigos(retencaoDias = 90): Promise<number> {
  const supabase = supabaseAdmin();
  const limite = new Date(Date.now() - retencaoDias * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("sieg_envios")
    .delete({ count: "exact" })
    .in("status", ["enviado", "ignorado"])
    .lt("atualizado_em", limite);

  return count ?? 0;
}

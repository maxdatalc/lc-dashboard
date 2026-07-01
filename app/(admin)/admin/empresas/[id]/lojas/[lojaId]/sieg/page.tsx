export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "@/lib/crypto";
import { queryBridge } from "@/lib/bridge/bridge-client";
import SiegForm from "./sieg-form";

// ─── Helpers de dados ─────────────────────────────────────────────────────────

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface LojaComBridge {
  id: string;
  name: string;
  tenant_id: string;
  sql_bridge_url: string | null;
  sql_bridge_token: string | null;
}

interface EmpresaMaxManager {
  cofId: number;
  cofEmpCnpj: string;
  cofEmpRazao: string;
  cofEmpFantasia: string | null;
}

async function carregarDados(lojaId: string, tenantId: string) {
  const supabase = supabaseAdmin();

  const { data: loja } = await supabase
    .from("lojas")
    .select("id, name, tenant_id, sql_bridge_url, sql_bridge_token")
    .eq("id", lojaId)
    .single<LojaComBridge>();

  if (!loja || loja.tenant_id !== tenantId) return null;

  // Busca empresas (empIds) via Bridge
  let empresas: EmpresaMaxManager[] = [];
  if (loja.sql_bridge_url && loja.sql_bridge_token) {
    try {
      const token = decrypt(loja.sql_bridge_token);
      empresas = await queryBridge<EmpresaMaxManager>(
        { url: loja.sql_bridge_url, token },
        "SELECT cofId, cofEmpCnpj, cofEmpRazao, cofEmpFantasia FROM config ORDER BY cofId",
      );
    } catch {
      // Bridge offline — mostra lista vazia, permite config manual
    }
  }

  // Busca configs SIEG já salvas para esta loja
  const { data: configs } = await supabase
    .from("sieg_configuracoes")
    .select("emp_id, oauth_token, ativo, data_inicio")
    .eq("loja_id", lojaId);

  const configMap = new Map(
    (configs ?? []).map((c: { emp_id: number; oauth_token: string; ativo: boolean; data_inicio: string }) => [
      c.emp_id,
      { oauthTokenMascarado: "••••••••", ativo: c.ativo, dataInicio: c.data_inicio },
    ]),
  );

  return { loja, empresas, configMap };
}

// ─── Server Action ────────────────────────────────────────────────────────────

async function salvarSiegConfig(
  lojaId: string,
  _prevState: { erro: string | null; sucesso?: boolean },
  formData: FormData,
): Promise<{ erro: string | null; sucesso?: boolean }> {
  "use server";

  const empId       = parseInt(formData.get("empId") as string);
  const cnpj        = (formData.get("cnpj") as string).replace(/\D/g, "");
  const razaoSocial = formData.get("razaoSocial") as string;
  const oauthTokenRaw = (formData.get("oauthToken") as string ?? "").trim();
  const ativo       = formData.get("ativo") === "on";
  const dataInicio  = (formData.get("dataInicio") as string ?? "").trim() || new Date().toISOString().slice(0, 10);

  if (isNaN(empId) || !cnpj) {
    return { erro: "Dados da empresa inválidos." };
  }

  const supabase = supabaseAdmin();

  // Verifica se já existe registro para manter o token anterior se campo vazio
  let oauthTokenEncriptado: string | undefined;
  if (oauthTokenRaw) {
    oauthTokenEncriptado = encrypt(oauthTokenRaw);
  } else {
    const { data: existente } = await supabase
      .from("sieg_configuracoes")
      .select("oauth_token")
      .eq("loja_id", lojaId)
      .eq("emp_id", empId)
      .maybeSingle<{ oauth_token: string }>();

    if (!existente?.oauth_token) {
      return { erro: "OAuth Token é obrigatório no primeiro cadastro." };
    }
    oauthTokenEncriptado = existente.oauth_token;
  }

  const { error } = await supabase
    .from("sieg_configuracoes")
    .upsert(
      {
        loja_id:      lojaId,
        emp_id:       empId,
        cnpj:         cnpj,
        razao_social: razaoSocial,
        oauth_token:  oauthTokenEncriptado,
        data_inicio:  new Date(dataInicio).toISOString(),
        ativo,
      },
      { onConflict: "loja_id,emp_id" },
    );

  if (error) return { erro: `Erro ao salvar: ${error.message}` };
  return { erro: null, sucesso: true };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SiegConfigPage({
  params,
}: {
  params: Promise<{ id: string; lojaId: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const dados = await carregarDados(lojaId, tenantId);

  if (!dados) notFound();

  const { loja, empresas, configMap } = dados;
  const action = salvarSiegConfig.bind(null, lojaId);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="space-y-2" style={{ animation: "fadeInUp 0.3s ease-out both" }}>
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para lojas
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SIEG — Transmissão de XMLs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-mono">{loja.name}</span>
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Configure o OAuth Token por empresa (CNPJ) para envio automático de NF-e ao SIEG.
        </p>
      </div>

      {!loja.sql_bridge_url && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800 font-medium">Bridge SQL não configurada</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Configure a Bridge SQL desta loja para que as empresas (empIds) sejam detectadas automaticamente.
          </p>
        </div>
      )}

      {empresas.length === 0 && loja.sql_bridge_url && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">Bridge offline ou sem empresas cadastradas.</p>
        </div>
      )}

      <div className="space-y-6">
        {empresas.map((emp) => {
          const cfg = configMap.get(emp.cofId);
          const empresaConfig = {
            empId:               emp.cofId,
            cnpj:                emp.cofEmpCnpj,
            razaoSocial:         emp.cofEmpRazao,
            oauthTokenMascarado: cfg?.oauthTokenMascarado ?? "",
            ativo:               cfg?.ativo ?? true,
            dataInicio:          cfg?.dataInicio ?? new Date().toISOString(),
          };

          return (
            <SiegForm
              key={emp.cofId}
              action={action}
              empresa={empresaConfig}
              lojaId={lojaId}
              tenantId={tenantId}
            />
          );
        })}
      </div>
    </div>
  );
}

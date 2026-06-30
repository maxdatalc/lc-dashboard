export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import SiegPortalClient from "./sieg-portal-client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EmpresaResumo {
  empId: number;
  cnpj: string;
  razaoSocial: string;
  ativo: boolean;
  total: number;
  enviados: number;
  pendentes: number;
  erros: number;
  ultimoEnvio: string | null;
}

// ─── Dados do servidor ───────────────────────────────────────────────────────

async function carregarResumo(lojaId: string): Promise<EmpresaResumo[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: configs } = await supabase
    .from("sieg_configuracoes")
    .select("emp_id, cnpj, razao_social, ativo")
    .eq("loja_id", lojaId);

  if (!configs?.length) return [];

  const resumos: EmpresaResumo[] = [];

  for (const cfg of configs as Array<{ emp_id: number; cnpj: string; razao_social: string | null; ativo: boolean }>) {
    const { data: contagens } = await supabase
      .from("sieg_envios")
      .select("status, data_envio")
      .eq("loja_id", lojaId)
      .eq("emp_id", cfg.emp_id);

    const rows = (contagens ?? []) as Array<{ status: string; data_envio: string | null }>;
    const enviados  = rows.filter((r) => r.status === "enviado").length;
    const pendentes = rows.filter((r) => r.status === "pendente").length;
    const erros     = rows.filter((r) => r.status === "erro").length;

    const datas = rows
      .filter((r) => r.data_envio)
      .map((r) => r.data_envio as string)
      .sort()
      .reverse();

    resumos.push({
      empId:        cfg.emp_id,
      cnpj:         cfg.cnpj,
      razaoSocial:  cfg.razao_social ?? `Empresa ${cfg.emp_id}`,
      ativo:        cfg.ativo,
      total:        rows.length,
      enviados,
      pendentes,
      erros,
      ultimoEnvio: datas[0] ?? null,
    });
  }

  return resumos;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TransmissaoXmlsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Busca loja ativa do usuário
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: userLoja } = await supa
    .from("user_lojas")
    .select("loja_id")
    .eq("user_id", session.user.id)
    .limit(1)
    .single<{ loja_id: string }>();

  if (!userLoja?.loja_id) {
    return (
      <div className="p-8 text-center text-slate-500">
        Nenhuma loja associada a este usuário.
      </div>
    );
  }

  const empresas = await carregarResumo(userLoja.loja_id);

  return (
    <SiegPortalClient
      lojaId={userLoja.loja_id}
      empresas={empresas}
    />
  );
}

import { createAdminClient } from "@/lib/supabase/server";

export type ClienteBase = {
  id: string;
  codigo_externo: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_cpf: string | null;
  segmento: string | null;
  cidade: string | null;
  telefone: string | null;
  sql_bridge_token: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClienteBaseInput = Omit<ClienteBase, "id" | "created_at" | "updated_at" | "sql_bridge_token" | "tenant_id"> & {
  sql_bridge_token?: string | null;
};

const PER_PAGE = 30;

export async function getClientesBase(opts?: {
  q?: string;
  segmento?: string;
  cidade?: string;
  page?: number;
  status?: "cadastrados" | "pendentes";
  tenantId?: string;
}): Promise<{ data: ClienteBase[]; total: number }> {
  const supabase = createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = supabase
    .from("clientes_base")
    .select("*", { count: "exact" })
    .order("razao_social", { ascending: true });

  if (opts?.q) {
    query = query.or(
      `razao_social.ilike.%${opts.q}%,nome_fantasia.ilike.%${opts.q}%,cnpj_cpf.ilike.%${opts.q}%,codigo_externo.ilike.%${opts.q}%`
    );
  }
  if (opts?.segmento) query = query.eq("segmento", opts.segmento);
  if (opts?.cidade) query = query.eq("cidade", opts.cidade);
  if (opts?.tenantId) query = query.eq("tenant_id", opts.tenantId);
  if (opts?.status === "cadastrados") query = query.not("tenant_id", "is", null);
  if (opts?.status === "pendentes") query = query.is("tenant_id", null);

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as ClienteBase[], total: count ?? 0 };
}

export async function getClienteBaseById(id: string): Promise<ClienteBase | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clientes_base")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ClienteBase | null;
}

export async function getClientesByTenantId(tenantId: string): Promise<ClienteBase[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clientes_base")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("razao_social");
  if (error) throw new Error(error.message);
  return (data ?? []) as ClienteBase[];
}

/** Vincula clientes_base ao tenant pelos CNPJs das lojas. Retorna a quantidade vinculada. */
export async function vincularClientesPorCnpjs(
  tenantId: string,
  cnpjs: string[]
): Promise<number> {
  if (cnpjs.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clientes_base")
    .update({ tenant_id: tenantId, updated_at: new Date().toISOString() })
    .in("cnpj_cpf", cnpjs)
    .is("tenant_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/** Lista simplificada de tenants para o filtro de grupo. */
export async function getTenantsFiltro(): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}

export async function upsertClientesBase(
  clientes: ClienteBaseInput[]
): Promise<{ inseridos: number; atualizados: number }> {
  const supabase = createAdminClient();

  const codigos = clientes
    .map((c) => c.codigo_externo)
    .filter((c): c is string => !!c);

  let existentes = new Set<string>();
  if (codigos.length > 0) {
    const { data } = await supabase
      .from("clientes_base")
      .select("codigo_externo")
      .in("codigo_externo", codigos);
    existentes = new Set((data ?? []).map((r: { codigo_externo: string | null }) => r.codigo_externo ?? ""));
  }

  const payload = clientes.map((c) => ({
    ...c,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("clientes_base")
    .upsert(payload, { onConflict: "codigo_externo", ignoreDuplicates: false });

  if (error) throw new Error(error.message);

  const atualizados = clientes.filter(
    (c) => c.codigo_externo && existentes.has(c.codigo_externo)
  ).length;
  const inseridos = clientes.length - atualizados;

  return { inseridos, atualizados };
}

export async function updateClienteBaseToken(
  id: string,
  sql_bridge_token: string | null
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clientes_base")
    .update({ sql_bridge_token, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateClienteBase(
  id: string,
  data: Partial<ClienteBaseInput>
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clientes_base")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSegmentosDistintos(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clientes_base")
    .select("segmento")
    .not("segmento", "is", null)
    .order("segmento");
  const unique = [...new Set((data ?? []).map((r: { segmento: string | null }) => r.segmento ?? "").filter(Boolean))];
  return unique;
}

export async function getCidadesDistintas(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clientes_base")
    .select("cidade")
    .not("cidade", "is", null)
    .order("cidade");
  const unique = [...new Set((data ?? []).map((r: { cidade: string | null }) => r.cidade ?? "").filter(Boolean))];
  return unique;
}

export type ClienteCadastradoMatch = {
  tenantId: string;
  tenantName: string;
};

export async function getCnpjsCadastrados(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lojas")
    .select("cnpj")
    .not("cnpj", "is", null);
  return new Set(
    (data ?? [])
      .map((r: { cnpj: string | null }) => r.cnpj ?? "")
      .filter(Boolean)
  );
}

export async function getGrupoByCliente(
  _codigoExterno: string | null,
  cnpj: string | null
): Promise<ClienteCadastradoMatch | null> {
  const supabase = createAdminClient();

  if (cnpj) {
    const { data } = await supabase
      .from("lojas")
      .select("tenant_id, tenants(id, name)")
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (data) {
      const raw = data.tenants as unknown;
      const t = Array.isArray(raw) ? (raw[0] as { id?: string; name?: string }) : (raw as { id?: string; name?: string } | null);
      if (t?.id) return { tenantId: t.id, tenantName: t.name ?? "" };
    }
  }

  return null;
}

/** @deprecated use getGrupoByCliente */
export async function getGrupoByCnpj(cnpj: string): Promise<ClienteCadastradoMatch | null> {
  return getGrupoByCliente(null, cnpj);
}

export async function getClientesBaseStats(): Promise<{
  total: number;
  cidades: number;
  segmentos: number;
}> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("clientes_base")
    .select("*", { count: "exact", head: true });

  const [segData, cidData] = await Promise.all([
    supabase.from("clientes_base").select("segmento").not("segmento", "is", null),
    supabase.from("clientes_base").select("cidade").not("cidade", "is", null),
  ]);

  const segmentos = new Set((segData.data ?? []).map((r: { segmento: string | null }) => r.segmento)).size;
  const cidades = new Set((cidData.data ?? []).map((r: { cidade: string | null }) => r.cidade)).size;

  return { total: count ?? 0, cidades, segmentos };
}

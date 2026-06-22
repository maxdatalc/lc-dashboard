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
  created_at: string;
  updated_at: string;
};

export type ClienteBaseInput = Omit<ClienteBase, "id" | "created_at" | "updated_at" | "sql_bridge_token"> & {
  sql_bridge_token?: string | null;
};

const PER_PAGE = 30;

export async function getClientesBase(opts?: {
  q?: string;
  segmento?: string;
  cidade?: string;
  page?: number;
  status?: "cadastrados" | "pendentes";
  cnpjsCadastrados?: Set<string>;
  codigosExternosCadastrados?: Map<string, ClienteCadastradoMatch>;
}): Promise<{ data: ClienteBase[]; total: number }> {
  const supabase = createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);

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

  const isCadastrado = (c: ClienteBase) => {
    if (c.codigo_externo && opts?.codigosExternosCadastrados?.has(c.codigo_externo)) return true;
    if (c.cnpj_cpf && opts?.cnpjsCadastrados?.has(c.cnpj_cpf)) return true;
    return false;
  };

  // Status filter: fetch all and filter in-memory (dataset is small, max ~1000 records)
  if (opts?.status) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const all = (data ?? []) as ClienteBase[];
    const filtered = all.filter((c) =>
      opts.status === "cadastrados" ? isCadastrado(c) : !isCadastrado(c)
    );
    const offset = (page - 1) * PER_PAGE;
    return { data: filtered.slice(offset, offset + PER_PAGE), total: filtered.length };
  }

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;
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

export async function upsertClientesBase(
  clientes: ClienteBaseInput[]
): Promise<{ inseridos: number; atualizados: number }> {
  const supabase = createAdminClient();

  // Busca códigos externos existentes para distinguir insert de update
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

/** Retorna um Map com todos os CNPJs de lojas cadastradas → {tenantId, tenantName} */
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

/** Retorna um Map com todos os codigo_externo de tenants cadastrados → {tenantId, tenantName} */
export async function getCodigosExternosCadastrados(): Promise<Map<string, ClienteCadastradoMatch>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, name, codigo_externo")
    .not("codigo_externo", "is", null);
  const map = new Map<string, ClienteCadastradoMatch>();
  for (const r of (data ?? []) as { id: string; name: string; codigo_externo: string | null }[]) {
    if (r.codigo_externo) {
      map.set(r.codigo_externo, { tenantId: r.id, tenantName: r.name });
    }
  }
  return map;
}

/** Encontra o grupo cadastrado para um cliente, tentando codigo_externo e depois CNPJ */
export async function getGrupoByCliente(
  codigoExterno: string | null,
  cnpj: string | null
): Promise<ClienteCadastradoMatch | null> {
  const supabase = createAdminClient();

  // 1. Prioridade: codigo_externo
  if (codigoExterno) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("codigo_externo", codigoExterno)
      .maybeSingle();
    if (data) {
      return { tenantId: (data as { id: string; name: string }).id, tenantName: (data as { id: string; name: string }).name };
    }
  }

  // 2. Fallback: CNPJ via lojas
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
export async function getGrupoByCnpj(
  cnpj: string
): Promise<ClienteCadastradoMatch | null> {
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

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
  created_at: string;
  updated_at: string;
};

export type ClienteBaseInput = Omit<ClienteBase, "id" | "created_at" | "updated_at">;

const PER_PAGE = 30;

export async function getClientesBase(opts?: {
  q?: string;
  segmento?: string;
  cidade?: string;
  page?: number;
  status?: "cadastrados" | "pendentes";
  cnpjsCadastrados?: Set<string>;
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

  // Status filter: fetch all and filter in-memory (dataset is small, max ~1000 records)
  if (opts?.status && opts.cnpjsCadastrados) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const all = (data ?? []) as ClienteBase[];
    const set = opts.cnpjsCadastrados;
    const filtered = all.filter((c) => {
      const isCadastrado = !!(c.cnpj_cpf && set.has(c.cnpj_cpf));
      return opts.status === "cadastrados" ? isCadastrado : !isCadastrado;
    });
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

export async function getGrupoByCnpj(
  cnpj: string
): Promise<{ tenantId: string; tenantName: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lojas")
    .select("tenant_id, tenants(name)")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (!data) return null;
  const raw = data.tenants as unknown;
  const tenantName = Array.isArray(raw)
    ? ((raw[0] as { name?: string })?.name ?? "")
    : ((raw as { name?: string } | null)?.name ?? "");
  return {
    tenantId: data.tenant_id as string,
    tenantName,
  };
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

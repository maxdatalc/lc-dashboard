import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = `rls-leak-test-${Date.now()}@teste.invalido`;
const TEST_PASSWORD = "SenhaDeTeste123!";

// Tabelas conhecidas como intencionalmente públicas para `authenticated` —
// vazia hoje de propósito. Qualquer tabela nova em `public` fora de ecom_%
// cai automaticamente neste teste sem precisar editar esta lista.
// NOTA: limitação conhecida — tabela com policy permissiva mas zero rows passa
// como negativa (assertion verifica .length === 0). Risco aceitável; revalidar
// manualmente caso adicionar dados de produção em tabelas públicas.
const ALLOWLIST_PUBLICA: string[] = [];

describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)("cliente final da vitrine não lê tabela nenhuma do painel", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let userId: string | undefined;
  let clienteFinal: ReturnType<typeof createClient>;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Falha ao criar usuário de teste: ${error?.message}`);
    }
    userId = data.user.id;

    clienteFinal = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInError } = await clienteFinal.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (signInError) {
      throw new Error(`Falha ao logar usuário de teste: ${signInError.message}`);
    }
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("lê zero linhas de toda tabela fora de ecom_*", async () => {
    const { data: tabelas, error } = await admin.rpc("list_tables_for_rls_leak_test");
    if (error) throw new Error(`Falha ao listar tabelas: ${error.message}`);

    const alvo = (tabelas ?? [])
      .map((t: { table_name: string }) => t.table_name)
      .filter((nome: string) => !ALLOWLIST_PUBLICA.includes(nome));

    // Guarda contra a RPC devolver vazio em silêncio (o que faria o teste
    // "passar" sem checar nada).
    expect(alvo.length).toBeGreaterThan(0);

    for (const tabela of alvo) {
      const { data } = await clienteFinal.from(tabela).select("*").limit(1);
      expect(data ?? [], `vazamento em "${tabela}"`).toHaveLength(0);
    }
  });
});

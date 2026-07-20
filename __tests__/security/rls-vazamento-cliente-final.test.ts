import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = `rls-leak-test-${Date.now()}@teste.invalido`;
const TEST_PASSWORD = "SenhaDeTeste123!";

// Tabelas onde `authenticated` ver alguma linha é esperado e verificado como
// correto — não entram no loop de "zero linhas". Cada entrada precisa de uma
// causa raiz confirmada no banco (policy lida direto), não suposição.
//
// - fs_profiles: RLS é `USING (auth.uid() = user_id)` — só pode devolver a
//   própria linha, nunca a de outra pessoa. O trigger fs_handle_new_user()
//   (pré-existente, fora do escopo da fase 2) cria uma linha aqui para TODO
//   novo auth.users, painel ou vitrine, então uma linha própria é esperada.
//   Descoberto em 13/07/2026 investigando uma falha deste teste — a falha
//   era a própria linha do usuário efêmero de teste, não vazamento
//   cross-user; a confusão só aconteceu porque user_id tem ON DELETE CASCADE
//   e a linha já tinha sumido quando a investigação rodou a consulta
//   seguinte. Confirmado com um segundo usuário efêmero e uma função de
//   debug temporária (auth.uid()/auth.role() batendo com a própria linha).
// - cfop_classificacoes: policy "Qualquer autenticado pode ver CFOPs",
//   `USING (true)`, deliberada. Códigos fiscais (CFOP) padronizados pela
//   Receita Federal — dado público de referência, não associado a cliente
//   ou loja nenhum. Confirmado lendo a policy direto no banco em 13/07/2026.
// - profiles: RLS é `USING (id = auth.uid())` (4 policies, redundantes mas
//   todas com essa mesma condição — confirmado direto no banco). O trigger
//   handle_new_user() (pré-existente, também fora do escopo da fase 2) cria
//   uma linha aqui para TODO novo auth.users. Já era um "achado aceito"
//   documentado no design da fase 2 (docs/superpowers/specs no lc-storefront,
//   seção "Convivência com os triggers existentes") — só não tinha entrado
//   nesta allowlist antes. is_system_admin/is_suporte nascem NULL/false, sem
//   risco de acesso a /admin.
const EXCECOES_VALIDADAS: string[] = ["fs_profiles", "cfop_classificacoes", "profiles"];

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

  it(
    "lê zero linhas de toda tabela fora de ecom_*",
    async () => {
      const { data: tabelas, error } = await admin.rpc("list_tables_for_rls_leak_test");
      if (error) throw new Error(`Falha ao listar tabelas: ${error.message}`);

      const alvo = (tabelas ?? [])
        .map((t: { table_name: string }) => t.table_name)
        .filter((nome: string) => !EXCECOES_VALIDADAS.includes(nome));

      // Guarda contra a RPC devolver vazio em silêncio (o que faria o teste
      // "passar" sem checar nada).
      expect(alvo.length).toBeGreaterThan(0);

      for (const tabela of alvo) {
        const { data } = await clienteFinal.from(tabela).select("*").limit(1);
        expect(data ?? [], `vazamento em "${tabela}"`).toHaveLength(0);
      }
    },
    // Uma requisição de rede real por tabela do banco inteiro — o timeout
    // padrão de 5s do Vitest é curto demais em runners de CI mais lentos.
    30_000,
  );
});

-- ============================================================
-- 20260711_fix_privilege_escalation.sql
--
-- Corrige a escalação de privilégio encontrada na auditoria de RLS.
-- Todas as tabelas já tinham RLS habilitada; o furo estava nos
-- GRANTs de coluna e em duas policies/funções permissivas demais.
--
-- Nada aqui afeta o service_role (createAdminClient), que continua
-- bypassando RLS e mantém EXECUTE explícito nas funções.
-- ============================================================


-- ── 1. CRÍTICO: impedir auto-promoção a system admin ─────────
--
-- A policy "auth_update_own_profile" permite UPDATE na própria
-- linha de profiles. Combinada com o GRANT de UPDATE na coluna
-- is_system_admin, qualquer usuário autenticado podia se promover
-- via PATCH /rest/v1/profiles com a anon key — e middleware.ts,
-- tenant-guard.ts e db/admin.ts usam essa coluna como fonte de
-- verdade da autorização.
--
-- ATENÇÃO: um REVOKE só das colunas (REVOKE UPDATE (is_system_admin) ...)
-- é NO-OP aqui. O Supabase concede UPDATE no nível de TABELA a anon e
-- authenticated (GRANT ALL default), e no Postgres quem tem UPDATE na
-- tabela tem UPDATE em todas as colunas — o revoke de coluna não remove
-- um grant de tabela e ainda assim retorna sucesso.
--
-- O caminho correto é revogar o UPDATE da tabela e reconceder apenas as
-- colunas seguras. A policy auth_update_own_profile continua limitando a
-- linha a id = auth.uid(); o service_role não passa por nada disso.
--

REVOKE UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (full_name) ON public.profiles TO authenticated;


-- ── 2. produtos: escopar leitura por tenant ──────────────────
--
-- A policy anterior era USING (true) para authenticated: qualquer
-- usuário logado lia produtos de TODAS as lojas, incluindo
-- valor_custo (margem) de outros clientes.
--
-- lib/db/produtos.ts usa createClient() (role authenticated, sujeito
-- a RLS), então a policy precisa continuar liberando as lojas do
-- próprio tenant + o system admin, que navega entre tenants.
--

DROP POLICY IF EXISTS "Usuários autenticados leem produtos" ON public.produtos;

CREATE POLICY "produtos_select_own_tenant"
  ON public.produtos
  FOR SELECT TO authenticated
  USING (
    is_system_admin()
    OR loja_id IN (
      SELECT l.id
      FROM   public.lojas l
      JOIN   public.tenant_users tu ON tu.tenant_id = l.tenant_id
      WHERE  tu.user_id = auth.uid()
    )
  );


-- ── 3. track_*: restringir a service_role ────────────────────
--
-- São SECURITY DEFINER (bypassam RLS) e estavam executáveis por anon:
-- qualquer um podia gravar lixo em tenant_access_stats e
-- tenant_module_access_stats via /rest/v1/rpc/.
--
-- Só são chamadas com createAdminClient (service_role):
--   lib/api/tenant-guard.ts:96  → track_tenant_access
--   lib/api/plan-guard.ts:23    → track_module_access
--
-- REVOKE FROM PUBLIC é o que realmente remove o privilégio: o
-- EXECUTE default do Postgres vem de PUBLIC, e é por isso que os
-- REVOKE ... FROM anon da migration 20260623 não tiveram efeito.
-- Por isso o GRANT explícito a service_role logo em seguida.
--

REVOKE EXECUTE ON FUNCTION public.track_tenant_access(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_tenant_access(uuid, uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.track_module_access(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_module_access(uuid, text)
  TO service_role;


-- ── 4. search_path fixo (alerta do Advisor) ──────────────────

ALTER FUNCTION public.track_module_access(uuid, text) SET search_path = public;
ALTER FUNCTION public.update_atualizado_em()          SET search_path = public;

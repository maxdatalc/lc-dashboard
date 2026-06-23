-- ============================================================
-- 20260623_security_hardening.sql
-- Corrige alertas de segurança do Supabase Advisor
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================


-- ── 1. Habilitar RLS nas tabelas sem proteção ────────────────
--
-- SEGURO: ENABLE ROW LEVEL SECURITY é idempotente.
-- Tabelas que já têm RLS não são afetadas.
-- O createAdminClient (service_role) bypassa RLS — operações
-- admin no Next.js continuam funcionando normalmente.
--

ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lojas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

-- tenant_access_stats só existe como tabela (não view)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public'
      AND  table_name   = 'tenant_access_stats'
      AND  table_type   = 'BASE TABLE'
  ) THEN
    EXECUTE 'ALTER TABLE public.tenant_access_stats ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;


-- ── 2. Policies de SELECT para usuários autenticados ─────────
--
-- Cada usuário autenticado enxerga apenas dados das empresas
-- às quais pertence (via tenant_users).
-- O service_role nunca passa por estas policies.
--
-- Nota: DROP POLICY IF EXISTS é compatível com PG < 15
-- (CREATE POLICY IF NOT EXISTS só existe a partir do PG 15).
--

-- Empresas: somente as que o usuário pertence
DROP POLICY IF EXISTS "auth_see_own_tenants" ON public.tenants;
CREATE POLICY "auth_see_own_tenants"
  ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Lojas: somente lojas das empresas do usuário
DROP POLICY IF EXISTS "auth_see_own_lojas" ON public.lojas;
CREATE POLICY "auth_see_own_lojas"
  ON public.lojas
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Perfil: somente o próprio perfil
DROP POLICY IF EXISTS "auth_see_own_profile" ON public.profiles;
CREATE POLICY "auth_see_own_profile"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_profile" ON public.profiles;
CREATE POLICY "auth_update_own_profile"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Vínculos empresa-usuário: somente os da própria conta
DROP POLICY IF EXISTS "auth_see_own_memberships" ON public.tenant_users;
CREATE POLICY "auth_see_own_memberships"
  ON public.tenant_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Configurações de integração: somente lojas das empresas do usuário
DROP POLICY IF EXISTS "auth_see_own_integration_configs" ON public.integration_configs;
CREATE POLICY "auth_see_own_integration_configs"
  ON public.integration_configs
  FOR SELECT TO authenticated
  USING (
    loja_id IN (
      SELECT l.id
      FROM   public.lojas l
      JOIN   public.tenant_users tu ON tu.tenant_id = l.tenant_id
      WHERE  tu.user_id = auth.uid()
    )
  );


-- ── 3. Revogar EXECUTE anônimo em funções SECURITY DEFINER ───
--
-- Trigger functions nunca devem ser chamadas via REST API.
-- As demais só são invocadas pelo servidor (service_role),
-- não há razão para exposição ao anon.
--

-- Funções de trigger: revogar de anon E authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fs_handle_new_user() FROM anon, authenticated;

-- Funções internas: revogar apenas de anon
-- (authenticated pode precisar chamar em policies RLS)
REVOKE EXECUTE ON FUNCTION public.is_system_admin()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.fs_is_admin(uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.fs_user_can_access_loja(uuid, uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.fs_user_can_manage_loja(uuid, uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_loja_ids()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_tenant_access(uuid, uuid, text) FROM anon;


-- ── 4. Fixar search_path nas funções ─────────────────────────
--
-- Sem search_path fixo, um atacante pode criar objetos em
-- schemas temporários para interceptar chamadas de função.
-- SET search_path = public elimina essa superfície.
--

-- Assinaturas conhecidas (dos alertas do Supabase Advisor)
ALTER FUNCTION public.handle_updated_at()                    SET search_path = public;
ALTER FUNCTION public.handle_new_user()                      SET search_path = public;
ALTER FUNCTION public.get_user_loja_ids()                    SET search_path = public;
ALTER FUNCTION public.is_system_admin()                      SET search_path = public;
ALTER FUNCTION public.fs_is_admin(uuid)                      SET search_path = public;
ALTER FUNCTION public.fs_user_can_access_loja(uuid, uuid)    SET search_path = public;
ALTER FUNCTION public.fs_user_can_manage_loja(uuid, uuid)    SET search_path = public;
ALTER FUNCTION public.fs_handle_new_user()                   SET search_path = public;
ALTER FUNCTION public.track_tenant_access(uuid, uuid, text)  SET search_path = public;

-- Funções KPI/analytics: assinaturas descobertas dinamicamente
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
    AND    p.proname IN (
      'get_top_produtos',
      'get_top_clientes',
      'get_vendas_mensal',
      'get_vendas_tipo_pessoa',
      'get_kpis_periodo',
      'get_custo_periodo'
    )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

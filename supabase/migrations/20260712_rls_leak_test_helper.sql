-- ============================================================
-- 20260712_rls_leak_test_helper.sql
--
-- Função auxiliar SÓ para o teste de guarda de regressão de RLS
-- (fase 2 do lc-storefront): lista as tabelas de `public` fora de
-- ecom_*, para o teste testar TODAS sem precisar de uma lista
-- mantida à mão. PostgREST não expõe information_schema — daqui
-- vem o motivo de existir como RPC em vez de uma query direta.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_tables_for_rls_leak_test()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'ecom\_%' ESCAPE '\'
$$;

-- REVOKE FROM PUBLIC é obrigatório: o EXECUTE default do Postgres vem de
-- PUBLIC (mesma lição de 20260711_fix_privilege_escalation.sql).
REVOKE EXECUTE ON FUNCTION public.list_tables_for_rls_leak_test() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_tables_for_rls_leak_test() TO service_role;

-- ============================================================
-- 20260721_enforce_loja_ids_permission.sql
-- Fecha o gap: fs_user_can_access_loja / fs_user_can_manage_loja /
-- get_user_loja_ids / RLS de lojas só checavam vínculo de TENANT
-- (tenant_users), nunca user_tenant_settings.loja_ids — permitindo
-- que um usuário acessasse lojas explicitamente desmarcadas para
-- ele no painel admin (dashboard e módulo O.S).
--
-- Definições originais confirmadas via `supabase db query --linked`
-- antes desta migration (não estavam versionadas em nenhum arquivo
-- anterior deste repositório).
-- ============================================================

-- Helper: a loja está entre as permitidas para o usuário naquele tenant?
-- Sem registro em user_tenant_settings, ou loja_ids = [], significa
-- "todas as lojas do tenant" (mesma regra de negócio usada no admin).
CREATE OR REPLACE FUNCTION public.fs_loja_allowed_by_settings(_user_id uuid, _tenant_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT uts.loja_ids = '[]'::jsonb OR uts.loja_ids @> to_jsonb(_loja_id::text)
      FROM public.user_tenant_settings uts
      WHERE uts.tenant_id = _tenant_id AND uts.user_id = _user_id
    ),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.fs_user_can_access_loja(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas l
    JOIN public.tenant_users tu ON tu.tenant_id = l.tenant_id
    WHERE l.id = _loja_id AND tu.user_id = _user_id AND l.is_active = true
      AND public.fs_loja_allowed_by_settings(_user_id, l.tenant_id, l.id)
  ) OR public.fs_is_admin(_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.fs_user_can_manage_loja(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas l
    JOIN public.tenant_users tu ON tu.tenant_id = l.tenant_id
    WHERE l.id = _loja_id AND tu.user_id = _user_id AND l.is_active = true
    AND tu.role IN ('owner', 'admin')
    AND public.fs_loja_allowed_by_settings(_user_id, l.tenant_id, l.id)
  ) OR public.fs_is_admin(_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_user_loja_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select l.id
  from public.lojas l
  join public.tenant_users tu on tu.tenant_id = l.tenant_id
  where tu.user_id = auth.uid()
    and l.is_active = true
    and public.fs_loja_allowed_by_settings(auth.uid(), l.tenant_id, l.id)
$function$;

-- RLS de public.lojas (defesa em profundidade para queries feitas com o
-- client autenticado; consultas via service_role continuam bypassando RLS)
DROP POLICY IF EXISTS "auth_see_own_lojas" ON public.lojas;
CREATE POLICY "auth_see_own_lojas"
  ON public.lojas
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    AND public.fs_loja_allowed_by_settings(auth.uid(), tenant_id, id)
  );

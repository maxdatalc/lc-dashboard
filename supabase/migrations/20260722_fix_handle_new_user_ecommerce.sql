-- ============================================================
-- 20260722_fix_handle_new_user_ecommerce.sql
--
-- handle_new_user() (trigger AFTER INSERT ON auth.users, compartilhado com
-- o lc-storefront) inseria incondicionalmente em public.profiles para
-- QUALQUER conta nova — inclusive clientes do e-commerce cadastrados pelo
-- storefront, que também mandam full_name no metadata. Isso poluía a tela
-- Admin > Usuários com clientes da vitrine, não só usuários do painel.
--
-- Cadastro do storefront sempre manda loja_id no metadata (ver
-- ecom_handle_new_user, lc-storefront/supabase/migrations/
-- 20260712_ecommerce_conta_cliente.sql) — nenhum fluxo de criação de usuário
-- do painel usa essa chave (confirmado: app/actions/admin-usuarios.ts,
-- lib/actions/admin-lojas.ts, lib/db/admin.ts só mandam full_name/
-- must_change_password). Reaproveita o mesmo sinal para distinguir os dois.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.raw_user_meta_data ? 'loja_id' then
    return new;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$function$;

-- Limpa a poluição já existente (clientes do storefront cadastrados antes
-- desta correção existir).
DELETE FROM public.profiles p
USING auth.users u
WHERE p.id = u.id AND u.raw_user_meta_data ? 'loja_id';

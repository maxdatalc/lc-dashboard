-- =============================================================
-- TRACKING DE ACESSOS — rodar no Supabase SQL Editor
-- 1 linha por tenant, nunca cresce além do nº de clientes
-- =============================================================

-- 1. Tabela
create table if not exists public.tenant_access_stats (
  tenant_id      uuid        primary key references public.tenants(id) on delete cascade,
  last_seen_at   timestamptz not null default now(),
  total_accesses bigint      not null default 1,
  last_user_id   uuid        references auth.users(id) on delete set null,
  last_user_name text,
  updated_at     timestamptz not null default now()
);

-- 2. RLS — apenas system admins lêem
alter table public.tenant_access_stats enable row level security;

create policy "system_admin_only" on public.tenant_access_stats
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_system_admin = true
    )
  );

-- 3. Função de upsert atômico com contador (SECURITY DEFINER = roda como owner)
create or replace function public.track_tenant_access(
  p_tenant_id   uuid,
  p_user_id     uuid,
  p_user_name   text
) returns void language plpgsql security definer as $$
begin
  insert into public.tenant_access_stats
    (tenant_id, last_seen_at, total_accesses, last_user_id, last_user_name, updated_at)
  values
    (p_tenant_id, now(), 1, p_user_id, p_user_name, now())
  on conflict (tenant_id) do update set
    last_seen_at   = now(),
    total_accesses = public.tenant_access_stats.total_accesses + 1,
    last_user_id   = excluded.last_user_id,
    last_user_name = excluded.last_user_name,
    updated_at     = now();
end;
$$;

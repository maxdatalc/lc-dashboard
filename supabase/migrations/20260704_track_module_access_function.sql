-- Upsert atômico com contador para tenant_module_access_stats, mesmo padrão
-- de track_tenant_access (scripts/setup-access-tracking.sql) — SECURITY
-- DEFINER para permitir o incremento atômico via RPC a partir da API.
create or replace function public.track_module_access(
  p_tenant_id   uuid,
  p_feature_key text
) returns void language plpgsql security definer as $$
begin
  insert into public.tenant_module_access_stats
    (tenant_id, feature_key, last_seen_at, total_accesses)
  values
    (p_tenant_id, p_feature_key, now(), 1)
  on conflict (tenant_id, feature_key) do update set
    last_seen_at   = now(),
    total_accesses = public.tenant_module_access_stats.total_accesses + 1;
end;
$$;

-- Estatísticas de acesso por módulo (para "módulos mais acessados"),
-- análogo a tenant_access_stats mas com granularidade de feature_key.
CREATE TABLE IF NOT EXISTS tenant_module_access_stats (
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key    text        NOT NULL,
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  total_accesses bigint      NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_module_access_stats_feature_idx
  ON tenant_module_access_stats(feature_key, total_accesses DESC);

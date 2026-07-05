-- Snapshot de quais empresas tinham um módulo ativo no momento em que o
-- kill-switch foi ligado. Serve como log/auditoria do evento — a fonte de
-- verdade do restore continua sendo tenant_features, que nunca é apagada
-- pelo kill-switch.
CREATE TABLE IF NOT EXISTS kill_switch_revocations (
  feature_key text        NOT NULL,
  tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  revoked_at  timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  PRIMARY KEY (feature_key, tenant_id, revoked_at)
);

CREATE INDEX IF NOT EXISTS kill_switch_revocations_feature_idx
  ON kill_switch_revocations(feature_key);

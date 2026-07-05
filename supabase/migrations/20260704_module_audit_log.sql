-- Histórico de ações administrativas por módulo (kill-switch, cor, acesso,
-- preço). Populada automaticamente pelo código, nunca por input manual do
-- usuário final.
CREATE TABLE IF NOT EXISTS module_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text        NOT NULL,
  event_type  text        NOT NULL
                CHECK (event_type IN (
                  'kill_switch_on', 'kill_switch_off',
                  'cor_alterada', 'acesso_empresa_alterado', 'preco_alterado'
                )),
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  detalhes    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_audit_log_feature_idx
  ON module_audit_log(feature_key, created_at DESC);

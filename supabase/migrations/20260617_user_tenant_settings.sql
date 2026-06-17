-- Configurações de acesso por usuário dentro de um tenant.
-- Controla quais lojas e módulos cada usuário pode acessar.
-- Separado de tenant_users (que apenas vincula user↔tenant).
CREATE TABLE IF NOT EXISTS user_tenant_settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  -- Array de loja UUIDs que este usuário pode ver ([] = todas)
  loja_ids   jsonb       NOT NULL DEFAULT '[]',
  -- Chaves de feature habilitadas para este usuário (subconjunto do tenant)
  -- Ex: {"modulo_os": true, "dashboard_visao_geral": true}
  modulos    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_uts_tenant ON user_tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uts_user   ON user_tenant_settings(user_id);

ALTER TABLE user_tenant_settings ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado pode ler suas próprias configurações
CREATE POLICY "uts_self_select" ON user_tenant_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

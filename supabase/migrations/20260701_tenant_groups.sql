-- Grupos de permissão por tenant (para controle de acesso em nível de grupo)
CREATE TABLE IF NOT EXISTS tenant_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  modulos    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_groups_tenant_id_idx ON tenant_groups(tenant_id);

-- Vincula usuário a um grupo (SET NULL quando o grupo é deletado)
ALTER TABLE user_tenant_settings
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES tenant_groups(id) ON DELETE SET NULL;

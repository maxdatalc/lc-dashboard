-- Permissões por empresa: adiciona role 'owner' e garante constraints de plan
-- Rodar no Supabase SQL Editor

-- 1. Atualiza constraint de role para incluir 'owner'
ALTER TABLE tenant_users
  DROP CONSTRAINT IF EXISTS tenant_users_role_check;

ALTER TABLE tenant_users
  ADD CONSTRAINT tenant_users_role_check
  CHECK (role IN ('owner', 'admin', 'viewer'));

-- 2. Garante default e constraint no plano
ALTER TABLE tenants
  ALTER COLUMN plan SET DEFAULT 'free';

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('free', 'premium'));

-- 3. Índice para busca por empresa+role
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_role
  ON tenant_users(tenant_id, role);

-- 4. Atualizar usuários existentes: primeiro usuário de cada empresa vira 'owner'
-- (executa apenas se o constraint acima ja foi aplicado)
UPDATE tenant_users tu
SET role = 'owner'
WHERE tu.role = 'admin'
  AND tu.created_at = (
    SELECT MIN(tu2.created_at)
    FROM tenant_users tu2
    WHERE tu2.tenant_id = tu.tenant_id
  );

-- Rastreia assinaturas individuais por módulo por tenant
-- Cada módulo tem seu próprio fluxo de pagamento Asaas
CREATE TABLE IF NOT EXISTS module_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key           TEXT NOT NULL,  -- ex: 'modulo_os', 'modulo_financeiro'
  asaas_subscription_id TEXT,
  asaas_payment_link    TEXT,
  status                TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('pending', 'active', 'overdue', 'cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_module_subscriptions_tenant
  ON module_subscriptions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_module_subscriptions_asaas
  ON module_subscriptions (asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

COMMENT ON TABLE module_subscriptions IS 'Assinaturas individuais por módulo — cada módulo tem seu próprio pagamento Asaas';

-- Adiciona colunas de billing Asaas à tabela tenants
-- Permite rastrear o cliente e a assinatura recorrente de cada tenant no Asaas

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS asaas_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'overdue', 'cancelled'));

-- Índice para lookup por customer Asaas (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_tenants_asaas_customer
  ON tenants (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- Índice para lookup por subscription Asaas (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_tenants_asaas_subscription
  ON tenants (asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

-- Comentários descritivos
COMMENT ON COLUMN tenants.asaas_customer_id     IS 'ID do cliente no Asaas (cus_...)';
COMMENT ON COLUMN tenants.asaas_subscription_id IS 'ID da assinatura recorrente no Asaas (sub_...)';
COMMENT ON COLUMN tenants.subscription_status   IS 'Estado da assinatura: active | inactive | overdue | cancelled';

-- Habilita modulo_vendas para todos os tenants que já têm features configuradas.
-- Retro-compatibilidade: antes de virar add-on controlável, vendas era default
-- ligado para todos. Esta migration garante que o checkbox apareça marcado
-- na aba Módulos sem que o admin precise reconfigurar manualmente.
INSERT INTO tenant_features (tenant_id, feature_key)
SELECT DISTINCT tenant_id, 'modulo_vendas'
FROM tenant_features
WHERE tenant_id NOT IN (
  SELECT tenant_id FROM tenant_features WHERE feature_key = 'modulo_vendas'
)
ON CONFLICT DO NOTHING;

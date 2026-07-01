-- Com a remoção de getCoreFeatures() obrigatório, garante que tenants
-- existentes continuem com os módulos que antes eram fixos (core).
-- Insere somente para tenants que já têm ao menos um feature configurado.

INSERT INTO tenant_features (tenant_id, feature_key)
SELECT DISTINCT tenant_id, feat
FROM tenant_features
CROSS JOIN (VALUES
  ('dashboard_visao_geral'),
  ('modulo_financeiro'),
  ('modulo_produtos')
) AS t(feat)
WHERE (tenant_id, feat) NOT IN (
  SELECT tenant_id, feature_key FROM tenant_features
)
ON CONFLICT DO NOTHING;

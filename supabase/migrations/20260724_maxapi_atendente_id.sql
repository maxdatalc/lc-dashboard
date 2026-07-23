-- ============================================================
-- 20260724_maxapi_atendente_id.sql
--
-- Fase 5 do lc-storefront (pedido -> ERP): POST /v2/sale exige atendenteId.
-- Não existe hoje nenhum conceito de "vendedor do e-commerce" — decisão do
-- alinhamento foi semear esse valor no banco por enquanto (sem tela; a UI de
-- configuração fica pra Fase 6, junto do resto do painel de gestão do
-- e-commerce). Mesma home das outras configs de MaxAPI por loja
-- (maxapi_url, terminal_maxdata).
-- ============================================================

ALTER TABLE integration_configs
  ADD COLUMN maxapi_atendente_id integer;

COMMENT ON COLUMN integration_configs.maxapi_atendente_id IS
  'atendenteId usado em POST /v2/sale pro worker de ERP do e-commerce '
  '(lib/ecommerce/pedidos-erp.ts). Sem UI ainda — setado manualmente por '
  'loja até a Fase 6. Ausente = o push ao ERP falha com erro explícito '
  '(nunca um default silencioso).';

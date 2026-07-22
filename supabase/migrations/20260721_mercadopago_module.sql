-- ============================================================
-- 20260721_mercadopago_module.sql
--
-- Fase 4 (lc-storefront): cada loja conecta sua PRÓPRIA conta
-- Mercado Pago via OAuth (marketplace real — não existe conta
-- central/"collector_id"). Modelo estrutural copiado de
-- sieg_configuracoes (tabela própria, RLS is_system_admin()-only,
-- segredo encriptado), mas ajustado: 1 linha por loja (UNIQUE
-- loja_id), não por (loja_id, emp_id) — a conexão MP não é por
-- CNPJ/empresa do MaxManager, é por loja.
-- ============================================================

CREATE TABLE IF NOT EXISTS mercadopago_configuracoes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id          UUID NOT NULL UNIQUE REFERENCES lojas(id) ON DELETE CASCADE,
  mp_user_id       TEXT,
  access_token     TEXT,           -- encriptado (AES-256-GCM). NULL enquanto nunca conectado/desconectado.
  refresh_token    TEXT,           -- encriptado (AES-256-GCM). Trocado a cada renovação.
  public_key       TEXT,           -- não é secreto (não usado client-side no v1: PIX puro, sem Bricks/SDK).
  scope            TEXT,
  live_mode        BOOLEAN NOT NULL DEFAULT FALSE,
  token_expires_at TIMESTAMPTZ,    -- quando o access_token atual vence (~180 dias da troca/renovação).
  status           TEXT NOT NULL DEFAULT 'desconectado'
                     CHECK (status IN ('conectado', 'desconectado', 'erro')),
  conectado_em     TIMESTAMPTZ,
  desconectado_em  TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  mercadopago_configuracoes IS
  'Conexão OAuth Mercado Pago por loja (marketplace: cada loja tem sua própria conta MP). access_token/refresh_token encriptados AES-256-GCM.';
COMMENT ON COLUMN mercadopago_configuracoes.access_token  IS
  'Formato {iv_b64}:{authTag_b64}:{data_b64}. Validade ~180 dias (grant OAuth) — renovado sob demanda por getMercadoPagoAccessToken().';
COMMENT ON COLUMN mercadopago_configuracoes.refresh_token IS
  'Formato {iv_b64}:{authTag_b64}:{data_b64}. O Mercado Pago invalida o refresh_token anterior a cada renovação — sempre sobrescrever os DOIS tokens juntos.';
COMMENT ON COLUMN mercadopago_configuracoes.status IS
  'conectado: OAuth ativo e utilizável | desconectado: nunca conectado ou admin desconectou | erro: refresh falhou (ex.: revogado no painel MP), precisa reconectar.';

ALTER TABLE mercadopago_configuracoes ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de sieg_configuracoes: só admin do sistema, nenhuma policy para outros papéis.
CREATE POLICY "mercadopago_configuracoes_admin_only"
  ON mercadopago_configuracoes
  FOR ALL
  USING ( is_system_admin() );

-- update_atualizado_em() já existe (criada em 20260630_sieg_module.sql).
CREATE TRIGGER mercadopago_configuracoes_updated
  BEFORE UPDATE ON mercadopago_configuracoes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

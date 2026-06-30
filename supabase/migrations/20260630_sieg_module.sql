-- Módulo SIEG: transmissão automática de XMLs fiscais para a plataforma SIEG
-- Cada empresa (empId) tem suas próprias credenciais OAuth SIEG
-- O JWT global do sistema integrador fica em variável de ambiente

-- ─── Configurações SIEG por empresa ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sieg_configuracoes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id       UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  emp_id        INTEGER NOT NULL,
  cnpj          VARCHAR(14) NOT NULL,
  razao_social  VARCHAR(200),
  oauth_token   TEXT NOT NULL,           -- X-OAuth-Token da empresa, encriptado (AES-256-GCM)
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loja_id, emp_id)
);

COMMENT ON TABLE  sieg_configuracoes                IS 'Credenciais SIEG por empresa (empId). O oauth_token é encriptado com AES-256-GCM.';
COMMENT ON COLUMN sieg_configuracoes.oauth_token    IS 'X-OAuth-Token da empresa no SIEG, encriptado. Formato: {iv_b64}:{authTag_b64}:{data_b64}';
COMMENT ON COLUMN sieg_configuracoes.emp_id         IS 'ID da empresa no MaxManager (cofId / empId na tabela nf)';

-- ─── Tracking de envios ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sieg_envios (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id        UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  emp_id         INTEGER NOT NULL,
  chave_acesso   VARCHAR(44) NOT NULL,   -- nfIdNFe (44 dígitos)
  tipo_sped      VARCHAR(2),             -- '55' NF-e | '65' NFC-e
  tipo_op        CHAR(1),                -- 'S' saída | 'E' entrada
  data_emissao   TIMESTAMPTZ,
  valor_total    DECIMAL(14, 2),
  status         VARCHAR(20) NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'enviado', 'erro', 'ignorado')),
  tentativas     SMALLINT NOT NULL DEFAULT 0,
  proxima_tentativa TIMESTAMPTZ,         -- back-off exponencial
  data_envio     TIMESTAMPTZ,
  erro_msg       TEXT,
  sieg_response  JSONB,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loja_id, emp_id, chave_acesso)
);

COMMENT ON TABLE  sieg_envios              IS 'Tracking de cada XML enviado ao SIEG. Armazena apenas metadados — o XML não é guardado aqui.';
COMMENT ON COLUMN sieg_envios.chave_acesso IS 'Chave de acesso NF-e 44 dígitos (nfIdNFe). Usada para deduplicação.';
COMMENT ON COLUMN sieg_envios.status       IS 'pendente: aguardando envio | enviado: SIEG aceitou | erro: falhou | ignorado: descartado manualmente';

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sieg_envios_loja_status
  ON sieg_envios (loja_id, status);

CREATE INDEX IF NOT EXISTS idx_sieg_envios_loja_emp_status
  ON sieg_envios (loja_id, emp_id, status);

CREATE INDEX IF NOT EXISTS idx_sieg_envios_proxima_tentativa
  ON sieg_envios (proxima_tentativa)
  WHERE status = 'erro';

CREATE INDEX IF NOT EXISTS idx_sieg_envios_data_envio
  ON sieg_envios (data_envio)
  WHERE status = 'enviado';

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE sieg_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sieg_envios        ENABLE ROW LEVEL SECURITY;

-- Configurações SIEG: só admins do sistema gerenciam
CREATE POLICY "sieg_configuracoes_admin_only"
  ON sieg_configuracoes
  FOR ALL
  USING ( is_system_admin() );

-- Envios: usuário vê apenas os da própria empresa (via tenant_users → lojas)
CREATE POLICY "sieg_envios_por_loja"
  ON sieg_envios
  FOR SELECT
  TO authenticated
  USING (
    loja_id IN (
      SELECT l.id
      FROM   public.lojas l
      JOIN   public.tenant_users tu ON tu.tenant_id = l.tenant_id
      WHERE  tu.user_id = auth.uid()
    )
  );

-- Envios: admins do sistema têm acesso total
CREATE POLICY "sieg_envios_admin_all"
  ON sieg_envios
  FOR ALL
  USING ( is_system_admin() );

-- ─── Trigger: atualiza atualizado_em automaticamente ──────────────────────────
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sieg_configuracoes_updated
  BEFORE UPDATE ON sieg_configuracoes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER sieg_envios_updated
  BEFORE UPDATE ON sieg_envios
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

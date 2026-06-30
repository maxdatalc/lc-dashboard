-- Adiciona data_inicio em sieg_configuracoes
-- Define a partir de quando as NFs devem ser enviadas ao SIEG.
-- Default NOW() garante que configs criadas hoje só peguem notas de hoje em diante.

ALTER TABLE sieg_configuracoes
  ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN sieg_configuracoes.data_inicio IS
  'Data a partir da qual as NFs serão enviadas ao SIEG. Default = momento do cadastro. NFs anteriores são ignoradas.';

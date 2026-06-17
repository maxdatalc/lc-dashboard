-- Adiciona coluna para armazenar quais tipos de atendimento (tatId)
-- geram movimentação fiscal no módulo de O.S por loja.
-- Valor: array JSON de inteiros, ex: [2, 3, 5]
ALTER TABLE integration_configs
  ADD COLUMN IF NOT EXISTS os_tipos_fiscais jsonb NOT NULL DEFAULT '[]'::jsonb;

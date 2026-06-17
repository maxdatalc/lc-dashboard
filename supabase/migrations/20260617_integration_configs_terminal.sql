-- Remove linhas duplicadas (mantém a mais recente por loja)
DELETE FROM integration_configs
WHERE id NOT IN (
  SELECT DISTINCT ON (loja_id) id
  FROM integration_configs
  ORDER BY loja_id, updated_at DESC
);

-- Garante restrição UNIQUE em loja_id (necessária para o upsert onConflict funcionar)
CREATE UNIQUE INDEX IF NOT EXISTS integration_configs_loja_id_unique
  ON integration_configs(loja_id);

-- Adiciona coluna terminal_maxdata
ALTER TABLE integration_configs
  ADD COLUMN IF NOT EXISTS terminal_maxdata text;

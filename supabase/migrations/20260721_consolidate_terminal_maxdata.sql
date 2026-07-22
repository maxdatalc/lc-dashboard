-- ============================================================
-- 20260721_consolidate_terminal_maxdata.sql
-- `terminal_maxdata` existia em DUAS tabelas: lojas e integration_configs.
-- O form admin de MaxAPI grava em integration_configs, mas vários leitores
-- liam de lojas.terminal_maxdata (NULL em produção) — fazendo as credenciais
-- "sumirem" ao reabrir a tela e o módulo O.S autenticar na MaxAPI com o
-- terminal errado (default silencioso "1").
--
-- A partir daqui integration_configs.terminal_maxdata é a fonte canônica.
-- lojas.terminal_maxdata fica como shadow (ainda escrita, lida só como
-- fallback) e será removida em migration futura, depois de validado.
-- ============================================================

-- Backfill: leva qualquer valor que só exista em lojas para a tabela canônica,
-- sem nunca sobrescrever um valor já presente em integration_configs.
-- No-op em produção (todos NULL hoje); protege ambientes de dev/staging.
INSERT INTO integration_configs (loja_id, terminal_maxdata)
SELECT l.id, l.terminal_maxdata
FROM   lojas l
WHERE  l.terminal_maxdata IS NOT NULL
  AND  btrim(l.terminal_maxdata) <> ''
ON CONFLICT (loja_id) DO UPDATE
  SET terminal_maxdata = COALESCE(
        integration_configs.terminal_maxdata,
        EXCLUDED.terminal_maxdata
      );

COMMENT ON COLUMN lojas.terminal_maxdata IS
  'DEPRECATED 2026-07-21 — fonte canônica é integration_configs.terminal_maxdata. '
  'Mantida como shadow durante a transição; remover em migration futura.';

COMMENT ON COLUMN integration_configs.terminal_maxdata IS
  'Código do dispositivo/terminal MaxData (tela 470 do MaxManager, '
  'MaxdataControleAcesso.mcaMaquinaId) usado no POST /v2/auth da MaxAPI. '
  'Fonte canônica desde 2026-07-21.';

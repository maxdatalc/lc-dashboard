-- Mapeamento entre usuários do ERP (cliente.cliId) e usuários Supabase Auth.
-- Armazena também os tipos de atendimento bloqueados por usuário/loja.
CREATE TABLE IF NOT EXISTS loja_usuarios_erp (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id           uuid        NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  cli_id            integer     NOT NULL,
  cli_nome          text        NOT NULL DEFAULT '',
  cli_usu           text        NOT NULL DEFAULT '',
  supabase_user_id  uuid,
  email             text,
  tipos_bloqueados  jsonb       NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, cli_id)
);

CREATE INDEX IF NOT EXISTS idx_loja_usuarios_erp_loja
  ON loja_usuarios_erp(loja_id);

CREATE INDEX IF NOT EXISTS idx_loja_usuarios_erp_supabase_user
  ON loja_usuarios_erp(supabase_user_id);

ALTER TABLE loja_usuarios_erp ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado pode ver apenas o próprio mapeamento
CREATE POLICY "usuarios_erp_self_select" ON loja_usuarios_erp
  FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());

-- Admin (service role) acessa tudo — RLS bypassed pelo createAdminClient

-- Trilha de auditoria: cada revelação (reveal) de um token de Bridge de loja.
-- Populada só pelo endpoint POST /api/admin/lojas/[id]/reveal-token (fail-closed).
-- Append-only; espelha o padrão de 20260704_module_audit_log.sql.
CREATE TABLE IF NOT EXISTS public.bridge_token_reveals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    uuid        NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tenant_id  uuid,
  actor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bridge_token_reveals_loja_idx
  ON public.bridge_token_reveals(loja_id, created_at DESC);

-- RLS habilitada sem policy: só service_role (que bypassa RLS) lê/escreve.
-- anon/authenticated não têm acesso — mesmo padrão seguro já auditado no projeto.
ALTER TABLE public.bridge_token_reveals ENABLE ROW LEVEL SECURITY;

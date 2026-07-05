-- Backlog interno de solicitações de alteração por módulo. tenant_id é
-- opcional e só informativo (não filtra nem restringe nada).
CREATE TABLE IF NOT EXISTS module_change_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text        NOT NULL,
  tenant_id   uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  titulo      text        NOT NULL,
  descricao   text,
  status      text        NOT NULL DEFAULT 'aberto'
                CHECK (status IN ('aberto', 'em_andamento', 'concluido')),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_change_requests_feature_idx
  ON module_change_requests(feature_key, status);

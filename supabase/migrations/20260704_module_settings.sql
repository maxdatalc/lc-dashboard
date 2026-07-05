-- Overlay editável por módulo: kill-switch global, cor de destaque, overrides de
-- texto e modelo comercial. Ausência de linha para um feature_key = usar os
-- valores padrão do catálogo em lib/features.ts (kill-switch desligado, sem cor
-- customizada, incluso conforme plano).
CREATE TABLE IF NOT EXISTS module_settings (
  feature_key         text        PRIMARY KEY,
  kill_switch_enabled boolean     NOT NULL DEFAULT false,
  accent_color        text,
  label_override      text,
  descricao_override  text,
  pricing_model       text        NOT NULL DEFAULT 'incluso_free'
                        CHECK (pricing_model IN ('incluso_free', 'incluso_premium', 'avulso')),
  preco_avulso        numeric,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

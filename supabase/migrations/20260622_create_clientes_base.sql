-- Base de clientes prospectados / importados via planilha
CREATE TABLE IF NOT EXISTS public.clientes_base (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_externo TEXT        UNIQUE,          -- código externo do sistema do usuário (informativo)
  razao_social   TEXT        NOT NULL,
  nome_fantasia  TEXT,
  cnpj_cpf       TEXT,
  segmento       TEXT,
  cidade         TEXT,
  telefone       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_base_segmento ON public.clientes_base (segmento);
CREATE INDEX IF NOT EXISTS idx_clientes_base_cidade   ON public.clientes_base (cidade);
CREATE INDEX IF NOT EXISTS idx_clientes_base_razao    ON public.clientes_base (LOWER(razao_social));

ALTER TABLE public.clientes_base ENABLE ROW LEVEL SECURITY;

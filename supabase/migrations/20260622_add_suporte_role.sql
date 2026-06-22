-- Adiciona role de suporte técnico
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suporte BOOLEAN DEFAULT false NOT NULL;

-- Adiciona campo de token Bridge SQL no cliente base
ALTER TABLE public.clientes_base ADD COLUMN IF NOT EXISTS sql_bridge_token TEXT;

-- Comentários descritivos
COMMENT ON COLUMN public.profiles.is_suporte IS 'Acesso de leitura ao painel admin; pode preencher sql_bridge_token nos clientes';
COMMENT ON COLUMN public.clientes_base.sql_bridge_token IS 'Token do Bridge SQL preenchido pelo suporte técnico antes do onboarding';

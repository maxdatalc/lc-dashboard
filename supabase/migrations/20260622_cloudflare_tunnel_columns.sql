ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cloudflare_tunnel_id TEXT,
  ADD COLUMN IF NOT EXISTS cloudflare_tunnel_token TEXT;

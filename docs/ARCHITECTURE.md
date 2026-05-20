# Arquitetura — LC Dashboard

## Visão geral
Aplicação Next.js (App Router) com Server Components e Route Handlers que consumem Supabase como backend (Postgres + Auth) e integrações externas (MaxData e Upstash Redis). Rotinas de sincronização também existem como Edge Functions no diretório `supabase/functions`.

## Estrutura de pastas (resumida)
- `app/` — UI (Server/Client components), páginas e API Route Handlers
- `components/` — componentes React reutilizáveis
- `lib/` — clientes e utilitários (Supabase server client, Redis, MaxData client)
- `supabase/functions/` — Edge Functions para sincronização (Deno)
- `maxdata/` / `lib/maxdata` — cliente HTTP para ERP

## Frontend
- Next.js 14 App Router com Server Components
- Estilização: Tailwind CSS
- Bibliotecas: Recharts (gráficos), Framer Motion (animações), react-day-picker

## Backend
- Supabase (Postgres) como fonte de verdade e armazenamento de entidades: lojas, produtos, clientes, vendas, logs de sync
- Server-side: Route Handlers (`app/api/**`) e Server Actions (`app/actions`) que usam `lib/supabase/server.ts` para criar clients
- Edge jobs: `supabase/functions/sync-erp` e `sync-financeiro`

## Banco de dados
- Postgres (via Supabase)
- Tabelas observadas no código: `lojas`, `produtos`, `clientes`, `vendas`, `venda_itens`, `venda_pagamentos`, `sync_log`

## Autenticação
- Supabase Auth utilizada para login/logout (ver `app/actions/auth.ts`)
- `lib/supabase/server.ts` expõe `createClient()` para uso em Server Components e `createAdminClient()` que usa a Service Role Key para operações administrativas (RLS bypass)

## Multi-tenant
- Multi-tenant por loja: cada registro associado a `loja_id`; tabelas mantêm `loja_id, external_id` para upsert e isolamento de dados por loja

## Integrações
- MaxData: autenticação via `/v2/auth` e chamadas a endpoints como `/product`, `/client`, `/sale` (ver `lib/maxdata` e `supabase/functions/sync-erp`)
- Upstash Redis: cache de tokens (ver `lib/redis.ts`)

## Fluxo de dados (simplificado)

```mermaid
flowchart TD
  A[MaxData (ERP)] -->|GET /v2/auth + endpoints| B[MaxData Client]
  B -->|dados paginados| C[Edge Functions / Route Handlers]
  C -->|upsert| D[Supabase Postgres]
  D -->|queries| E[Next.js Frontend]
  B -->|token| F[Upstash Redis]
```

## Deploy e infraestrutura
- Frontend/Route Handlers: Next.js — pode ser deployado em Vercel ou plataforma que suporte Node + Edge Functions
- Edge jobs (`supabase/functions`): Deno runtime no Supabase Edge Functions
- Requisitos: variáveis de ambiente para `SUPABASE_*`, `ENCRYPTION_KEY`, `UPSTASH_*`, e credenciais do MaxData

## Observações operacionais
- `createAdminClient()` usa a Service Role Key — reduzir exposição e usar apenas em backend
- Backup e cuidado com `ENCRYPTION_KEY` e service role keys (ver `docs/DO_NOT_TOUCH.md`)

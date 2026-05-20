# Backlog e Tarefas — LC Dashboard

## Alta prioridade
- Adicionar testes unitários para `lib/maxdata` e `supabase/functions/sync-erp`.
- Monitoramento e alertas para falhas de `sync_log` (erros recorrentes).
- Garantir rotação segura do `ENCRYPTION_KEY` e processo de fallback.

## Média prioridade
- Implementar CI com `npm run lint` e `npx tsc --noEmit` em PRs.
- Adicionar cobertura de testes para componentes críticos do dashboard.
- Revisar políticas RLS no Supabase e documentar permissões.

## Baixa prioridade
- Otimizar batches de upsert e paralelismo em syncs iniciais.
- Melhorar UX dos relatórios e filtros por período/loja.

## Melhorias futuras
- Implementar filas assíncronas para processamento de itens de venda (para syncs iniciais pesados).
- Dashboard de operações com métricas de sync e tempo médio por loja.

## Débitos técnicos
- Padronizar validação de payloads de API
- Cobrir edge cases de paginação e timeouts no `fetchAllPages`

## Tarefas detectadas automaticamente (do código)
- Verificar uso de `createAdminClient()` e auditar exposições potenciais (arquivo: [lib/supabase/server.ts](lib/supabase/server.ts)).
- Confirmar TTL e estratégia de cache do Redis (arquivo: [lib/redis.ts](lib/redis.ts)).
- Revisar limites de `fetchAllPages` em `supabase/functions/sync-erp/maxdata-client.ts`.

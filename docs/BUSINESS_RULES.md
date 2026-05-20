# Regras de Negócio — LC Dashboard

## Perfis de usuários
- Administrador: acesso a todas as telas administrativas, sincronizações manuais e visualização de logs.
- Operador/Gerente de Loja: visualiza dashboards e dados da(s) sua(s) loja(s).
- Leitura (relatórios): acesso somente leitura a indicadores.

## Permissões
- Autenticação via Supabase Auth; RLS e políticas no Supabase controlam acesso por `loja_id`.
- Operações administrativas que usam `createAdminClient()` exigem credenciais service-role e não devem ser expostas ao cliente.

## Fluxos operacionais
- Sync Inicial: quando não há registro prévio de sync concluído, a sincronização inicial busca 30 dias anteriores.
- Sync Incremental: janela padrão de ~25 minutos para updates incrementais.
- Sync Manual: possível acionar sincronização para uma loja específica via rota/funcão.

## Regras financeiras
- Valores monetários são agregados e armazenados a partir dos campos retornados pelo ERP; o sistema preserva status original de vendas (ex.: canceladas) e usa `valor_total`, `valor_desconto` e `valor_bruto` conforme vindo do ERP.

## Regras de CRM
- Clientes são upsertados por `external_id` (ID do ERP) e relacionados por `cliente_external_id` nas vendas.
- Contatos e dados pessoais devem ser tratados conforme LGPD — evitar logs com dados sensíveis.

## Regras de implantação
- Variáveis de ambiente obrigatórias para operação: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Funções de sincronização (Supabase Edge) precisam de permissões/segredos distintos (service role key no ambiente do Supabase Functions).

## Regras multi-tenant
- Isolamento por `loja_id` em todas as tabelas principais e índices compostos (`loja_id, external_id`) usados para upserts.
- Evitar operações globais sem filtros explícitos que atravessem `loja_id`.

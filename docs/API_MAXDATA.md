# Integração com API MaxData (ERP MaxManager)

## Visão geral
A integração com o ERP MaxManager (apelidado MaxData no código) é feita via REST (prefixo `/v2`). A autenticação é por endpoint `/v2/auth` retornando um token Bearer, que é cacheado em Upstash Redis para reduzir chamadas.

## Endpoints utilizados (observados no código)
- `POST /v2/auth` — autenticação (body: `{ empId, terminal }`)
- `GET /v2/product` — produtos (paginado)
- `GET /v2/client` — clientes (paginado)
- `GET /v2/sale` — vendas (paginado), com filtros de data para sync incremental
- `GET /v2/sale/:id/items` — itens da venda
- `GET /v2/sale/:id/payment` — pagamentos da venda

## Processo de autenticação
1. `getMaxDataToken()` faz `POST /v2/auth` com `{ empId, terminal }`.
2. Token retornado é armazenado no Redis com TTL (~50 minutos) para reuso.
3. Em caso de `401` nas requisições subsequentes, o cache é invalidado e uma nova autenticação é feita.

## Fluxo de sincronização
- Sincronização inicial: janela de 30 dias (quando não existe `sync_log` concluído).
- Sincronização incremental: janela de 25 minutos desde o último sync concluído.
- Paginação: `fetchAllPages()` itera páginas (limit 50 por página) e respeita um limite máximo por execução (ex.: 80 páginas) para evitar timeouts.
- Lógica: dados são transformados para o schema local e upsertados no Supabase por `loja_id` + `external_id`.

## Mapeamento entre ERP e banco local (exemplos)
- Produto: `MaxDataProduto.id` → `produtos.external_id` ; campos `nome`, `preco_venda`, `estoque_atual`.
- Cliente: `MaxDataCliente.id` → `clientes.external_id` ; `nome`, `cnpj_cpf`, `email`, `telefone`.
- Venda: `MaxDataVenda.id` → `vendas.external_id` ; `data_venda`, `valor_total`, `status`.

## Tratamento de erros
- Falhas em loja específica são registradas em `sync_log` (status `erro`) e não interrompem a sincronização de outras lojas.
- Timeouts são tratados com `AbortController`/`AbortSignal` e geram mensagens de erro legíveis.
- Em casos de `401` a camada client limpa o cache do token e tenta nova autenticação.

## Estratégia de sincronização incremental
- Executar job periódico (pg_cron ou Edge Function agendada) que chama a função de sincronização.
- Para cada loja: se não houve sync anterior, executar janela de 30 dias; senão, usar janela curta (~25 min).
- Registrar início/fim/erro and total_registros em `sync_log`.

## Observações operacionais
- Não logar o campo `terminal` nem tokens completos (usar previews).
- Monitorar duração de execuções e número de páginas paginadas para ajustar `maxPages` e evitar timeouts.

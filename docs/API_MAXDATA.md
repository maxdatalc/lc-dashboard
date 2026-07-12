# Integração com a MaxAPI (ERP MaxManager)

> Reescrito em 2026-07-11 a partir de `lib/maxapi/maxapi-client.ts` (fonte da verdade)
> e de testes diretos contra o ambiente de testes da MaxAPI. A versão anterior deste
> doc estava desatualizada: afirmava que só existiam endpoints GET e que o token era
> cacheado em Redis — ambos errados, ver correções abaixo.

## Visão geral

A MaxAPI é a API REST oficial do MaxManager (prefixo `/v2`). No lc-dashboard ela é
usada apenas para **escrita** de dados (criar OS, adicionar item, cancelar item) —
leitura é feita pela Bridge SQL (ver [bridge-sql-constraints.md](wiki/bridge-sql-constraints.md)),
nunca pela MaxAPI para dados que o Bridge já cobre.

```
Auth:      POST /v2/auth  { empid, terminal }  → JWT Bearer token
TTL JWT:   3600s (1 hora exata)
Cache:     Supabase (integration_configs.maxapi_token_cache /
           maxapi_token_expires_at), TTL de aplicação 3000s — NÃO é Redis/Upstash.
```

## Endpoints implementados em `lib/maxapi/maxapi-client.ts`

| Método | Path | Função | Observação |
|---|---|---|---|
| POST | `/v2/auth` | `fetchNewToken` | body usa `empid` minúsculo, não `empId` |
| GET | `/v2/serviceorder` | `listServiceOrdersMaxApi` | paginado, filtros `nomeCliente`/`veiculoPlaca`/`status` |
| GET | `/v2/serviceorder/:id` | `getServiceOrderMaxApi` | objeto direto, não paginado |
| POST | `/v2/serviceorder` | `createServiceOrder` | já em uso em produção |
| POST | `/v2/serviceorder/items` | `addItemToServiceOrderMaxApi` | MaxAPI **ignora** `valor` enviado — sempre usa o preço cadastrado do produto |
| DELETE | `/v2/serviceorder/items/:id` | `cancelServiceOrderItem` | retorna 204 |
| GET | `/v2/product` | `searchProductsMaxApi` | paginado, filtro `descricao` |
| GET | `/v2/product/:id` | `getProductMaxApi` | campo `estoque` = estoque físico do `empId` do JWT |

Todas as chamadas passam por `maxApiRequest()`, que faz retry automático de auth em
`401` (invalida o cache e reautentica uma vez; se falhar de novo, propaga o erro).

**Confirmado — `GET /v2/serviceorder/items?OsId=X` retorna 405.** Itens de OS só são
legíveis via Bridge SQL (`vendaItem`), nunca pela MaxAPI.

## Endpoints confirmados mas NÃO implementados neste client

Verificados contra o ambiente de testes da MaxAPI (2026-07), fora do fluxo do
lc-dashboard (exploração para o lc-storefront). Existem no servidor, mas **nenhuma
função em `lib/maxapi/maxapi-client.ts` os chama hoje** — antes de consumi-los,
implementar seguindo o mesmo padrão de `maxApiRequest()`/cache de token acima.

| Método | Path | Observação |
|---|---|---|
| POST | `/v2/sale` | Cria venda com status "pendente". Exige só `clienteId` + `atendenteId`. Retorna 201. |
| POST | `/v2/sale/items` | Adiciona item à venda. Retorna 201. **Não baixa estoque** — item fica reservado até a venda ser processada (mesmo comportamento de reserva que `serviceorder/items`). |
| POST | `/v2/client` | Cria cliente. Exige o campo `tipo`. |

## Endpoints que NÃO existem (não confundir com o sync antigo)

O doc anterior listava `GET /v2/client`, `GET /v2/sale`, `GET /v2/sale/:id/items` e
`GET /v2/sale/:id/payment` como "endpoints utilizados" — pertenciam a uma Edge
Function de sync (`supabase/functions/sync-erp`) que **foi removida**. Esse sync não
existe mais no código atual; a integração viva com o ERP é via Bridge SQL (leitura)
+ MaxAPI (escrita), não replicação para o Supabase.

## Ciclo de vida do token

```
1. getOrRefreshToken() busca o cache em integration_configs (por loja_id).
2. Token presente e não expirado (maxapi_token_expires_at > agora)? → usa direto.
3. Senão: POST /v2/auth { empid, terminal } → novo JWT.
   Salva em integration_configs com expiração agora + 3000s.
4. Requisição feita com Authorization: Bearer {token}.
5. Resposta 401? → limpa o cache (maxapi_token_cache = null) e refaz getOrRefreshToken
   + a requisição, uma única vez. 401 de novo → erro é propagado para o chamador.
```

Token nunca chega ao browser nem é logado — só usado server-side, dentro de
`maxApiRequest()` (`lib/maxapi/maxapi-client.ts:89`).

## Configuração por loja

`buildMaxApiConfig()` monta o `MaxApiConfig` a partir de:
- `integration_configs.maxapi_url` (URL base, sem barra final)
- `lojas.emp_id_maxdata` (empId numérico usado no auth)
- `lojas.terminal_maxdata` (terminal usado no auth)

Falta de qualquer um desses três lança erro explícito antes de tentar a requisição.

## Tipos

Ver `lib/maxapi/maxapi-types.ts` — `TokenDto`, `ServiceOrder`, `ServiceOrderBody`,
`ServiceOrderItem`, `MaxApiProduct`, `MaxApiPaginated<T>`, `MaxApiError`.

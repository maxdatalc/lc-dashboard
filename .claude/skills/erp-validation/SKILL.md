---
name: erp-validation
description: "Valida dados/métricas contra o ERP MaxManager real antes de implementar ou corrigir dashboards, relatórios, gráficos ou KPIs no lc-dashboard. Ativar sempre que a tarefa envolver: construir ou alterar uma métrica/gráfico/KPI que lê dados de venda, cliente, produto, financeiro ou estoque; escrever uma query nova contra o schema do MaxManager; investigar um valor que diverge entre o dashboard e o ERP; ou qualquer menção a MaxManager, MaxAPI, Bridge, SQL Bridge, BATAUTO, empId/loja, vendaPgto, cliente, produto. Objetivo: nunca supor nome de tabela/coluna e nunca dar uma métrica como pronta sem reconciliar contra o ERP real."
license: MIT
metadata:
  author: lucas
  version: "1.0.0"
---

# Validação contra o ERP MaxManager

## Por que essa skill existe

Na análise do histórico de sessões deste projeto (ver `docs/wiki/`), a causa raiz mais recorrente de bugs em produção — de longe — foi supor um nome de tabela/coluna do MaxManager ou um valor calculado sem reconciliar contra o ERP real. Isso já quebrou builds, gerou KPIs com contagem duplicada, e produziu dashboards com números divergentes da tela real do MaxManager, descobertos só depois de já estarem em produção. Esta skill existe para inverter a ordem: **consultar o ERP real primeiro, implementar depois.**

## Quando ativar

- Construir ou alterar qualquer dashboard, relatório, gráfico ou KPI que leia dados de venda, cliente, produto, estoque ou financeiro.
- Escrever uma query SQL nova (ou alterar uma existente) contra o schema do MaxManager, via Bridge ou script direto.
- Investigar por que um valor no dashboard não bate com o que o usuário vê no MaxManager.
- Qualquer menção a MaxManager, MaxAPI, Bridge/SQL Bridge, BATAUTO, `empId`/loja, `vendaPgto`, `cliente`, `produto`, `venda`.

**Não** ativar para trabalho puramente visual/CSS que não toca em query ou em número exibido (nesse caso, `/frontend-design` é a skill certa — pode ser usada em conjunto).

## Qual banco usar — regra fixa

**Sempre** conectar no bridge de testes oficial, configurado em `.env.local` como `BRIDGE_TEST_URL` + `BRIDGE_TEST_TOKEN` (banco `SALES`). **Nunca conectar em BATAUTO** — descontinuado como alvo de validação em 2026-07-06, não usar mesmo que apareça em código/script antigo ou em `MSSQL_DATABASE` de alguma configuração legada.

As credenciais reais existem só em `.env.local` (gitignored). **Nunca** colar o valor do token/senha em código, query, commit, doc ou qualquer arquivo que vá para o Git — ler sempre via variável de ambiente. Ver [docs/wiki/bridge-sql-constraints.md](../../docs/wiki/bridge-sql-constraints.md).

## Workflow

### 1. Ler o que já se sabe antes de consultar o banco de novo
Antes de qualquer query nova, ler `docs/wiki/erp-maxmanager-schema.md` (nomes reais de coluna já descobertos) e `docs/wiki/bridge-sql-constraints.md` (limites da Bridge). Boa parte dos nomes de tabela/coluna já foi mapeada — reconsultar o banco do zero quando já existe a resposta documentada é desperdício.

### 2. Nunca supor — consultar o schema real
Se a tabela/coluna necessária não estiver documentada no passo 1, conectar via `BRIDGE_TEST_URL`/`BRIDGE_TEST_TOKEN` (banco `SALES` — nunca BATAUTO) e inspecionar o schema real e uma amostra de linhas **antes** de escrever a query de negócio. Não assumir nome por convenção nem por semelhança com outra tabela.

Para tarefas grandes (exploração de várias tabelas + implementação), considere dividir em sub-agentes: um explora o schema via Bridge enquanto outro prepara a implementação.

### 3. Checklist de armadilhas conhecidas
Antes de finalizar a query/métrica, revisar contra `docs/wiki/dashboard-metric-pitfalls.md`. Em particular, confirmar:
- **Multi-loja**: a query agrega todas as lojas/`empId` selecionadas (não só a primeira)? Se houver TOP N, ele é calculado **depois** de agregar entre lojas, não antes?
- **Status "em aberto"/"quitado"**: o filtro de status foi validado para *este* cliente/bridge especificamente (ex.: tratamento de `pgtPago = 'G'` varia por cliente)?
- **Granularidade**: um join entre `venda` e `vendaItem` (ou similar 1:N) não está inflando uma contagem/soma que deveria ser por venda?
- **Timezone/data**: limites de dia usam getters locais ou meio-dia fixo, não `toISOString()` cru?
- **Formatação monetária**: valor completo, sem abreviação, sem risco de overflow por non-breaking space?

### 4. Reconciliar contra o ERP real antes de declarar pronto
Não considerar a métrica/feature pronta só porque a query rodou sem erro. Reconciliar o número final contra a tela equivalente do MaxManager real — pedir ao usuário um print/valor de referência se não houver acesso visual direto, ou comparar contra uma query já validada e em produção (ex.: réplica do padrão "top 50 vendedores" já existente) quando fizer sentido.

### 5. Documentar o que foi descoberto
Se esse processo revelar um nome de coluna, regra de negócio ou armadilha nova (algo que não estava em `docs/wiki/erp-maxmanager-schema.md` ou `dashboard-metric-pitfalls.md`), adicionar uma linha lá antes de terminar a tarefa. O valor desta skill degrada se o conhecimento novo não for realimentado nela.

## Referências
- `docs/wiki/erp-maxmanager-schema.md` — nomes reais de tabela/coluna e regras de negócio já mapeadas
- `docs/wiki/bridge-sql-constraints.md` — limites e arquitetura da SQL Bridge (SELECT único, sem UNION, limite de tamanho, etc.)
- `docs/wiki/dashboard-metric-pitfalls.md` — checklist de bugs recorrentes
- `raw/inputs/` — sessões originais de onde esses aprendizados vieram, para contexto adicional se necessário

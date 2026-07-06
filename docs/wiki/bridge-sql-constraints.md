# SQL Bridge — arquitetura e limites

A "Bridge" (`lc-sql-bridge`) é um proxy HTTP instalado na máquina do cliente que expõe o SQL Server local do MaxManager pela internet via Cloudflare Tunnel, porque esse SQL Server fica numa rede interna não alcançável diretamente. É o substituto do sync antigo via MaxData/Edge Functions — hoje a maioria das telas consulta o ERP **em tempo real** via Bridge em vez de replicar dados no Supabase.

## Bridge de testes oficial — usar sempre, nunca BATAUTO

Para qualquer trabalho de validação/exploração/reconciliação de dados (ex.: a skill `erp-validation`), **usar sempre o bridge de testes oficial**, configurado em `.env.local` como `BRIDGE_TEST_URL` + `BRIDGE_TEST_TOKEN` (banco `SALES`). **Nunca conectar em BATAUTO** — foi descontinuado como alvo de validação (2026-07-06).

As credenciais reais ficam só em `.env.local` (gitignored) — **nunca colar o valor do token ou senha em código, script, doc ou qualquer arquivo versionado**. Isso já aconteceu uma vez com um token de cliente real (ver [erp-maxmanager-schema.md](erp-maxmanager-schema.md), incidente do `51357dca`) e obrigou a scrubar o repo com `git filter-repo`.

## Por que existe
- O SQL Server do MaxManager roda na rede interna do cliente, não é acessível pela internet. A Bridge resolve isso agindo como proxy local + túnel.
- Scripts de conexão MSSQL direta (`scripts/*.mjs`) só funcionam quando a máquina de dev está na mesma rede local (ex.: `localhost:1433` numa sessão local) — em qualquer outro caso, passar pela Bridge.

## Limites de contrato (respeitar ao escrever queries novas)
- Apenas **SELECT** é permitido — a Bridge rejeita qualquer coisa que não seja um SELECT/CTE.
- Cada query deve ser uma **única** instrução SELECT/CTE — sem `UNION ALL`, sem múltiplas instruções no mesmo request.
- Parâmetros devem ser escalares nomeados.
- Limite de tamanho do texto SQL: era 8000 caracteres, depois elevado para 32000 (`bridge.js`). Passar do limite retorna um erro 403 "Apenas SELECT é permitido" — fácil de diagnosticar errado como problema de sintaxe/permissão quando na verdade é tamanho. Caracteres não-ASCII em comentários SQL já foram descartados como falsa pista nesse mesmo bug — o problema real era tamanho.
- Túnel Cloudflare da Bridge deve ser `Type=HTTP`, nunca HTTPS (HTTPS causa erro 525).

## Deploy/atualização em cliente
- Atualizar a Bridge num cliente **não** exige reinstalação — `bridge.js` é um arquivo simples: substituir e reiniciar a tarefa agendada do Windows (`schtasks /End` + `/Run`).
- Ver [windows-installer-gotchas.md](windows-installer-gotchas.md) para as armadilhas do instalador (.exe via ps2exe, Task Scheduler, etc).

## Uso recomendado (ver também [collaboration-workflow.md](collaboration-workflow.md))
Antes de implementar ou corrigir qualquer métrica/gráfico que dependa de dados do ERP: **conectar via Bridge e consultar o schema real primeiro** (nunca supor nome de tabela/coluna) e, quando possível, **reconciliar o número calculado com a tela equivalente no MaxManager real** antes de considerar a feature pronta. Esse é o padrão mais repetido em todo o histórico de sessões — ver [dashboard-metric-pitfalls.md](dashboard-metric-pitfalls.md) para a lista de bugs que essa validação evita.

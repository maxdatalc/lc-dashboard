# LC Dashboard — regras do ERP MaxManager

Regras de negócio e armadilhas do ERP que já causaram bug em produção. **Ler antes de
escrever ou alterar qualquer query/KPI que leia dados de venda, OS, produto ou financeiro.**
Aprofundamento em `docs/wiki/` (`erp-maxmanager-schema.md`, `bridge-sql-constraints.md`,
`dashboard-metric-pitfalls.md`).

## Nunca supor schema — validar no bridge primeiro

Sempre validar nome de tabela/coluna e valor calculado contra o ERP real **antes** de
implementar. A causa nº 1 de bug em produção neste projeto é supor um nome/regra.

```bash
node scripts/query-bridge-teste.mjs "SELECT TOP 5 * FROM venda"
```

- Usar **sempre** o bridge de testes (`BRIDGE_TEST_URL` + `BRIDGE_TEST_TOKEN` em
  `.env.local`, banco `SALES`). **Nunca BATAUTO** (descontinuado em 2026-07-06).
- Credenciais só em `.env.local` (gitignored). **Nunca** colar token em código, query,
  commit ou doc — já houve incidente que obrigou `git filter-repo` no repo.

### Limites da Bridge
- Só **SELECT**, uma **única** instrução (CTE ok, `UNION` não). Params escalares nomeados.
- Limite do texto SQL: 32000 chars. Estourar retorna `403 "Apenas SELECT é permitido"` —
  fácil de diagnosticar errado como sintaxe/permissão quando é só tamanho.
- SQL Server **não aceita subquery dentro de agregado** (`SUM(CASE ... (SELECT ...))`) →
  usar `OUTER APPLY` e agregar a coluna resultante.

## venda.vedStatus — valores confirmados (bridge SALES)

| Status | Significado |
|---|---|
| `F` | Finalizada |
| `C` | Cancelada |
| `S` | Aguardando **Supervisão de Vendas** (tela 113) |
| `X` | **No caixa, sem fechar** — autorizada pelo cliente, aguardando finalização. `vedTotalNf` real |
| `A` | **Em andamento, antes do caixa** (`vedFechamento` sempre NULL). Para OS é a fase de execução — inclui tanto OS autorizadas quanto ORÇAMENTO; separar pelo `tatServGeraFinanceiro`, não pelo status |
| `O` | **Abandonada** — `vedTotalNf` sempre 0, nenhuma recente. Nunca usar como "em aberto" |
| `Q`, `Z` | Raros, sem `vedTotalNf` |

## KPI "Em Aberto" (validado 2026-07-24 com o usuário)

Regra: venda/OS **já autorizada pelo cliente mas ainda não finalizada no sistema**.
Não inclui orçamentos/propostas.

- **VE**: `vedStatus IN ('S','X')`
- **OS**: `vedStatus IN ('A','S','X')` **E** `tipoAtend.tatServGeraFinanceiro = 1`
  (OS inclui `A` — uma OS aberta já foi autorizada pelo cliente)
- **Fora**: `O`, `Q`, `Z`, `F`, `C`
- **É o `tatServGeraFinanceiro` que exclui orçamento/proposta**, não o status: das 971 OS
  em `A` no bridge de testes, 783 são tipo **ORÇAMENTO** (`geraFinanceiro=false`) e só 172
  são **NORMAL** (`true`). GARANTIA e RETORNO também caem fora pelo mesmo flag. Excluir o
  status `A` inteiro é **errado** — descarta OS legítimas já autorizadas.
- **Valor**: preferir `vedTotalNf` quando `> 0` (já reflete o desconto de fechamento);
  cair em `SUM(vdiQtde * vdiValor)` só quando `vedTotalNf = 0` (ex.: VE em supervisão).
  Exemplo real: OS 42197 tem `vedTotalNf` = 1033 mas soma de itens = 1150 — usar a soma
  de itens inflava o KPI.

Implementado em `app/api/dashboard/em-aberto/route.ts`.

> ⚠️ **`app/api/home/summary/route.ts` ainda usa a lógica antiga** (`vedStatus = 'S'` só, e
> valor por soma de itens). Foi deixado assim de propósito — alinhar quando a home for
> reformulada.

## Outras armadilhas recorrentes

- **`vendaItem.vdiValor` é preço UNITÁRIO**, não total da linha. Sempre
  `vdiQtde * vdiValor`. Já causou subnotificação de ~50% em dois endpoints.
- **`vedTotalNf = 0`** em pedidos não faturados — não confiar nele como valor nesses casos.
- **"Gera financeiro"**: `VE` gera **incondicionalmente**; só `OS` depende de `tipoAtend`.
  `vedTipoAtend` é **sempre NULL para `vedTipo='VE'`** — uma condição
  `(tatProGeraFinanceiro=1 OR tatServGeraFinanceiro=1)` fica sempre falsa para venda balcão
  (o join nunca casa) e já subestimou receita em ~13%.
  `tatServGeraFinanceiro` e `tatProGeraFinanceiro` nunca divergem no bridge de testes.
- **"Em aberto" em `vendaPgto`** (A Receber/Pagar) é outro conceito: **não** é `pgtPago IN
  ('N','F')` — `F` = quitado. O tratamento de `G` **varia por cliente/bridge** (em alguns é
  parcela futura, em outros é duplicata via `pgtRef`). Validar por bridge antes de confiar.
- **`caixaVendas`** é tabela morta (import único, 29 linhas) — usar `vendaPgto`.
- **Multi-loja**: agregar todas as `empId` selecionadas; `TOP N` calculado **depois** de
  agregar entre lojas, nunca antes.
- **Granularidade**: join `venda` → `vendaItem` (1:N) infla `COUNT`/`SUM` por venda.
- **Timezone**: limites de dia com getters locais ou meio-dia fixo, nunca `toISOString()` cru.

## Ao descobrir algo novo

Adicionar em `docs/wiki/erp-maxmanager-schema.md` (ou aqui, se for regra de alto impacto)
antes de encerrar a tarefa. O valor deste arquivo degrada se o aprendizado não voltar pra cá.

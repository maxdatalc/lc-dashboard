/**
 * Se uma venda "gera financeiro" (conta como receita) é decidido por vedTipoAtend,
 * não por CFOP. `VE` (venda balcão) gera financeiro incondicionalmente. `OS` (ordem
 * de serviço) só gera financeiro se o tipo de atendimento configurado permitir
 * (tipoAtend.tatServGeraFinanceiro / tatProGeraFinanceiro) — sem esse filtro, O.S.
 * concluídas com atendimento marcado para NÃO gerar financeiro entram indevidamente
 * no faturamento. Confirmado no bridge BATAUTO (empId 1, 2026-07-22): sem filtro a
 * "Venda Total" de hoje somava R$268.828,16; com o filtro bate exato com o ERP:
 * R$17.737,00.
 *
 * @param prefix alias da tabela `venda` na query (ex.: "v", "v2"); omitir se
 * `venda` não tiver alias na query.
 */
export function geraFinanceiroClause(prefix = ""): string {
  const p = prefix ? `${prefix}.` : "";
  return `AND (${p}vedTipo = 'VE' OR EXISTS (
      SELECT 1 FROM tipoAtend ta WHERE ta.tatId = ${p}vedTipoAtend
        AND (ta.tatServGeraFinanceiro = 1 OR ta.tatProGeraFinanceiro = 1)
    ))`;
}

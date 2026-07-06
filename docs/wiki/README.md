# Wiki — aprendizados destilados das sessões do Claude Code

Conhecimento extraído de ~30 sessões reais de trabalho (2026-06-05 a 2026-07-05), destilado por tópico. Fonte bruta em [`raw/inputs/`](../../raw/inputs/README.md). Gerado em 2026-07-05.

Isto complementa (não substitui) `docs/ARCHITECTURE.md`, `docs/BUSINESS_RULES.md` e `docs/PROJECT_CONTEXT.md` — que descrevem a arquitetura **antiga** baseada em sync MaxData/Edge Functions. Essa arquitetura foi **descontinuada** em favor de consulta em tempo real via SQL Bridge (ver [bridge-sql-constraints.md](bridge-sql-constraints.md)); os três documentos antigos estão desatualizados nesse ponto e merecem uma revisão à parte.

## Páginas

- [erp-maxmanager-schema.md](erp-maxmanager-schema.md) — nomes reais de colunas/tabelas do MaxManager, armadilhas de schema
- [bridge-sql-constraints.md](bridge-sql-constraints.md) — arquitetura e limites da SQL Bridge
- [dashboard-metric-pitfalls.md](dashboard-metric-pitfalls.md) — classes de bugs recorrentes em métricas/dashboards
- [vercel-deploy-gotchas.md](vercel-deploy-gotchas.md) — armadilhas de build/deploy na Vercel
- [windows-installer-gotchas.md](windows-installer-gotchas.md) — armadilhas de instaladores Windows/PowerShell (lc-sql-bridge)
- [collaboration-workflow.md](collaboration-workflow.md) — como o Lucas prefere trabalhar com o Claude
- [business-decisions-log.md](business-decisions-log.md) — decisões de produto/negócio registradas nas sessões

# Vercel — armadilhas de build e deploy

## Regra de branch (fixa)
`develop` = preview, `main` = produção servindo clientes reais. Nunca promover `develop` → `main` sem confirmação explícita do usuário. Antes de qualquer push, confirmar em qual branch está.

## Causas de build quebrado já vistas (repetidas)
- ESLint `no-unused-vars` em import órfão deixado após um refactor — mesma classe de erro (`getCoreFeatures` definido mas nunca usado) quebrou o build de produção em pelo menos duas sessões diferentes, dias de intervalo.
- Aspas retas (`"`) dentro de texto JSX quebram o build (precisa `&ldquo;`/`&rdquo;` ou similar) — vale um grep antes de dar push.
- `react-leaflet@5` exige React 19; o projeto está fixado em React 18 → usar `react-leaflet@4.x`. A Vercel **não** aplica `--legacy-peer-deps` automaticamente como um `npm install` local pode ter feito — instalação local limpa não garante build limpo na Vercel.

## Limites de plano (Hobby)
- Cron só aceita agendamento diário, não horário (`0 * * * *` falha ao dar deploy) — para sync horário, usar cron-job.org externo ou upgrade de plano.
- Limite de corpo de requisição de 4.5MB — uploads grandes (CSV etc.) devem ser fatiados no cliente (~1000 linhas/request) em vez de enviados como payload único.

## Diagnóstico
- Rota Next.js que chama `notFound()` por uma checagem interna falhar retorna HTTP 200 com corpo de página 404 — não confiar em "status 200 nos logs da Vercel" como prova de que a rota renderizou certo; investigar `notFound()` acionado por nome de coluna divergente (ex.: código espera `empresa_id`, coluna real é `tenant_id`).
- Falha de webhook GitHub→Vercel já obrigou a instalar a Vercel CLI localmente como bypass para forçar deploy manual.

## Padrão de trabalho observado
- Pedido recorrente: colar o log de erro de build/runtime da Vercel na íntegra e esperar diagnóstico + correção cirúrgica, sem indicação adicional de onde olhar.
- Pedido recorrente: "commit e push só pra build subir na Vercel" — às vezes só para validar visualmente em preview, não porque o código mudou de fato.
- Serverless (Vercel Functions): `void asyncCall()` fire-and-forget pode ser morto antes de resolver porque o runtime pode encerrar a função logo após a resposta HTTP ser enviada — qualquer efeito colateral tipo "log this access" precisa de `await` + `try/catch`, nunca fire-and-forget.

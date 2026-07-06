# Como o Lucas trabalha com o Claude Code

Padrões de colaboração observados repetidamente ao longo de ~30 sessões — úteis para calibrar o tom e a ordem das ações em qualquer sessão futura.

## Validar antes de construir
Pedido mais repetido de todo o histórico, em praticamente toda sessão que envolve dado do ERP: **conectar na Bridge e consultar o schema real antes de escrever qualquer query ou métrica** — nunca supor nome de tabela/coluna. Frases típicas: "de preferencia acesse o sql e não suponha nomes de tabela", "voce precisa analisar o sql é só acessar ele via bridge para saber as tabelas". Ver [erp-maxmanager-schema.md](erp-maxmanager-schema.md).

## Mudança cirúrgica, nunca refactor oportunista
Frases recorrentes: "Todas as mudanças devem ser CIRÚRGICAS — não quebrar o que funciona", "por favor não quebre o script apenas verifique e corrija", "faça por etapas para não quebrar", "Preserve toda a lógica atual". Em redesigns visuais grandes, o pedido explícito é sempre "não altere query SQL/API, só o visual" — separar mudança visual de mudança de lógica/dado é uma expectativa fixa, não uma preferência pontual.

## Auditoria read-only antes de alterar
Padrão reutilizado: pedir um levantamento completo, só leitura, antes de tocar em código — "não precisa mudar nada no codigo apenas analisar e me dar um feedback", "Antes de alterar qualquer código, faça uma análise profunda do estado atual", "por enquanto nao altere apenas faça esse levantamento e me de ideias". Aparece como prompts estruturados tipo "PASSO 1/2/3" com "NÃO altere nada — apenas leia".

## Deploy
- `develop` = preview, `main` = produção com clientes reais. Nunca promover sem confirmação explícita.
- Commit/push só quando ele pedir explicitamente ("não faça commit e push ainda, só quando eu solicitar") — mas o pedido em si é frequente, muitas vezes só para forçar um build de validação na Vercel.
- Cola logs de erro de build/runtime da Vercel na íntegra, sem instrução adicional, esperando diagnóstico e correção diretos.
- Antes de reportar algo como pronto, verificar se "não quebrou nada" — não assumir que passou só porque não deu erro visível.

## Design visual
- Usa `/frontend-design` (e ocasionalmente `/ui-ux-pro-max`) para qualquer tela nova ou redesign, quase sempre orientado por screenshot/imagem de referência ("deixe exatamente igual à imagem em anexo").
- Pede explicitamente para não parecer "feito com IA"/genérico.
- Preferência de tema: painel admin escuro por padrão, com toggle funcional para claro (o gerente dele prefere claro).
- Nunca abreviar valores monetários em cards — sempre completo, redimensionar layout se precisar.

## Tarefas grandes
- Pede divisão em sub-agentes para tarefas grandes, principalmente quando envolve exploração de banco em paralelo com implementação ("como é uma tarefa grande divida em sub-agentes").
- Para features maiores, já usou o fluxo superpowers de writing-plans + subagent-driven-development (sessão `ee4b30f0`, feature "Gestão de Módulos").

## Retomada de contexto
Pede resumos de sessão com frequência: "me da um resumo completo de tudoque fizemos e o status atual", "continue de onde parou".

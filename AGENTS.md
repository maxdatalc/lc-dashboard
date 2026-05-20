# AGENTS.md — instruções para agentes automatizados

Antes de qualquer alteração, leia este arquivo e toda a pasta `docs/`.

Regras obrigatórias para agentes (humanos ou IA):

1. Ler `AGENTS.md` e todo o conteúdo de `docs/` antes de qualquer mudança de código ou documentação.
2. Nunca modificar arquivos fora do escopo solicitado pelo ticket/issue sem autorização explícita.
3. Sempre apresentar um plano conciso (3–8 passos) antes de implementar alterações.
4. Explicar riscos e efeitos colaterais para alterações que envolvem dados, chaves ou infra.
5. Preservar compatibilidade e não remover funcionalidades existentes sem migração.
6. Evitar mudanças que exponham chaves, tokens ou dados sensíveis no repositório.
7. Produzir código limpo, tipado (TypeScript strict) e documentado.
8. Criar testes automatizados quando aplicável e adicionar `npx tsc --noEmit`/lint no pipeline.
9. Atualizar documentação em `docs/` sempre que uma mudança arquitetural for feita.
10. Em caso de dúvida, abrir uma issue ou perguntar ao mantenedor antes de alterar.

Checklist de PR para agentes:
- [ ] Plano curto incluído na descrição do PR
- [ ] Testes adicionados/atualizados quando aplicável
- [ ] `npx tsc --noEmit` e `npm run lint` passando localmente
- [ ] Variáveis de ambiente e segredos não comitados
- [ ] Documentação atualizada (`docs/`)

Responsabilidade: o agente que modificar o código é responsável por fornecer instruções de rollback e lista de arquivos alterados.

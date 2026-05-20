# Padrões de Código — LC Dashboard

## TypeScript
- `tsconfig.json` com `strict: true` já habilitado — manter e melhorar a tipagem.
- `any` proibido sem justificativa clara e revisão de PR; prefira `unknown` + validação quando necessário.

## Convenções de nomes
- Arquivos React: `kebab-case` para rotas/páginas, `PascalCase` para componentes.
- Variáveis e funções: `camelCase`.
- Tipos e interfaces: `PascalCase` com sufixos quando aplicável (ex.: `MaxDataProduto`).

## Estrutura de componentes
- Preferir Server Components quando possível; marcar `use client` apenas em componentes que requerem estado/efeitos.
- Componentes pequenos e reutilizáveis em `components/` organizados por domínio.

## Tratamento de erros
- Normalizar mensagens de erro e não vazar dados sensíveis (ex.: `terminal`, tokens, chaves).
- Em endpoints, retornar status HTTP apropriado e payload JSON explicativo.

## Logs
- Logs informativos no backend (sync start/finish, token cache, erros) são aceitáveis.
- Evitar logs de dados sensíveis; usar previews para tokens.

## Segurança
- Nunca commitar `ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou segredos em repositório.
- `createAdminClient()` deve ser usado somente em backend seguro.
- Criptografia AES-GCM para terminais (já implementada) deve manter a chave fora do código.

## Performance
- Cache de tokens no Redis para reduzir chamadas de autenticação.
- Upserts em lotes (ex.: LOTE=200) para limitar payloads e tempo de query.

## Comentários e documentação
- Comentários curtos para explicar decisões não triviais.
- Atualizar `docs/` quando fizer mudanças estruturais.

## Testes
- Incluir testes unitários para utilitários críticos (ex.: `lib/maxdata`, `lib/crypto`) e integração para rotas de sync quando possível.

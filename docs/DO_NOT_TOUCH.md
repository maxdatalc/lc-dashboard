# Do Not Touch — Arquivos Críticos

Estes arquivos e locais não devem ser alterados sem entendimento e revisão cuidadosa:

- Variáveis de ambiente e chaves: `.env.local`, `.env.example` (contêm endpoints e segredos de integração)
- `ENCRYPTION_KEY` (usada por `lib/crypto.ts`) — rota de recuperação/rotação deve ser planejada
- `SUPABASE_SERVICE_ROLE_KEY` — não expor em frontend
- `supabase/functions/` — edge functions Deno usadas em produção; alterações requerem testes e deploy controlado
- `lib/supabase/server.ts` — criação de `createAdminClient()` (bypass RLS)
- `lib/crypto.ts` — rotina de encriptação/decriptação de terminais
- Banco de dados: tabelas `vendas`, `produtos`, `clientes`, `sync_log` — migrar com cuidado

Cuidados obrigatórios antes de alterar
- Fazer backup do banco e testar em ambiente de staging
- Revisão por outro desenvolvedor e plano de rollback
- Garantir que chaves/segredos estejam em vault/variáveis de ambiente

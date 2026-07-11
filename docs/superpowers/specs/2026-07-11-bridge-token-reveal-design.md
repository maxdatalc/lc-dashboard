# Reveal explícito de token de Bridge com auditoria

**Data:** 2026-07-11
**Status:** aprovado, pronto para plano de implementação

## Contexto e motivação

Na correção de segurança F1 (commit `da0dafb`), o token da Bridge SQL deixou de ser
enviado ao browser: a página de edição da Bridge da loja passou a receber apenas
`hasToken` (boolean) em vez do token descriptografado. Como efeito colateral, o botão
"Copiar token" — que o admin usava para **recuperar** tokens já salvos — deixou de
funcionar para tokens existentes (o campo agora começa vazio).

Este design restaura essa capacidade de forma segura: em vez de expor o token no
carregamento da página, o token só é revelado após uma **ação explícita, restrita a
system admin e registrada em auditoria**.

## Decisões já tomadas (via brainstorming)

- **Autorização:** apenas `is_system_admin`. Suporte (`is_suporte`) continua podendo
  preencher/substituir tokens, mas **não** revelar um token já salvo.
- **Escopo:** apenas `lojas.sql_bridge_token` (criptografado em repouso com AES-256-GCM).
  A superfície separada `clientes_base.sql_bridge_token` (hoje armazenada sem criptografia
  e enviada ao browser via `TokenBridgeInput`) é um problema pré-existente distinto e
  **fora do escopo** desta entrega — tratar depois.
- **Auditoria:** tabela dedicada `bridge_token_reveals`, não reuso de `module_audit_log`
  (esta última é lida pela tela de auditoria de módulos em `lib/db/modules.ts:382` e seria
  poluída por eventos de bridge).
- **Registro:** inclui `ip` + `user_agent` (best-effort), além de actor + loja + tenant + hora.

## Componentes

### 1. Migration — tabela `bridge_token_reveals`

Append-only, espelha o padrão de `module_audit_log` (`supabase/migrations/20260704_module_audit_log.sql`).

```sql
CREATE TABLE IF NOT EXISTS public.bridge_token_reveals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    uuid        NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tenant_id  uuid,
  actor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bridge_token_reveals_loja_idx
  ON public.bridge_token_reveals(loja_id, created_at DESC);

ALTER TABLE public.bridge_token_reveals ENABLE ROW LEVEL SECURITY;
-- Sem policy: apenas service_role (que bypassa RLS) lê/escreve. anon/authenticated: nada.
```

- `loja_id` com FK real (a loja sempre existe no reveal). `tenant_id` desnormalizado para
  facilitar consulta futura; nullable por robustez.
- RLS habilitada sem policy segue o padrão seguro já auditado no projeto.
- Aplicar via MCP `apply_migration` (mesmo fluxo dos fixes anteriores) e versionar o `.sql`
  em `supabase/migrations/`.

### 2. Endpoint — `POST /api/admin/lojas/[id]/reveal-token`

Fluxo:
1. `getUser()` via `createClient()`; sem usuário → **401**.
2. `isSystemAdmin(user.id)`; falso → **403**. (Reusa `lib/db/admin.ts`.)
3. Carrega o token descriptografado da loja server-side via `getLojaAdmin(lojaId)`
   (retorna `bridgeToken` já descriptografado e `tenantId`). Loja inexistente ou sem
   token → **404** (`{ error: "Token não configurado" }`).
4. **Grava o registro de auditoria antes de responder** (`actor_id`, `loja_id`,
   `tenant_id`, `ip`, `user_agent`) usando `createAdminClient()`.
   - `ip`: primeiro valor de `x-forwarded-for` (fallback `x-real-ip`), best-effort.
   - `user_agent`: header `user-agent`, best-effort.
   - **Fail-closed:** se o insert de auditoria falhar, responder **500** e **não** revelar
     o token. Sem log confiável, sem reveal.
5. Sucesso → `NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } })`.

Notas:
- `POST` (não `GET`): a operação escreve auditoria e o token não deve entrar em
  cache/history/proxy. Corpo da requisição vazio; `lojaId` vem da rota.
- Sem rate-limiting dedicado nesta entrega: o controle é a auditoria + restrição a admin
  (YAGNI). Cada reveal fica registrado.

### 3. UI — botão "Revelar token atual" no `bridge-form.tsx`

- Renderizado **apenas quando `loja.hasToken`** é verdadeiro (loja já configurada).
- Ao clicar: `POST /api/admin/lojas/${lojaId}/reveal-token`.
  - Sucesso → `setToken(data.token)` (preenche o campo). Isso reativa o toggle 👁 e o botão
    **Copiar** existentes — restaurando exatamente o fluxo antigo de recuperação.
  - Exibe aviso discreto: *"Token revelado — este acesso foi registrado."*
  - Erro → mensagem inline (reusar o padrão visual de `testStatus === "erro"`).
- Estados do botão: `idle` / `revealing` (spinner) / `erro`.
- O `lojaId` já é passado como prop ao form (adicionado no commit `da0dafb`).

Consequência de segurança preservada: após o reveal o token fica no browser (igual ao
comportamento antigo), mas **somente após uma ação explícita e auditada**, nunca mais no
load da página.

## Fluxo de dados

```
Admin clica "Revelar token atual"
  → POST /api/admin/lojas/[id]/reveal-token  (corpo vazio)
    → autoriza (auth + is_system_admin)
    → getLojaAdmin(id) → token descriptografado (server-side)
    → INSERT bridge_token_reveals (actor, loja, tenant, ip, ua)   [fail-closed]
    → 200 { token }  (Cache-Control: no-store)
  → setToken(token) no form → campo mostra token, Copiar/👁 reativados
```

## Tratamento de erros

| Situação | Resposta |
|---|---|
| Não autenticado | 401 `{ error }` |
| Autenticado, não é system admin | 403 `{ error }` |
| Loja inexistente ou sem token | 404 `{ error }` |
| Falha ao gravar auditoria | 500 `{ error }` — **token não revelado** |
| Sucesso | 200 `{ token }` + `Cache-Control: no-store` |

## Testes / verificação

- `npx tsc --noEmit` e `next lint` nos arquivos alterados (portão mínimo, como nos fixes anteriores).
- Verificação de comportamento em preview (branch `develop` = preview na Vercel):
  1. Admin revela token de uma loja configurada → campo preenchido, Copiar funciona.
  2. Conferir que uma linha apareceu em `bridge_token_reveals` (via MCP `execute_sql`).
  3. Usuário não-admin recebe 403 (suporte não revela).
  4. Loja sem token → 404, sem linha de auditoria.
- Não há como exercitar o caminho ao vivo localmente sem Supabase real; o preview cobre isso
  antes de qualquer chegada à `main`/produção.

## Fora de escopo (registrar para depois)

- Criptografar `clientes_base.sql_bridge_token` em repouso e parar de enviá-lo ao browser
  em `TokenBridgeInput` (vazamento pré-existente, análogo ao F1).
- Step-up auth (reconfirmar senha antes de revelar) — não necessário para operação
  solo-admin; a auditoria é o controle.
- Tela admin para *ler* o histórico de `bridge_token_reveals` (a tabela é populada agora;
  a visualização pode vir quando houver necessidade).

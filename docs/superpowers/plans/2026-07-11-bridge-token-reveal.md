# Bridge Token Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar a recuperação de tokens de Bridge da loja via uma ação explícita, restrita a system admin e registrada em auditoria — sem reexpor o token no carregamento da página.

**Architecture:** Um botão "Revelar token atual" no form da Bridge chama um endpoint `POST` admin-only que descriptografa o token server-side, grava uma linha em `bridge_token_reveals` (fail-closed) e devolve o token com `Cache-Control: no-store`. Segue o padrão de rotas admin já existente (`app/api/admin/lojas/[id]/nome-bridge/route.ts`).

**Tech Stack:** Next.js 14 App Router (route handlers), Supabase (service_role via `createAdminClient`), AES-256-GCM (`lib/crypto.ts`), vitest, TypeScript.

## Global Constraints

Copiados verbatim do spec (`docs/superpowers/specs/2026-07-11-bridge-token-reveal-design.md`). Cada tarefa herda estas regras:

- **Autorização:** apenas `is_system_admin`. Suporte (`is_suporte`) **não** revela.
- **Escopo:** apenas `lojas.sql_bridge_token` (criptografado). `clientes_base.sql_bridge_token` está **fora de escopo**.
- **Fail-closed:** se a gravação de auditoria falhar, responder 500 e **não** revelar o token.
- **RLS:** tabela de auditoria com RLS habilitada e **sem policy** (só `service_role` acessa).
- **Transporte:** endpoint é `POST`, resposta com `Cache-Control: no-store`. Token só vai ao browser após ação explícita.
- **Auditoria registra:** `actor_id`, `loja_id`, `tenant_id`, `ip` (best-effort), `user_agent` (best-effort), `created_at`.
- **Verificação mínima por tarefa de código:** `npx tsc --noEmit` (exit 0) e `npx next lint --file <arquivos>` (sem erros). O caminho ao vivo é exercitado no preview da Vercel (branch `develop`).

---

## Task 1: Migration — tabela `bridge_token_reveals`

**Files:**
- Create: `supabase/migrations/20260711_bridge_token_reveals.sql`

**Interfaces:**
- Produces: tabela `public.bridge_token_reveals` com colunas `id uuid`, `loja_id uuid`, `tenant_id uuid`, `actor_id uuid`, `ip text`, `user_agent text`, `created_at timestamptz`. Consumida pela Task 2 via `createAdminClient().from("bridge_token_reveals").insert(...)`.

- [ ] **Step 1: Escrever o arquivo de migration**

Criar `supabase/migrations/20260711_bridge_token_reveals.sql` com exatamente:

```sql
-- Trilha de auditoria: cada revelação (reveal) de um token de Bridge de loja.
-- Populada só pelo endpoint POST /api/admin/lojas/[id]/reveal-token (fail-closed).
-- Append-only; espelha o padrão de 20260704_module_audit_log.sql.
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

-- RLS habilitada sem policy: só service_role (que bypassa RLS) lê/escreve.
-- anon/authenticated não têm acesso — mesmo padrão seguro já auditado no projeto.
ALTER TABLE public.bridge_token_reveals ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Aplicar a migration em produção via MCP**

Usar a ferramenta MCP `apply_migration`:
- `project_id`: `usokjuxnttfhffuvkhec`
- `name`: `bridge_token_reveals`
- `query`: o conteúdo SQL do Step 1.

Esperado: `{"success":true}`.

- [ ] **Step 3: Verificar RLS ligada, sem policy e colunas corretas**

Usar MCP `execute_sql` com `project_id` `usokjuxnttfhffuvkhec`:

```sql
select
  (select rowsecurity from pg_tables where schemaname='public' and tablename='bridge_token_reveals') as rls_on,
  (select count(*) from pg_policies where schemaname='public' and tablename='bridge_token_reveals') as num_policies,
  (select string_agg(column_name, ',' order by ordinal_position)
     from information_schema.columns
     where table_schema='public' and table_name='bridge_token_reveals') as cols;
```

Esperado: `rls_on = true`, `num_policies = 0`, `cols = id,loja_id,tenant_id,actor_id,ip,user_agent,created_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711_bridge_token_reveals.sql
git commit -m "feat(db): tabela de auditoria bridge_token_reveals (RLS sem policy)"
```

---

## Task 2: Helper de IP + endpoint de reveal

**Files:**
- Create: `lib/api/request-meta.ts`
- Test: `lib/api/request-meta.test.ts`
- Create: `app/api/admin/lojas/[id]/reveal-token/route.ts`

**Interfaces:**
- Consumes:
  - `getLojaAdmin(lojaId: string): Promise<{ id: string; tenantId: string; bridgeToken: string | null; ... } | null>` de `lib/db/tenants.ts` (retorna `bridgeToken` já descriptografado).
  - `isSystemAdmin(userId: string): Promise<boolean>` de `lib/db/admin.ts`.
  - `createClient()` e `createAdminClient()` de `lib/supabase/server.ts`.
  - tabela `bridge_token_reveals` da Task 1.
- Produces:
  - `clientIpFromHeaders(headers: Headers): string | null` (usado pelo endpoint).
  - Endpoint `POST /api/admin/lojas/[id]/reveal-token` → `200 { token: string }` | `401|403|404|500 { error: string }`. Consumido pela Task 3.

- [ ] **Step 1: Escrever o teste do helper (deve falhar)**

Criar `lib/api/request-meta.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clientIpFromHeaders } from "./request-meta";

describe("clientIpFromHeaders", () => {
  it("retorna o primeiro IP de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.9");
  });

  it("cai para x-real-ip quando não há x-forwarded-for", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIpFromHeaders(h)).toBe("198.51.100.7");
  });

  it("retorna null quando não há nenhum header de IP", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/api/request-meta.test.ts`
Esperado: FAIL — não resolve o módulo `./request-meta` / `clientIpFromHeaders` não existe.

- [ ] **Step 3: Implementar o helper**

Criar `lib/api/request-meta.ts`:

```ts
/**
 * Extrai o IP do cliente a partir dos headers da requisição (best-effort).
 * Prefere o primeiro endereço de x-forwarded-for; cai para x-real-ip.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  return real?.trim() || null;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/api/request-meta.test.ts`
Esperado: PASS (3 testes).

- [ ] **Step 5: Escrever o endpoint**

Criar `app/api/admin/lojas/[id]/reveal-token/route.ts`:

```ts
import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { getLojaAdmin } from "@/lib/db/tenants";
import { clientIpFromHeaders } from "@/lib/api/request-meta";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const loja = await getLojaAdmin(id);
  if (!loja || !loja.bridgeToken) {
    return NextResponse.json({ error: "Token não configurado" }, { status: 404 });
  }

  // Fail-closed: sem auditoria gravada, não revela o token.
  const supabaseAdmin = createAdminClient();
  const { error: auditError } = await supabaseAdmin
    .from("bridge_token_reveals")
    .insert({
      loja_id: loja.id,
      tenant_id: loja.tenantId,
      actor_id: user.id,
      ip: clientIpFromHeaders(req.headers),
      user_agent: req.headers.get("user-agent"),
    });

  if (auditError) {
    return NextResponse.json({ error: "Falha ao registrar auditoria" }, { status: 500 });
  }

  return NextResponse.json(
    { token: loja.bridgeToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 6: Typecheck e lint**

Run:
```bash
npx tsc --noEmit
npx next lint --file "app/api/admin/lojas/[id]/reveal-token/route.ts" --file "lib/api/request-meta.ts"
```
Esperado: `tsc` exit 0; lint "✔ No ESLint warnings or errors".

- [ ] **Step 7: Commit**

```bash
git add lib/api/request-meta.ts lib/api/request-meta.test.ts "app/api/admin/lojas/[id]/reveal-token/route.ts"
git commit -m "feat(api): endpoint admin de reveal de token de Bridge com auditoria fail-closed"
```

---

## Task 3: Botão "Revelar token atual" no form da Bridge

**Files:**
- Modify: `app/(admin)/admin/empresas/[id]/lojas/[lojaId]/bridge/bridge-form.tsx`

**Interfaces:**
- Consumes: endpoint `POST /api/admin/lojas/[id]/reveal-token` da Task 2; prop `lojaId: string` (já existe no componente); prop `loja.hasToken: boolean` (já existe); estado `token`/`setToken` e `verToken`/`setVerToken` (já existem).
- Produces: nenhuma interface para tarefas seguintes (terminal).

- [ ] **Step 1: Adicionar estado do reveal**

Em `bridge-form.tsx`, logo após a linha `const [copiado, setCopiado] = useState(false);`, inserir:

```tsx
  const [revealing, setRevealing] = useState(false);
  const [revealErro, setRevealErro] = useState("");
  const [revelado, setRevelado] = useState(false);
```

- [ ] **Step 2: Adicionar o handler de reveal**

Em `bridge-form.tsx`, logo antes da função `async function testarConexao() {`, inserir:

```tsx
  async function revelarToken() {
    setRevealing(true);
    setRevealErro("");
    try {
      const res = await fetch(`/api/admin/lojas/${lojaId}/reveal-token`, {
        method: "POST",
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (res.ok && data.token) {
        setToken(data.token);
        setVerToken(true);
        setRevelado(true);
      } else {
        setRevealErro(data.error ?? "Falha ao revelar token");
      }
    } catch {
      setRevealErro("Erro de rede ao revelar token");
    } finally {
      setRevealing(false);
    }
  }
```

- [ ] **Step 3: Adicionar o botão e o aviso abaixo do texto de ajuda do token**

Em `bridge-form.tsx`, localizar o parágrafo de ajuda do campo de token:

```tsx
        <p className="text-xs text-slate-400 mt-0.5">
          Armazenado criptografado (AES-256-GCM). Deixe em branco para manter o token atual.
        </p>
```

Inserir, **imediatamente depois** desse `</p>`, o bloco:

```tsx
        {loja.hasToken && !token && (
          <button
            type="button"
            onClick={revelarToken}
            disabled={revealing}
            className="mt-2 inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {revealing ? "Revelando..." : "Revelar token atual"}
          </button>
        )}
        {revelado && (
          <p className="text-xs text-amber-600 mt-1.5">
            Token revelado — este acesso foi registrado.
          </p>
        )}
        {revealErro && (
          <p className="text-xs text-red-600 mt-1.5">{revealErro}</p>
        )}
```

- [ ] **Step 4: Typecheck e lint**

Run:
```bash
npx tsc --noEmit
npx next lint --file "app/(admin)/admin/empresas/[id]/lojas/[lojaId]/bridge/bridge-form.tsx"
```
Esperado: `tsc` exit 0; lint "✔ No ESLint warnings or errors". (`Loader2` e `Eye` já estão importados no arquivo.)

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/empresas/[id]/lojas/[lojaId]/bridge/bridge-form.tsx"
git commit -m "feat(admin): botão Revelar token atual no form da Bridge"
```

---

## Verificação de integração (após as 3 tarefas, no preview)

Não há como exercitar o caminho autenticado localmente. Após merge na `develop` (preview Vercel):

1. Como **system admin**, abrir a página de Bridge de uma loja **já configurada** → clicar "Revelar token atual" → o campo é preenchido, 👁 e **Copiar** funcionam, aparece o aviso "este acesso foi registrado".
2. Confirmar o registro via MCP `execute_sql` (`project_id` `usokjuxnttfhffuvkhec`):
   ```sql
   select actor_id, loja_id, tenant_id, ip, user_agent, created_at
   from public.bridge_token_reveals order by created_at desc limit 5;
   ```
   Esperado: uma linha nova com o `actor_id` do admin e o `loja_id` correto.
3. Loja **sem token** → clicar não aplicável (botão só aparece com `hasToken`); chamada direta ao endpoint retorna 404 sem gravar linha.
4. Usuário **não-admin** (ou suporte) chamando o endpoint → 403, sem linha de auditoria.

## Self-review (feito)

- **Cobertura do spec:** migration (Task 1) ✓; autorização admin-only + fail-closed + no-store + ip/ua (Task 2) ✓; UI de reveal restaurando copiar/olho (Task 3) ✓; verificação preview + MCP ✓. Itens "fora de escopo" do spec permanecem fora.
- **Placeholders:** nenhum — todo código é literal.
- **Consistência de tipos:** `clientIpFromHeaders(headers: Headers)` definido na Task 2 Step 3 e usado no endpoint Step 5 com a mesma assinatura; `getLojaAdmin` retorna `{ id, tenantId, bridgeToken }` conforme `lib/db/tenants.ts:195-228`; props `lojaId`/`loja.hasToken`/`setToken`/`setVerToken` já existentes em `bridge-form.tsx`.

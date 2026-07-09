# Gestão de Módulos — Plano 1: Fundação (schema + motor de resolução) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema de banco e o motor de resolução de acesso (`resolveEffectiveFeatures` + kill-switch) que sustentam a feature de Gestão de Módulos, sem construir nenhuma tela ainda.

**Architecture:** Cinco tabelas novas no Supabase (`module_settings`, `kill_switch_revocations`, `module_audit_log`, `tenant_module_access_stats`, `module_change_requests`). Uma função pura `resolveEffectiveFeatures()` extraída da lógica já existente em `app/(dashboard)/layout.tsx`, testada com Vitest. Kill-switch aplicado como camada extra em `EmpresaContext.hasFeature` (client dashboard) e em `checkPlan` (`lib/api/plan-guard.ts`, guarda de API). Uma camada de dados nova (`lib/db/modules.ts`) expõe leitura/escrita de `module_settings` para os planos seguintes (telas admin) consumirem.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), Vitest (novo, só para lógica pura).

## Global Constraints

- Path alias do projeto: `@/*` mapeia para a raiz (`tsconfig.json`). Sempre importar como `@/lib/...`, nunca caminho relativo `../../`.
- Toda função de acesso a dados usa `createAdminClient()` de `@/lib/supabase/server` (bypassa RLS) — é o padrão de `lib/db/admin.ts`. Nas rotas de API (`lib/api/plan-guard.ts`, `lib/api/tenant-guard.ts`) o padrão é diferente: `createClient as createAdminClient` do pacote `@supabase/supabase-js` puro, construído inline via `makeAdminClient()`. Seguir o padrão já usado no arquivo que está sendo modificado, não misturar os dois.
- Erros do Supabase sempre verificados com `if (error) throw new Error(error.message)` (ou mensagem customizada `` `Erro ao X: ${error.message}` ``).
- Migrations deste projeto não usam Supabase CLI linkado (não há `supabase/config.toml`) — o fluxo é criar o arquivo `.sql` em `supabase/migrations/` com prefixo `YYYYMMDD_` e rodar o conteúdo manualmente no SQL Editor do Supabase Dashboard. Cada task de migration abaixo termina com esse passo manual.
- Migrations recentes deste projeto (ex. `20260701_tenant_groups.sql`) não usam RLS/policies — seguir essa mesma convenção nas tabelas novas (todo acesso é server-side via service role de qualquer forma).
- Não modificar `lib/features.ts` nem `tenant_features` neste plano — o catálogo de módulos continua em código, só a camada de overlay é nova.

---

### Task 1: Instalar e configurar Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: comando `npm test` executando `vitest run`.

- [ ] **Step 1: Instalar vitest como devDependency**

Run: `npm install -D vitest`

Expected: `package.json` ganha uma entrada `"vitest": "^4.x.x"` em `devDependencies`, `package-lock.json` atualizado.

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
```

- [ ] **Step 3: Adicionar script `test` no `package.json`**

No bloco `"scripts"` de `package.json`, adicionar a linha `"test": "vitest run",` (mantendo `dev`, `build`, `start`, `lint` já existentes).

- [ ] **Step 4: Confirmar que o comando roda (sem nenhum teste ainda)**

Run: `npm test`
Expected: saída do Vitest tipo `No test files found` (ainda sem arquivos `*.test.ts`) — confirma que o binário e o config estão corretos, sem erro de configuração.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing pure logic"
```

---

### Task 2: Migration — `module_settings`

**Files:**
- Create: `supabase/migrations/20260704_module_settings.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Overlay editável por módulo: kill-switch global, cor de destaque, overrides de
-- texto e modelo comercial. Ausência de linha para um feature_key = usar os
-- valores padrão do catálogo em lib/features.ts (kill-switch desligado, sem cor
-- customizada, incluso conforme plano).
CREATE TABLE IF NOT EXISTS module_settings (
  feature_key         text        PRIMARY KEY,
  kill_switch_enabled boolean     NOT NULL DEFAULT false,
  accent_color        text,
  label_override      text,
  descricao_override  text,
  pricing_model       text        NOT NULL DEFAULT 'incluso_free'
                        CHECK (pricing_model IN ('incluso_free', 'incluso_premium', 'avulso')),
  preco_avulso        numeric,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);
```

- [ ] **Step 2: Rodar a migration no Supabase**

Copiar o conteúdo do arquivo e executar no SQL Editor do Supabase Dashboard do projeto. Confirmar que a tabela aparece em Table Editor com as 9 colunas listadas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_module_settings.sql
git commit -m "feat(db): add module_settings table for module overlay config"
```

---

### Task 3: Migration — `kill_switch_revocations`

**Files:**
- Create: `supabase/migrations/20260704_kill_switch_revocations.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Snapshot de quais empresas tinham um módulo ativo no momento em que o
-- kill-switch foi ligado. Serve como log/auditoria do evento — a fonte de
-- verdade do restore continua sendo tenant_features, que nunca é apagada
-- pelo kill-switch.
CREATE TABLE IF NOT EXISTS kill_switch_revocations (
  feature_key text        NOT NULL,
  tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  revoked_at  timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  PRIMARY KEY (feature_key, tenant_id, revoked_at)
);

CREATE INDEX IF NOT EXISTS kill_switch_revocations_feature_idx
  ON kill_switch_revocations(feature_key);
```

- [ ] **Step 2: Rodar a migration no Supabase**

Executar no SQL Editor. Confirmar tabela criada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_kill_switch_revocations.sql
git commit -m "feat(db): add kill_switch_revocations table"
```

---

### Task 4: Migration — `module_audit_log`

**Files:**
- Create: `supabase/migrations/20260704_module_audit_log.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Histórico de ações administrativas por módulo (kill-switch, cor, acesso,
-- preço). Populada automaticamente pelo código, nunca por input manual do
-- usuário final.
CREATE TABLE IF NOT EXISTS module_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text        NOT NULL,
  event_type  text        NOT NULL
                CHECK (event_type IN (
                  'kill_switch_on', 'kill_switch_off',
                  'cor_alterada', 'acesso_empresa_alterado', 'preco_alterado'
                )),
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  detalhes    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_audit_log_feature_idx
  ON module_audit_log(feature_key, created_at DESC);
```

- [ ] **Step 2: Rodar a migration no Supabase**

Executar no SQL Editor. Confirmar tabela criada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_module_audit_log.sql
git commit -m "feat(db): add module_audit_log table"
```

---

### Task 5: Migration — `tenant_module_access_stats`

**Files:**
- Create: `supabase/migrations/20260704_tenant_module_access_stats.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Estatísticas de acesso por módulo (para "módulos mais acessados"),
-- análogo a tenant_access_stats mas com granularidade de feature_key.
CREATE TABLE IF NOT EXISTS tenant_module_access_stats (
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key    text        NOT NULL,
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  total_accesses bigint      NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_module_access_stats_feature_idx
  ON tenant_module_access_stats(feature_key, total_accesses DESC);
```

- [ ] **Step 2: Rodar a migration no Supabase**

Executar no SQL Editor. Confirmar tabela criada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_tenant_module_access_stats.sql
git commit -m "feat(db): add tenant_module_access_stats table"
```

---

### Task 6: Migration — `module_change_requests`

**Files:**
- Create: `supabase/migrations/20260704_module_change_requests.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Backlog interno de solicitações de alteração por módulo. tenant_id é
-- opcional e só informativo (não filtra nem restringe nada).
CREATE TABLE IF NOT EXISTS module_change_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text        NOT NULL,
  tenant_id   uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  titulo      text        NOT NULL,
  descricao   text,
  status      text        NOT NULL DEFAULT 'aberto'
                CHECK (status IN ('aberto', 'em_andamento', 'concluido')),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_change_requests_feature_idx
  ON module_change_requests(feature_key, status);
```

- [ ] **Step 2: Rodar a migration no Supabase**

Executar no SQL Editor. Confirmar tabela criada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_module_change_requests.sql
git commit -m "feat(db): add module_change_requests table"
```

---

### Task 7: `resolveEffectiveFeatures()` — motor de resolução puro (TDD)

**Files:**
- Create: `lib/access/resolve-modules.ts`
- Test: `lib/access/resolve-modules.test.ts`

**Interfaces:**
- Produces: `resolveEffectiveFeatures(input: ResolveEffectiveFeaturesInput): string[] | undefined` e o tipo `ResolveEffectiveFeaturesInput`. Consumido pela Task 9.

Esta função extrai, sem alterar o comportamento, a cascata que já existe em `app/(dashboard)/layout.tsx:111-134` (tenant → grupo → usuário). O kill-switch **não** entra aqui — ver Task 9 para o motivo (precisa valer também quando esta função retorna `undefined`).

- [ ] **Step 1: Escrever os testes (devem falhar — o módulo ainda não existe)**

```typescript
// lib/access/resolve-modules.test.ts
import { describe, it, expect } from "vitest";
import { resolveEffectiveFeatures } from "./resolve-modules";

describe("resolveEffectiveFeatures", () => {
  it("retorna undefined quando o tenant não tem nenhuma feature (fallback de plano)", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: [],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: null,
    });
    expect(result).toBeUndefined();
  });

  it("owner ou admin global vê todas as features do tenant", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos"],
      isOwnerOrAdmin: true,
      groupModulos: { modulo_financeiro: false },
      userModulos: { modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro", "modulo_produtos"]);
  });

  it("aplica interseção tenant ∩ grupo quando o usuário pertence a um grupo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: { modulo_financeiro: true, modulo_produtos: false },
      userModulos: null,
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("aplica interseção tenant ∩ grupo ∩ usuário quando ambos existem", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: { modulo_financeiro: true, modulo_produtos: true },
      userModulos: { modulo_financeiro: true, modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("aplica interseção tenant ∩ usuário quando não há grupo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_produtos"],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: { modulo_financeiro: true, modulo_produtos: false },
    });
    expect(result).toEqual(["modulo_financeiro"]);
  });

  it("sem grupo e sem restrição individual, usa o default mínimo (visão geral + vendas)", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_vendas", "dashboard_visao_geral"],
      isOwnerOrAdmin: false,
      groupModulos: null,
      userModulos: null,
    });
    expect(result).toEqual(["modulo_vendas", "dashboard_visao_geral"]);
  });

  it("grupo com objeto vazio ({}) é tratado como 'sem grupo', caindo no default mínimo", () => {
    const result = resolveEffectiveFeatures({
      allTenantFeatures: ["modulo_financeiro", "modulo_vendas"],
      isOwnerOrAdmin: false,
      groupModulos: {},
      userModulos: null,
    });
    expect(result).toEqual(["modulo_vendas"]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Cannot find module './resolve-modules'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar `resolveEffectiveFeatures`**

```typescript
// lib/access/resolve-modules.ts

export type ResolveEffectiveFeaturesInput = {
  allTenantFeatures: string[];
  isOwnerOrAdmin: boolean;
  groupModulos: Record<string, boolean> | null;
  userModulos: Record<string, boolean> | null;
};

/**
 * Cascata tenant -> grupo -> usuario, cada camada so restringe, nunca
 * concede de volta o que a camada de cima negou. Kill-switch global NAO
 * entra aqui - e aplicado por fora (EmpresaContext.hasFeature, checkPlan),
 * pois precisa valer tambem quando esta funcao retorna undefined
 * (fallback para o plano do tenant).
 */
export function resolveEffectiveFeatures(
  input: ResolveEffectiveFeaturesInput
): string[] | undefined {
  const { allTenantFeatures, isOwnerOrAdmin, groupModulos, userModulos } = input;

  if (allTenantFeatures.length === 0) {
    return undefined;
  }

  if (isOwnerOrAdmin) {
    return allTenantFeatures;
  }

  if (groupModulos && Object.keys(groupModulos).length > 0) {
    const groupFeatures = allTenantFeatures.filter((k) => groupModulos[k] === true);
    if (userModulos && Object.keys(userModulos).length > 0) {
      return groupFeatures.filter((k) => userModulos[k] === true);
    }
    return groupFeatures;
  }

  if (userModulos && Object.keys(userModulos).length > 0) {
    return allTenantFeatures.filter((k) => userModulos[k] === true);
  }

  return allTenantFeatures.filter(
    (k) => k === "dashboard_visao_geral" || k === "modulo_vendas"
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — 7 testes, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add lib/access/resolve-modules.ts lib/access/resolve-modules.test.ts
git commit -m "feat: extract resolveEffectiveFeatures as pure, tested function"
```

---

### Task 8: `lib/db/modules.ts` — camada de dados de `module_settings`

**Files:**
- Create: `lib/db/modules.ts`

**Interfaces:**
- Consumes: `createAdminClient` de `@/lib/supabase/server` (assinatura: `createAdminClient(): SupabaseClient`, ver `lib/supabase/server.ts:7-18`).
- Produces: `getKilledFeatureKeys(): Promise<string[]>`, `getModuleSettings(featureKey: string): Promise<ModuleSettings | null>`, `getAllModuleSettings(): Promise<Record<string, ModuleSettings>>`, `countTenantsWithFeature(featureKey: string): Promise<number>`, `setKillSwitch(featureKey: string, enabled: boolean, actorId: string): Promise<{ affectedTenantIds: string[] }>`, tipo `ModuleSettings`. Todas serão consumidas pelos Planos 2-4 (telas admin).

Sem teste automatizado aqui — são wrappers finos de chamadas Supabase (mesmo padrão de `lib/db/admin.ts`, que também não tem testes). Validação é manual, via Task 11.

- [ ] **Step 1: Implementar `lib/db/modules.ts`**

```typescript
// Camada de dados para o overlay administrativo de módulos (module_settings
// e tabelas relacionadas de kill-switch/auditoria).

import { createAdminClient } from "@/lib/supabase/server";

export type ModuleSettings = {
  featureKey: string;
  killSwitchEnabled: boolean;
  accentColor: string | null;
  labelOverride: string | null;
  descricaoOverride: string | null;
  pricingModel: "incluso_free" | "incluso_premium" | "avulso";
  precoAvulso: number | null;
  updatedAt: string;
  updatedBy: string | null;
};

type ModuleSettingsRow = {
  feature_key: string;
  kill_switch_enabled: boolean;
  accent_color: string | null;
  label_override: string | null;
  descricao_override: string | null;
  pricing_model: string;
  preco_avulso: number | null;
  updated_at: string;
  updated_by: string | null;
};

function mapRow(row: ModuleSettingsRow): ModuleSettings {
  return {
    featureKey: row.feature_key,
    killSwitchEnabled: row.kill_switch_enabled,
    accentColor: row.accent_color,
    labelOverride: row.label_override,
    descricaoOverride: row.descricao_override,
    pricingModel: row.pricing_model as ModuleSettings["pricingModel"],
    precoAvulso: row.preco_avulso,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Keys de módulos com kill-switch ligado agora. */
export async function getKilledFeatureKeys(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select("feature_key")
    .eq("kill_switch_enabled", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { feature_key: string }[]).map((r) => r.feature_key);
}

/** Configuração de overlay de um módulo específico, ou null se nunca foi configurado. */
export async function getModuleSettings(featureKey: string): Promise<ModuleSettings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select(
      "feature_key, kill_switch_enabled, accent_color, label_override, descricao_override, pricing_model, preco_avulso, updated_at, updated_by"
    )
    .eq("feature_key", featureKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as ModuleSettingsRow) : null;
}

/** Todas as configurações de overlay existentes, indexadas por feature_key. */
export async function getAllModuleSettings(): Promise<Record<string, ModuleSettings>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select(
      "feature_key, kill_switch_enabled, accent_color, label_override, descricao_override, pricing_model, preco_avulso, updated_at, updated_by"
    );
  if (error) throw new Error(error.message);
  const result: Record<string, ModuleSettings> = {};
  for (const row of (data ?? []) as ModuleSettingsRow[]) {
    result[row.feature_key] = mapRow(row);
  }
  return result;
}

/** Quantas empresas têm essa feature ativa hoje em tenant_features (para o modal de confirmação do kill-switch). */
export async function countTenantsWithFeature(featureKey: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("tenant_features")
    .select("tenant_id", { count: "exact", head: true })
    .eq("feature_key", featureKey);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Liga/desliga o kill-switch de um módulo. Ao ligar, grava snapshot das
 * empresas afetadas em kill_switch_revocations (log/auditoria — a fonte de
 * verdade do restore continua sendo tenant_features, nunca apagada aqui).
 * Sempre registra o evento em module_audit_log.
 */
export async function setKillSwitch(
  featureKey: string,
  enabled: boolean,
  actorId: string
): Promise<{ affectedTenantIds: string[] }> {
  const supabase = createAdminClient();
  let affectedTenantIds: string[] = [];

  if (enabled) {
    const { data: tenantsWithFeature, error: tErr } = await supabase
      .from("tenant_features")
      .select("tenant_id")
      .eq("feature_key", featureKey);
    if (tErr) throw new Error(tErr.message);
    affectedTenantIds = ((tenantsWithFeature ?? []) as { tenant_id: string }[]).map(
      (r) => r.tenant_id
    );

    if (affectedTenantIds.length > 0) {
      const { error: revError } = await supabase.from("kill_switch_revocations").insert(
        affectedTenantIds.map((tenantId) => ({ feature_key: featureKey, tenant_id: tenantId }))
      );
      if (revError) throw new Error(revError.message);
    }
  }

  const { error: upsertError } = await supabase.from("module_settings").upsert(
    {
      feature_key: featureKey,
      kill_switch_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: "feature_key" }
  );
  if (upsertError) throw new Error(`Erro ao atualizar kill-switch: ${upsertError.message}`);

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: enabled ? "kill_switch_on" : "kill_switch_off",
    actor_id: actorId,
    detalhes: { affected_tenant_count: affectedTenantIds.length },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);

  return { affectedTenantIds };
}
```

- [ ] **Step 2: Verificar que compila sem erros de tipo**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `lib/db/modules.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/db/modules.ts
git commit -m "feat(db): add data access layer for module_settings overlay"
```

---

### Task 9: Integrar `resolveEffectiveFeatures` + kill-switch no dashboard do cliente

**Files:**
- Modify: `app/(dashboard)/layout.tsx:1-134` (import + query + cálculo de `effectiveFeatures`)
- Modify: `lib/contexts/empresa-context.tsx` (prop `killedFeatureKeys`, lógica de `hasFeature`)

**Interfaces:**
- Consumes: `resolveEffectiveFeatures` (Task 7), `getKilledFeatureKeys` não é usado diretamente aqui (a query já está inline no layout, ver Step 1) — **nota**: para não duplicar acesso ao Supabase, o layout já tem um `adminClient` local; a query de killed features é feita diretamente nele, sem chamar `lib/db/modules.ts` (que é reservado para as telas admin que ainda não existem).

- [ ] **Step 1: Adicionar a query de módulos com kill-switch ligado, em `app/(dashboard)/layout.tsx`**

No topo do arquivo, adicionar o import (linha 12, junto aos outros):

```typescript
import { resolveEffectiveFeatures } from "@/lib/access/resolve-modules";
```

Substituir o array de `Promise.all` (linhas 31-77) para incluir a 7ª query. De:

```typescript
  const [profileRes, tenantAccessRes, empresaRes, featuresRes, userSettingsRes, tenantCountRes] = await Promise.all([
```

Para:

```typescript
  const [profileRes, tenantAccessRes, empresaRes, featuresRes, userSettingsRes, tenantCountRes, killedRes] = await Promise.all([
```

E adicionar como último elemento do array (depois da query de `tenantCountRes`, antes do fechamento `]);` da linha 77):

```typescript
    // Módulos com kill-switch ligado globalmente (afeta todos os tenants)
    adminClient
      .from("module_settings")
      .select("feature_key")
      .eq("kill_switch_enabled", true),
```

- [ ] **Step 2: Calcular `killedFeatureKeys` e substituir o bloco de resolução manual (linhas 111-134)**

Adicionar logo após a linha que declara `groupModulos` (depois do bloco `if (groupId && selectedTenantId) { ... }`, por volta da linha 109):

```typescript
  const killedFeatureKeys = ((killedRes.data ?? []) as { feature_key: string }[]).map(
    (r) => r.feature_key
  );
```

Substituir todo o bloco atual (linhas 111-134, do comentário `// Resolução de permissões em 3 níveis...` até o `}` que fecha o último `else`) por:

```typescript
  const effectiveFeatures = resolveEffectiveFeatures({
    allTenantFeatures,
    isOwnerOrAdmin: isAdmin || effectiveRole === "owner",
    groupModulos,
    userModulos,
  });
```

- [ ] **Step 3: Passar `killedFeatureKeys` para `EmpresaProvider`**

Na linha 155-161, alterar de:

```tsx
    <EmpresaProvider
      empresaId={selectedTenantId ?? ""}
      empresaNome={empresaData?.name ?? ""}
      plan={plan}
      userRole={isAdmin ? "owner" : userRole}
      features={effectiveFeatures}
    >
```

Para:

```tsx
    <EmpresaProvider
      empresaId={selectedTenantId ?? ""}
      empresaNome={empresaData?.name ?? ""}
      plan={plan}
      userRole={isAdmin ? "owner" : userRole}
      features={effectiveFeatures}
      killedFeatureKeys={killedFeatureKeys}
    >
```

- [ ] **Step 4: Atualizar `EmpresaProvider`/`hasFeature` em `lib/contexts/empresa-context.tsx`**

Substituir o arquivo inteiro por:

```typescript
"use client";

import { createContext, useContext } from "react";
import type { Plan, UserRole } from "@/lib/plans";
import { planHasFeature, roleCanEdit, roleCanManageUsers } from "@/lib/plans";

export type EmpresaContextValue = {
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  /** Verifica se a feature está disponível (considera kill-switch global) */
  hasFeature:  (key: string) => boolean;
  /** Usuário pode editar configurações */
  canEdit:     boolean;
  /** Usuário pode gerenciar outros usuários */
  canManageUsers: boolean;
};

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({
  children,
  empresaId,
  empresaNome,
  plan,
  userRole,
  features,
  killedFeatureKeys,
}: {
  children:    React.ReactNode;
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  features?:   string[];
  killedFeatureKeys?: string[];
}) {
  const killedSet = new Set(killedFeatureKeys ?? []);

  const value: EmpresaContextValue = {
    empresaId,
    empresaNome,
    plan,
    userRole,
    hasFeature: (key) => {
      if (killedSet.has(key)) return false;
      return features ? features.includes(key) : planHasFeature(plan, key);
    },
    canEdit:        roleCanEdit(userRole),
    canManageUsers: roleCanManageUsers(userRole),
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa precisa estar dentro de EmpresaProvider");
  return ctx;
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo em `app/(dashboard)/layout.tsx` nem `lib/contexts/empresa-context.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx" lib/contexts/empresa-context.tsx
git commit -m "feat: wire resolveEffectiveFeatures and kill-switch into client dashboard"
```

---

### Task 10: Bloquear módulos com kill-switch nas rotas de API

**Files:**
- Modify: `lib/api/plan-guard.ts:13-31` (função `checkPlan`)

**Interfaces:**
- Consumes: tabela `module_settings` (mesmo padrão de `makeAdminClient()` já usado no arquivo).
- Produces: `checkPlan` agora também retorna 403 quando o módulo está com kill-switch ligado, antes de checar o plano.

- [ ] **Step 1: Atualizar `checkPlan`**

Substituir a função (linhas 13-31) por:

```typescript
async function checkPlan(tenantId: string, featureKey: string): Promise<NextResponse | null> {
  const admin = makeAdminClient();

  const [{ data: tenant }, { data: moduleSetting }] = await Promise.all([
    admin.from("tenants").select("plan").eq("id", tenantId).maybeSingle(),
    admin
      .from("module_settings")
      .select("kill_switch_enabled")
      .eq("feature_key", featureKey)
      .maybeSingle(),
  ]);

  if ((moduleSetting as { kill_switch_enabled?: boolean } | null)?.kill_switch_enabled === true) {
    return NextResponse.json(
      { error: "Módulo temporariamente indisponível", feature: featureKey },
      { status: 403 }
    );
  }

  const plan = (tenant as { plan?: string } | null)?.plan ?? "free";

  if (!planHasFeature(plan as "free" | "premium", featureKey)) {
    return NextResponse.json(
      { error: "Módulo não disponível no plano atual", feature: featureKey, plan },
      { status: 403 }
    );
  }

  return null;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/api/plan-guard.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/api/plan-guard.ts
git commit -m "feat(api): block API access to modules with global kill-switch enabled"
```

---

### Task 11: Verificação manual end-to-end

Sem UI ainda (isso vem no Plano 2) — a verificação aqui é via SQL direto + dev server, para confirmar que a fundação funciona antes de construir telas em cima dela.

- [ ] **Step 1: Rodar toda a suíte de testes uma última vez**

Run: `npm test`
Expected: todos os testes de `lib/access/resolve-modules.test.ts` passando.

- [ ] **Step 2: Rodar o type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Subir o dev server e confirmar comportamento padrão (sem kill-switch)**

Run: `npm run dev`

Logar como um usuário de uma empresa com `modulo_financeiro` em `tenant_features`. Confirmar que o item "Financeiro" aparece no menu lateral normalmente (comportamento inalterado).

- [ ] **Step 4: Ligar o kill-switch manualmente via SQL e confirmar que o módulo some**

No SQL Editor do Supabase:

```sql
insert into module_settings (feature_key, kill_switch_enabled, updated_by)
values ('modulo_financeiro', true, null)
on conflict (feature_key) do update set kill_switch_enabled = true;
```

Recarregar o dashboard do mesmo usuário (sem fazer logout — precisa de novo request ao server component). Confirmar que "Financeiro" **desaparece completamente** do menu lateral (não aparece desabilitado).

Chamar diretamente uma rota de API que use `requireFeature("modulo_financeiro")` (ex. `/api/dashboard/financeiro/overview`) autenticado como esse mesmo usuário. Confirmar resposta `403` com `{ error: "Módulo temporariamente indisponível", feature: "modulo_financeiro" }`.

- [ ] **Step 5: Desligar o kill-switch e confirmar que o módulo volta**

```sql
update module_settings set kill_switch_enabled = false where feature_key = 'modulo_financeiro';
```

Recarregar o dashboard. Confirmar que "Financeiro" volta a aparecer, sem precisar reconfigurar `tenant_features` (prova de que a contratação da empresa não foi apagada em nenhum momento).

- [ ] **Step 6: Confirmar que o log de auditoria foi populado**

```sql
select * from module_audit_log where feature_key = 'modulo_financeiro' order by created_at desc;
```

Expected: pelo menos as linhas do passo manual acima não aparecem (foram feitas via SQL direto, não via `setKillSwitch()`) — isso é esperado, já que `module_audit_log` só é populado quando a função `setKillSwitch()` (Task 8) é chamada pelo código, e ela ainda não tem nenhuma tela que a chame (isso vem no Plano 2). Este passo serve só para confirmar que a tabela existe e está vazia/acessível, não para validar populamento (que será testado no Plano 2, quando a UI do kill-switch existir).

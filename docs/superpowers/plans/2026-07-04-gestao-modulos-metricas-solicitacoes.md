# Gestão de Módulos — Plano 3: Métricas, Solicitações e Histórico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar as 3 abas restantes da tela de detalhe do módulo — Métricas (empresas que mais acessam), Solicitações (backlog de pedidos de alteração) e Histórico (log de auditoria) — e ligar o rastreamento real de acesso por módulo que ainda não existia (as tabelas já existem desde o Plano 1, mas nada gravava nelas).

**Architecture:** Uma função Postgres nova (`track_module_access`, mesmo padrão de `track_tenant_access` já existente) chamada a partir de `lib/api/plan-guard.ts` (que já recebe o `featureKey` em toda chamada e hoje descarta essa informação). Três funções de leitura/escrita novas em `lib/db/modules.ts`. Dois Server Actions novos em `lib/actions/admin-modulos.ts`. Três componentes novos (`ModuloMetricasTab`, `ModuloHistoricoTab` — ambos Server Components simples, sem interatividade; `ModuloSolicitacoesForm` — Client Component com formulário e mudança de status). A tela de detalhe (`/admin/modulos/[key]`) ganha as 3 abas novas na sequência.

## Global Constraints

- Path alias `@/*` mapeia para a raiz.
- Painel admin usa tokens CSS `--adm-*` via `style={{...}}` inline — seguir esse padrão em todo componente novo.
- Toda função de acesso a dados usa `createAdminClient()` de `@/lib/supabase/server`, chamado fresh a cada função. Erros do Supabase sempre verificados com `if (error) throw new Error(...)`.
- Server Actions de admin (`lib/actions/admin-modulos.ts`) sempre chamam a verificação de admin antes de mutar e terminam com `revalidatePath(...)`. O arquivo já tem `"use server"` no topo — não adicionar diretivas por função.
- Padrão de tracking já existente no projeto (`lib/api/tenant-guard.ts`, `scripts/setup-access-tracking.sql`): função Postgres `SECURITY DEFINER` com upsert atômico (`on conflict ... do update set total_accesses = tabela.total_accesses + 1`), chamada via `.rpc(...)`, com throttle de 60s em memória (`Map<string, number>`) para não gravar a cada requisição.
- Módulos com `disponivel: false` continuam sem rota de detalhe (já garantido desde o Plano 2 — não mexer nisso aqui).
- `module_change_requests.tenant_id` é sempre opcional e apenas informativo — nunca usado para filtrar ou restringir nada.
- Migrations deste projeto rodam manualmente no SQL Editor do Supabase Dashboard (sem CLI linkado) — cada task de migration termina com esse passo manual.

---

### Task 1: Migration — função `track_module_access`

**Files:**
- Create: `supabase/migrations/20260704_track_module_access_function.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Upsert atômico com contador para tenant_module_access_stats, mesmo padrão
-- de track_tenant_access (scripts/setup-access-tracking.sql) — SECURITY
-- DEFINER para permitir o incremento atômico via RPC a partir da API.
create or replace function public.track_module_access(
  p_tenant_id   uuid,
  p_feature_key text
) returns void language plpgsql security definer as $$
begin
  insert into public.tenant_module_access_stats
    (tenant_id, feature_key, last_seen_at, total_accesses)
  values
    (p_tenant_id, p_feature_key, now(), 1)
  on conflict (tenant_id, feature_key) do update set
    last_seen_at   = now(),
    total_accesses = public.tenant_module_access_stats.total_accesses + 1;
end;
$$;
```

- [ ] **Step 2: Rodar a migration no Supabase**

Copiar o conteúdo do arquivo e executar no SQL Editor do Supabase Dashboard do projeto. Confirmar que a função aparece em Database → Functions.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704_track_module_access_function.sql
git commit -m "feat(db): add track_module_access RPC function"
```

---

### Task 2: Ligar o rastreamento de acesso em `lib/api/plan-guard.ts`

**Files:**
- Modify: `lib/api/plan-guard.ts`

**Interfaces:**
- Produces: toda chamada bem-sucedida a `requireFeature`/`requireFeatureWithLojas` passa a registrar 1 acesso em `tenant_module_access_stats` via RPC, com throttle de 60s por `(tenantId, featureKey)`.

- [ ] **Step 1: Adicionar o cache de throttle e a função de tracking, logo após `makeAdminClient` (linha 11)**

De:

```typescript
function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkPlan(tenantId: string, featureKey: string): Promise<NextResponse | null> {
```

Para:

```typescript
function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Throttle: evita gravar no banco mais de 1x por minuto por tenant+módulo
const _moduleAccessCache = new Map<string, number>();

/** Registra 1 acesso ao módulo (para "módulos mais acessados"), com throttle de 60s. */
async function trackModuleAccess(tenantId: string, featureKey: string): Promise<void> {
  const cacheKey = `${tenantId}:${featureKey}`;
  if (Date.now() - (_moduleAccessCache.get(cacheKey) ?? 0) <= 60_000) return;
  _moduleAccessCache.set(cacheKey, Date.now());
  const admin = makeAdminClient();
  try {
    await admin.rpc("track_module_access", { p_tenant_id: tenantId, p_feature_key: featureKey });
  } catch (e) {
    console.error("[module-access-tracking] falha ao registrar acesso:", e);
  }
}

async function checkPlan(tenantId: string, featureKey: string): Promise<NextResponse | null> {
```

- [ ] **Step 2: Chamar `trackModuleAccess` nos dois pontos de sucesso de `requireFeature`**

De:

```typescript
export async function requireFeature(featureKey: string): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) return null;
  return checkPlan(ctx.tenantId, featureKey);
}
```

Para:

```typescript
export async function requireFeature(featureKey: string): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) {
    await trackModuleAccess(ctx.tenantId, featureKey);
    return null;
  }
  const blocked = await checkPlan(ctx.tenantId, featureKey);
  if (blocked) return blocked;
  await trackModuleAccess(ctx.tenantId, featureKey);
  return null;
}
```

- [ ] **Step 3: Chamar `trackModuleAccess` nos dois pontos de sucesso de `requireFeatureWithLojas`**

De:

```typescript
export async function requireFeatureWithLojas(
  featureKey: string,
  lojaIds: string[]
): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess(lojaIds);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) return null;
  return checkPlan(ctx.tenantId, featureKey);
}
```

Para:

```typescript
export async function requireFeatureWithLojas(
  featureKey: string,
  lojaIds: string[]
): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess(lojaIds);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) {
    await trackModuleAccess(ctx.tenantId, featureKey);
    return null;
  }
  const blocked = await checkPlan(ctx.tenantId, featureKey);
  if (blocked) return blocked;
  await trackModuleAccess(ctx.tenantId, featureKey);
  return null;
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/api/plan-guard.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/api/plan-guard.ts
git commit -m "feat: track module access on every successful requireFeature call"
```

---

### Task 3: Estender `lib/db/modules.ts` — métricas, solicitações e histórico

**Files:**
- Modify: `lib/db/modules.ts` (adicionar ao final do arquivo)

**Interfaces:**
- Produces: `getModuleAccessRanking(featureKey: string): Promise<ModuleAccessRankingItem[]>`, `listChangeRequests(featureKey: string): Promise<ModuleChangeRequest[]>`, `createChangeRequest(featureKey: string, input: { titulo: string; descricao: string | null; tenantId: string | null }, actorId: string): Promise<void>`, `updateChangeRequestStatus(id: string, status: "aberto" | "em_andamento" | "concluido"): Promise<void>`, `listModuleAuditLog(featureKey: string): Promise<ModuleAuditLogEntry[]>`, e os tipos `ModuleAccessRankingItem`, `ModuleChangeRequest`, `ModuleAuditLogEntry`. Consumidos pelas Tasks 4-7.

- [ ] **Step 1: Adicionar ao final do arquivo**

```typescript
export type ModuleAccessRankingItem = {
  tenantId: string;
  tenantName: string;
  totalAccesses: number;
  lastSeenAt: string;
};

/** Ranking de empresas por acessos a um módulo, mais acessado primeiro (aba Métricas). */
export async function getModuleAccessRanking(
  featureKey: string
): Promise<ModuleAccessRankingItem[]> {
  const supabase = createAdminClient();

  const { data: stats, error: statsErr } = await supabase
    .from("tenant_module_access_stats")
    .select("tenant_id, total_accesses, last_seen_at")
    .eq("feature_key", featureKey)
    .order("total_accesses", { ascending: false });
  if (statsErr) throw new Error(statsErr.message);

  const rows = (stats ?? []) as { tenant_id: string; total_accesses: number; last_seen_at: string }[];
  if (rows.length === 0) return [];

  const tenantIds = rows.map((r) => r.tenant_id);
  const { data: tenantsData, error: tenantsErr } = await supabase
    .from("tenants")
    .select("id, name")
    .in("id", tenantIds);
  if (tenantsErr) throw new Error(tenantsErr.message);

  const nameById = new Map(
    ((tenantsData ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );

  return rows.map((r) => ({
    tenantId: r.tenant_id,
    tenantName: nameById.get(r.tenant_id) ?? "—",
    totalAccesses: r.total_accesses,
    lastSeenAt: r.last_seen_at,
  }));
}

export type ModuleChangeRequest = {
  id: string;
  featureKey: string;
  tenantId: string | null;
  tenantName: string | null;
  titulo: string;
  descricao: string | null;
  status: "aberto" | "em_andamento" | "concluido";
  createdAt: string;
};

/** Lista as solicitações de alteração de um módulo, mais recentes primeiro (aba Solicitações). */
export async function listChangeRequests(featureKey: string): Promise<ModuleChangeRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_change_requests")
    .select("id, feature_key, tenant_id, titulo, descricao, status, created_at")
    .eq("feature_key", featureKey)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    feature_key: string;
    tenant_id: string | null;
    titulo: string;
    descricao: string | null;
    status: string;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter((id): id is string => !!id))];
  let nameById = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenantsData, error: tenantsErr } = await supabase
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);
    if (tenantsErr) throw new Error(tenantsErr.message);
    nameById = new Map(
      ((tenantsData ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
    );
  }

  return rows.map((r) => ({
    id: r.id,
    featureKey: r.feature_key,
    tenantId: r.tenant_id,
    tenantName: r.tenant_id ? nameById.get(r.tenant_id) ?? "—" : null,
    titulo: r.titulo,
    descricao: r.descricao,
    status: r.status as ModuleChangeRequest["status"],
    createdAt: r.created_at,
  }));
}

/** Cria uma nova solicitação de alteração para um módulo. */
export async function createChangeRequest(
  featureKey: string,
  input: { titulo: string; descricao: string | null; tenantId: string | null },
  actorId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("module_change_requests").insert({
    feature_key: featureKey,
    tenant_id: input.tenantId,
    titulo: input.titulo,
    descricao: input.descricao,
    created_by: actorId,
  });
  if (error) throw new Error(`Erro ao criar solicitação: ${error.message}`);
}

/** Atualiza o status de uma solicitação de alteração. */
export async function updateChangeRequestStatus(
  id: string,
  status: "aberto" | "em_andamento" | "concluido"
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("module_change_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
}

export type ModuleAuditLogEntry = {
  id: string;
  eventType: string;
  actorId: string | null;
  detalhes: Record<string, unknown> | null;
  createdAt: string;
};

/** Histórico de ações administrativas de um módulo, mais recentes primeiro (aba Histórico). Limitado às últimas 100 entradas. */
export async function listModuleAuditLog(featureKey: string): Promise<ModuleAuditLogEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_audit_log")
    .select("id, event_type, actor_id, detalhes, created_at")
    .eq("feature_key", featureKey)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      id: string;
      event_type: string;
      actor_id: string | null;
      detalhes: Record<string, unknown> | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    eventType: r.event_type,
    actorId: r.actor_id,
    detalhes: r.detalhes,
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/db/modules.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/db/modules.ts
git commit -m "feat(db): add metrics, change requests and audit log functions"
```

---

### Task 4: Estender `lib/actions/admin-modulos.ts` — solicitações

**Files:**
- Modify: `lib/actions/admin-modulos.ts`

**Interfaces:**
- Consumes: `createChangeRequest`, `updateChangeRequestStatus` de `@/lib/db/modules` (Task 3).
- Produces: `criarSolicitacao(featureKey: string, formData: FormData): Promise<void>`, `atualizarStatusSolicitacao(requestId: string, status: "aberto" | "em_andamento" | "concluido", featureKey: string): Promise<void>`. Consumidos pela Task 7.

- [ ] **Step 1: Atualizar o import do topo do arquivo**

De:

```typescript
import {
  setKillSwitch,
  setTenantsForFeature,
  updateModuleAppearance,
  type ModuleAppearanceInput,
} from "@/lib/db/modules";
```

Para:

```typescript
import {
  setKillSwitch,
  setTenantsForFeature,
  updateModuleAppearance,
  createChangeRequest,
  updateChangeRequestStatus,
  type ModuleAppearanceInput,
} from "@/lib/db/modules";
```

- [ ] **Step 2: Adicionar as duas novas Server Actions ao final do arquivo**

```typescript
/** Cria uma nova solicitação de alteração para um módulo (aba Solicitações). */
export async function criarSolicitacao(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const titulo = String(formData.get("titulo") || "").trim();
  if (!titulo) throw new Error("Título é obrigatório");
  const descricao = String(formData.get("descricao") || "").trim() || null;
  const tenantId = String(formData.get("tenant_id") || "").trim() || null;
  await createChangeRequest(featureKey, { titulo, descricao, tenantId }, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}

/** Atualiza o status de uma solicitação de alteração (aba Solicitações). */
export async function atualizarStatusSolicitacao(
  requestId: string,
  status: "aberto" | "em_andamento" | "concluido",
  featureKey: string
): Promise<void> {
  await requireAdminUserId();
  await updateChangeRequestStatus(requestId, status);
  revalidatePath(`/admin/modulos/${featureKey}`);
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/actions/admin-modulos.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/admin-modulos.ts
git commit -m "feat: add server actions for module change requests"
```

---

### Task 5: `ModuloMetricasTab` — ranking de acessos

**Files:**
- Create: `components/admin/ModuloMetricasTab.tsx`

**Interfaces:**
- Consumes: tipo `ModuleAccessRankingItem` de `@/lib/db/modules` (Task 3).
- Produces: componente `ModuloMetricasTab` com prop `{ ranking: ModuleAccessRankingItem[] }`. Server Component (sem `"use client"`, sem interatividade). Consumido pela Task 8.

- [ ] **Step 1: Implementar o componente**

```tsx
import type { ModuleAccessRankingItem } from "@/lib/db/modules";

export function ModuloMetricasTab({ ranking }: { ranking: ModuleAccessRankingItem[] }) {
  if (ranking.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
        Nenhum acesso registrado a este módulo ainda.
      </p>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--adm-line)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--adm-surface-2)" }}>
            <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Empresa
            </th>
            <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Acessos
            </th>
            <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Último acesso
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r) => (
            <tr key={r.tenantId} style={{ borderTop: "1px solid var(--adm-line)" }}>
              <td className="px-4 py-2.5" style={{ color: "var(--adm-text)" }}>
                {r.tenantName}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--adm-text)" }}>
                {r.totalAccesses}
              </td>
              <td className="px-4 py-2.5 text-right" style={{ color: "var(--adm-text-dim)" }}>
                {new Date(r.lastSeenAt).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloMetricasTab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloMetricasTab.tsx
git commit -m "feat: add module metrics tab (access ranking)"
```

---

### Task 6: `ModuloHistoricoTab` — log de auditoria

**Files:**
- Create: `components/admin/ModuloHistoricoTab.tsx`

**Interfaces:**
- Consumes: tipo `ModuleAuditLogEntry` de `@/lib/db/modules` (Task 3).
- Produces: componente `ModuloHistoricoTab` com prop `{ entries: ModuleAuditLogEntry[] }`. Server Component. Consumido pela Task 8.

- [ ] **Step 1: Implementar o componente**

```tsx
import type { ModuleAuditLogEntry } from "@/lib/db/modules";

const EVENT_LABELS: Record<string, string> = {
  kill_switch_on: "Módulo desativado globalmente",
  kill_switch_off: "Módulo reativado",
  cor_alterada: "Aparência/comercial alterada",
  acesso_empresa_alterado: "Acesso por empresa alterado",
  preco_alterado: "Preço alterado",
};

export function ModuloHistoricoTab({ entries }: { entries: ModuleAuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
        Nenhuma ação registrada para este módulo ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            {EVENT_LABELS[e.eventType] ?? e.eventType}
          </span>
          <span className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
            {new Date(e.createdAt).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloHistoricoTab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloHistoricoTab.tsx
git commit -m "feat: add module history tab (audit log)"
```

---

### Task 7: `ModuloSolicitacoesForm` — backlog de solicitações

**Files:**
- Create: `components/admin/ModuloSolicitacoesForm.tsx`

**Interfaces:**
- Consumes: `criarSolicitacao`, `atualizarStatusSolicitacao` de `@/lib/actions/admin-modulos` (Task 4); tipo `ModuleChangeRequest` de `@/lib/db/modules` (Task 3).
- Produces: componente `ModuloSolicitacoesForm` com props `{ featureKey: string; requests: ModuleChangeRequest[]; tenants: { id: string; name: string }[] }`. Consumido pela Task 8.

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { ModuleChangeRequest } from "@/lib/db/modules";
import { criarSolicitacao, atualizarStatusSolicitacao } from "@/lib/actions/admin-modulos";

const STATUS_LABELS: Record<ModuleChangeRequest["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const STATUS_ORDER: ModuleChangeRequest["status"][] = ["aberto", "em_andamento", "concluido"];

export function ModuloSolicitacoesForm({
  featureKey,
  requests,
  tenants,
}: {
  featureKey: string;
  requests: ModuleChangeRequest[];
  tenants: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await criarSolicitacao(featureKey, formData);
      setShowForm(false);
    });
  }

  function handleStatusChange(requestId: string, status: ModuleChangeRequest["status"]) {
    startTransition(async () => {
      await atualizarStatusSolicitacao(requestId, status, featureKey);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          {showForm ? "Cancelar" : "Nova solicitação"}
        </button>
      </div>

      {showForm && (
        <form
          action={handleCreate}
          className="space-y-3 rounded-xl p-5"
          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
        >
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Título
            </label>
            <input
              type="text"
              name="titulo"
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Descrição
            </label>
            <textarea
              name="descricao"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Empresa relacionada (opcional, apenas informativo)
            </label>
            <select
              name="tenant_id"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            >
              <option value="">Nenhuma (solicitação geral)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--adm-accent)", color: "#04121a" }}
          >
            {isPending ? "Enviando..." : "Enviar solicitação"}
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          Nenhuma solicitação registrada para este módulo ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-lg p-4"
              style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                    {r.titulo}
                  </p>
                  {r.descricao && (
                    <p className="text-xs mt-1" style={{ color: "var(--adm-text-dim)" }}>
                      {r.descricao}
                    </p>
                  )}
                  {r.tenantName && (
                    <p className="text-xs mt-1" style={{ color: "var(--adm-text-faint)" }}>
                      Empresa: {r.tenantName}
                    </p>
                  )}
                </div>
                <select
                  value={r.status}
                  disabled={isPending}
                  onChange={(e) =>
                    handleStatusChange(r.id, e.target.value as ModuleChangeRequest["status"])
                  }
                  className="text-xs rounded-md px-2 py-1 disabled:opacity-50 shrink-0"
                  style={{
                    background: "var(--adm-surface-2)",
                    color: "var(--adm-text)",
                    border: "1px solid var(--adm-line-strong)",
                  }}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloSolicitacoesForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloSolicitacoesForm.tsx
git commit -m "feat: add module change requests form and list"
```

---

### Task 8: Ligar as 3 abas novas na tela de detalhe

**Files:**
- Modify: `app/(admin)/admin/modulos/[key]/page.tsx`

**Interfaces:**
- Consumes: `getModuleAccessRanking`, `listChangeRequests`, `listModuleAuditLog` de `@/lib/db/modules` (Task 3); `ModuloMetricasTab` (Task 5), `ModuloHistoricoTab` (Task 6), `ModuloSolicitacoesForm` (Task 7).

- [ ] **Step 1: Atualizar os imports do topo do arquivo**

De:

```tsx
import { getModuleSettings, countTenantsWithFeature } from "@/lib/db/modules";
import { getAllTenants } from "@/lib/db/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModuloKillSwitchButton } from "@/components/admin/ModuloKillSwitchButton";
import { ModuloAcessoForm } from "@/components/admin/ModuloAcessoForm";
import { ModuloAparenciaForm } from "@/components/admin/ModuloAparenciaForm";

type Aba = "acesso" | "aparencia";

const ABAS: { valor: Aba; label: string }[] = [
  { valor: "acesso", label: "Acesso" },
  { valor: "aparencia", label: "Aparência/Comercial" },
];
```

Para:

```tsx
import {
  getModuleSettings,
  countTenantsWithFeature,
  getModuleAccessRanking,
  listChangeRequests,
  listModuleAuditLog,
} from "@/lib/db/modules";
import { getAllTenants } from "@/lib/db/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModuloKillSwitchButton } from "@/components/admin/ModuloKillSwitchButton";
import { ModuloAcessoForm } from "@/components/admin/ModuloAcessoForm";
import { ModuloAparenciaForm } from "@/components/admin/ModuloAparenciaForm";
import { ModuloMetricasTab } from "@/components/admin/ModuloMetricasTab";
import { ModuloHistoricoTab } from "@/components/admin/ModuloHistoricoTab";
import { ModuloSolicitacoesForm } from "@/components/admin/ModuloSolicitacoesForm";

type Aba = "acesso" | "aparencia" | "metricas" | "solicitacoes" | "historico";

const ABAS: { valor: Aba; label: string }[] = [
  { valor: "acesso", label: "Acesso" },
  { valor: "aparencia", label: "Aparência/Comercial" },
  { valor: "metricas", label: "Métricas" },
  { valor: "solicitacoes", label: "Solicitações" },
  { valor: "historico", label: "Histórico" },
];
```

- [ ] **Step 2: Buscar os dados das 3 abas novas em paralelo**

De:

```tsx
  const [settings, tenants, tenantsComFeature] = await Promise.all([
    getModuleSettings(key),
    getAllTenants(),
    countTenantsWithFeature(key),
  ]);
```

Para:

```tsx
  const [settings, tenants, tenantsComFeature, ranking, changeRequests, auditLog] =
    await Promise.all([
      getModuleSettings(key),
      getAllTenants(),
      countTenantsWithFeature(key),
      getModuleAccessRanking(key),
      listChangeRequests(key),
      listModuleAuditLog(key),
    ]);
```

- [ ] **Step 3: Renderizar as 3 abas novas, logo após o bloco da aba "aparencia"**

De:

```tsx
      {abaAtiva === "aparencia" && (
        <ModuloAparenciaForm
          featureKey={key}
          initialAccentColor={settings?.accentColor ?? "#3b82f6"}
          initialPricingModel={settings?.pricingModel ?? "incluso_free"}
          initialPrecoAvulso={settings?.precoAvulso ?? null}
        />
      )}
    </div>
  );
}
```

Para:

```tsx
      {abaAtiva === "aparencia" && (
        <ModuloAparenciaForm
          featureKey={key}
          initialAccentColor={settings?.accentColor ?? "#3b82f6"}
          initialPricingModel={settings?.pricingModel ?? "incluso_free"}
          initialPrecoAvulso={settings?.precoAvulso ?? null}
        />
      )}

      {abaAtiva === "metricas" && <ModuloMetricasTab ranking={ranking} />}

      {abaAtiva === "solicitacoes" && (
        <ModuloSolicitacoesForm
          featureKey={key}
          requests={changeRequests}
          tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}

      {abaAtiva === "historico" && <ModuloHistoricoTab entries={auditLog} />}
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `app/(admin)/admin/modulos/[key]/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/modulos/[key]/page.tsx"
git commit -m "feat: wire Métricas, Solicitações and Histórico tabs into module detail page"
```

---

### Task 9: Verificação manual end-to-end

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 2: Confirmar que o rastreamento de acesso grava dados reais**

Subir `npm run dev` (`npm run dev`), logar como usuário de uma empresa com o módulo Financeiro ativo, navegar até a tela do Financeiro (dispara uma chamada a uma API que usa `requireFeature("modulo_financeiro")`, ex. `/api/dashboard/financeiro/overview`). No SQL Editor do Supabase:

```sql
select * from tenant_module_access_stats where feature_key = 'modulo_financeiro';
```

Expected: uma linha para o tenant desse usuário, com `total_accesses >= 1`. Recarregar a página do Financeiro várias vezes rapidamente (dentro de 60s) e confirmar que `total_accesses` NÃO incrementa a cada reload (throttle funcionando) — só volta a incrementar depois de esperar mais de 1 minuto.

- [ ] **Step 3: Testar a aba Métricas**

Ir em `/admin/modulos/modulo_financeiro?aba=metricas` (logado como admin). Confirmar que a empresa testada no passo anterior aparece no ranking, com a contagem de acessos e o horário do último acesso.

- [ ] **Step 4: Testar a aba Solicitações**

Ir em `?aba=solicitacoes`. Clicar "Nova solicitação", preencher título + descrição, opcionalmente escolher uma empresa no select, enviar. Confirmar que a solicitação aparece na lista com status "Aberto". Mudar o status pelo select da linha e confirmar que persiste após recarregar a página.

- [ ] **Step 5: Testar a aba Histórico**

Ir em `?aba=historico`. Confirmar que aparecem entradas para as ações já feitas anteriormente neste módulo (kill-switch, mudança de acesso, mudança de aparência — feitas durante a verificação do Plano 2) e para a solicitação recém-criada não aparece nada (solicitações não geram evento de auditoria, por design). Confirmar que os rótulos em português (ex. "Módulo desativado globalmente") aparecem em vez do `event_type` bruto.

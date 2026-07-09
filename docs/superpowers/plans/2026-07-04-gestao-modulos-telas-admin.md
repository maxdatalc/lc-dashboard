# Gestão de Módulos — Plano 2: Telas Admin (listagem + detalhe + kill-switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as telas `/admin/modulos` (listagem) e `/admin/modulos/[key]` (detalhe com abas Acesso e Aparência/Comercial), incluindo o fluxo de kill-switch com confirmação. Depende do Plano 1 (Fundação) já implementado: `lib/access/resolve-modules.ts`, `lib/db/modules.ts`, e as 5 tabelas novas já existem.

**Architecture:** Duas rotas novas sob `/admin/modulos`, seguindo o padrão já estabelecido em `/admin/empresas/[id]` (Server Component busca dados, Server Actions em `lib/actions/*.ts` fazem as mutações, Client Components isolados cuidam de interatividade). Duas funções novas em `lib/db/modules.ts` (`setTenantsForFeature`, `updateModuleAppearance`) complementam as já existentes do Plano 1. Um utilitário novo (`lib/features-icons.ts`) resolve o problema de `FEATURES_CATALOG.icone` ser uma string sem um mapa compartilhado hoje.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Recharts (já é dependência do projeto, usado no preview de cor).

## Global Constraints

- Path alias `@/*` mapeia para a raiz — importar sempre como `@/lib/...`, `@/components/...`.
- Painel admin usa tokens CSS `--adm-*` (definidos em `app/globals.css`) via `style={{ ... }}` inline, não classes Tailwind de cor — seguir esse padrão em todo componente novo do admin (mesmo estilo de `AdminCard`, `AdminButton`, `AdminPageHeader`).
- Server Actions reutilizáveis (chamadas por Client Components) vão em `lib/actions/*.ts` com `"use server"` no topo do arquivo — não inline na página. Toda Server Action de admin começa verificando o usuário é admin (padrão `verificarAdmin()`/`isSystemAdmin()` de `lib/db/admin.ts`) e termina com `revalidatePath(...)`.
- Toda função de acesso a dados usa `createAdminClient()` de `@/lib/supabase/server`, chamado fresh a cada função (não reaproveitado). Erros do Supabase sempre verificados com `if (error) throw new Error(error.message)` (ou mensagem customizada).
- Não existe componente de switch/toggle reutilizável no projeto — usar checkbox HTML estilizado (mesmo padrão da aba "Módulos" de `/admin/empresas/[id]`), não introduzir uma lib nova de UI.
- Páginas do admin usam `export const dynamic = "force-dynamic"` e `export const revalidate = 0` no topo, `params`/`searchParams` como `Promise<...>` (Next.js 14 com params assíncronos).
- Não modificar a aba "Módulos" existente em `/admin/empresas/[id]/page.tsx` neste plano — as duas telas coexistem, lendo/escrevendo as mesmas tabelas.
- Módulos com `disponivel: false` no catálogo (`lib/features.ts`) não têm rota de detalhe — só aparecem na listagem, sem link clicável.

---

### Task 1: `lib/features-icons.ts` — mapa de ícones do catálogo

**Files:**
- Create: `lib/features-icons.ts`

**Interfaces:**
- Produces: `getFeatureIcon(iconName: string): LucideIcon`. Consumido pelas Tasks 5 e 9.

Hoje não existe um mapa nome→componente compartilhado para `FEATURES_CATALOG[].icone` (cada tela que precisa disso reimplementa um `ICONE_MAP` local e incompleto, ex. `app/(admin)/admin/empresas/novo/page.tsx:15-19`). Esta task cria um utilitário compartilhado cobrindo todos os ícones hoje usados em `lib/features.ts`.

- [ ] **Step 1: Implementar o mapa de ícones**

```typescript
// Mapa compartilhado nome-do-ícone -> componente lucide-react, para
// renderizar dinamicamente o campo `icone` (string) de FEATURES_CATALOG.

import {
  LayoutDashboard,
  Scale,
  ClipboardList,
  Landmark,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  MessageCircle,
  Bell,
  Sparkles,
  UserCheck,
  TrendingUp,
  Zap,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Scale,
  ClipboardList,
  Landmark,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  MessageCircle,
  Bell,
  Sparkles,
  UserCheck,
  TrendingUp,
  Zap,
  BarChart3,
};

/** Ícone do módulo pelo nome salvo em FEATURES_CATALOG; Package como fallback. */
export function getFeatureIcon(iconName: string): LucideIcon {
  return FEATURE_ICON_MAP[iconName] ?? Package;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `lib/features-icons.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/features-icons.ts
git commit -m "feat: add shared icon map for FEATURES_CATALOG"
```

---

### Task 2: Estender `lib/db/modules.ts` — acesso por empresa e aparência

**Files:**
- Modify: `lib/db/modules.ts` (adicionar ao final do arquivo, depois de `setKillSwitch`)

**Interfaces:**
- Consumes: `createAdminClient` (já importado no arquivo, Plano 1).
- Produces: `setTenantsForFeature(featureKey: string, tenantIds: string[], actorId: string): Promise<void>`, `updateModuleAppearance(featureKey: string, input: ModuleAppearanceInput, actorId: string): Promise<void>`, tipo `ModuleAppearanceInput`. Consumidos pela Task 3 (Server Actions).

- [ ] **Step 1: Adicionar as duas funções e o tipo novo ao final de `lib/db/modules.ts`**

```typescript
/**
 * Substitui o conjunto de empresas com acesso a uma feature específica,
 * sem tocar nas outras features de cada tenant (diferente de
 * updateTenantFeatures, que substitui TODAS as features de UM tenant).
 */
export async function setTenantsForFeature(
  featureKey: string,
  tenantIds: string[],
  actorId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: current, error: curErr } = await supabase
    .from("tenant_features")
    .select("tenant_id")
    .eq("feature_key", featureKey);
  if (curErr) throw new Error(curErr.message);

  const currentIds = new Set(
    ((current ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id)
  );
  const nextIds = new Set(tenantIds);

  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("tenant_features")
      .delete()
      .eq("feature_key", featureKey)
      .in("tenant_id", toRemove);
    if (error) throw new Error(error.message);
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("tenant_features")
      .insert(toAdd.map((tenantId) => ({ tenant_id: tenantId, feature_key: featureKey })));
    if (error) throw new Error(error.message);
  }

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: "acesso_empresa_alterado",
    actor_id: actorId,
    detalhes: { added: toAdd, removed: toRemove },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);
}

export type ModuleAppearanceInput = {
  accentColor: string | null;
  pricingModel: "incluso_free" | "incluso_premium" | "avulso";
  precoAvulso: number | null;
};

/** Atualiza cor de destaque e modelo comercial de um módulo (upsert parcial). */
export async function updateModuleAppearance(
  featureKey: string,
  input: ModuleAppearanceInput,
  actorId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("module_settings").upsert(
    {
      feature_key: featureKey,
      accent_color: input.accentColor,
      pricing_model: input.pricingModel,
      preco_avulso: input.precoAvulso,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: "feature_key" }
  );
  if (error) throw new Error(`Erro ao atualizar aparência do módulo: ${error.message}`);

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: "cor_alterada",
    actor_id: actorId,
    detalhes: {
      accent_color: input.accentColor,
      pricing_model: input.pricingModel,
      preco_avulso: input.precoAvulso,
    },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/db/modules.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/db/modules.ts
git commit -m "feat(db): add tenant access and appearance functions to modules data layer"
```

---

### Task 3: `lib/actions/admin-modulos.ts` — Server Actions

**Files:**
- Create: `lib/actions/admin-modulos.ts`

**Interfaces:**
- Consumes: `setKillSwitch`, `setTenantsForFeature`, `updateModuleAppearance`, `ModuleAppearanceInput` de `@/lib/db/modules` (Plano 1 + Task 2); `isSystemAdmin` de `@/lib/db/admin`; `createClient` de `@/lib/supabase/server`.
- Produces: `toggleKillSwitch(featureKey: string, enabled: boolean): Promise<{ error?: string }>`, `salvarAcessoModulo(featureKey: string, formData: FormData): Promise<void>`, `salvarAparenciaModulo(featureKey: string, formData: FormData): Promise<void>`. Consumidos pelas Tasks 6, 7 e 8.

- [ ] **Step 1: Implementar o arquivo**

```typescript
"use server";

// Server Actions para a tela de Gestão de Módulos (/admin/modulos) do painel admin

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import {
  setKillSwitch,
  setTenantsForFeature,
  updateModuleAppearance,
  type ModuleAppearanceInput,
} from "@/lib/db/modules";

async function requireAdminUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
  return user.id;
}

/** Liga/desliga o kill-switch global de um módulo. */
export async function toggleKillSwitch(
  featureKey: string,
  enabled: boolean
): Promise<{ error?: string }> {
  try {
    const actorId = await requireAdminUserId();
    await setKillSwitch(featureKey, enabled, actorId);
    revalidatePath(`/admin/modulos/${featureKey}`);
    revalidatePath("/admin/modulos");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar kill-switch" };
  }
}

/** Substitui quais empresas têm acesso a um módulo (aba Acesso). */
export async function salvarAcessoModulo(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const tenantIds = [...new Set(formData.getAll("tenant").map(String))];
  await setTenantsForFeature(featureKey, tenantIds, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}

/** Salva cor de destaque e modelo comercial de um módulo (aba Aparência/Comercial). */
export async function salvarAparenciaModulo(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const precoAvulsoRaw = formData.get("preco_avulso");
  const input: ModuleAppearanceInput = {
    accentColor: String(formData.get("accent_color") || "") || null,
    pricingModel: String(
      formData.get("pricing_model") || "incluso_free"
    ) as ModuleAppearanceInput["pricingModel"],
    precoAvulso: precoAvulsoRaw ? Number(precoAvulsoRaw) : null,
  };
  await updateModuleAppearance(featureKey, input, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `lib/actions/admin-modulos.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/admin-modulos.ts
git commit -m "feat: add server actions for module management screens"
```

---

### Task 4: Item de menu "Módulos" no admin

**Files:**
- Modify: `app/(admin)/admin/layout.tsx`

**Interfaces:**
- Produces: link de navegação para `/admin/modulos` visível apenas para `isAdmin` (mesma condição do item "Usuários").

- [ ] **Step 1: Adicionar o ícone ao import de `lucide-react` (linha 2-9)**

De:

```typescript
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  BookUser,
} from "lucide-react";
```

Para:

```typescript
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  BookUser,
  Zap,
} from "lucide-react";
```

- [ ] **Step 2: Adicionar o item de navegação dentro do grupo "Sistema" (linhas 125-132)**

De:

```tsx
          {isAdmin && (
            <NavGroup label="Sistema">
              <AdminNavLink href="/admin/usuarios">
                <Users className="h-4 w-4 shrink-0" />
                Usuários
              </AdminNavLink>
            </NavGroup>
          )}
```

Para:

```tsx
          {isAdmin && (
            <NavGroup label="Sistema">
              <AdminNavLink href="/admin/usuarios">
                <Users className="h-4 w-4 shrink-0" />
                Usuários
              </AdminNavLink>
              <AdminNavLink href="/admin/modulos">
                <Zap className="h-4 w-4 shrink-0" />
                Módulos
              </AdminNavLink>
            </NavGroup>
          )}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `app/(admin)/admin/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/layout.tsx"
git commit -m "feat: add Módulos nav item to admin sidebar"
```

---

### Task 5: Tela de listagem (`/admin/modulos`)

**Files:**
- Create: `app/(admin)/admin/modulos/page.tsx`

**Interfaces:**
- Consumes: `FEATURES_CATALOG` de `@/lib/features`; `getAllModuleSettings` de `@/lib/db/modules` (Plano 1); `getAllTenants` de `@/lib/db/admin` (assinatura: `Promise<TenantComLojas[]>`, cada item com `features: string[]`); `getFeatureIcon` de `@/lib/features-icons` (Task 1); `AdminPageHeader`, `AdminCard` de `@/components/admin/*`.

- [ ] **Step 1: Implementar a página**

```tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { FEATURES_CATALOG } from "@/lib/features";
import { getAllModuleSettings } from "@/lib/db/modules";
import { getAllTenants } from "@/lib/db/admin";
import { getFeatureIcon } from "@/lib/features-icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default async function ModulosPage() {
  const [moduleSettings, tenants] = await Promise.all([
    getAllModuleSettings(),
    getAllTenants(),
  ]);

  const disponiveis = FEATURES_CATALOG.filter((f) => f.disponivel);
  const emBreve = FEATURES_CATALOG.filter((f) => !f.disponivel);

  const countForFeature = (key: string) =>
    tenants.filter((t) => t.features.includes(key)).length;

  return (
    <div className="space-y-6 p-8">
      <AdminPageHeader
        eyebrow="Sistema"
        title="Módulos"
        subtitle={`${disponiveis.length} módulos ativos no catálogo, ${emBreve.length} em breve`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {disponiveis.map((f) => {
          const settings = moduleSettings[f.key];
          const killed = settings?.killSwitchEnabled ?? false;
          const Icon = getFeatureIcon(f.icone);
          const total = countForFeature(f.key);

          return (
            <Link key={f.key} href={`/admin/modulos/${f.key}`}>
              <AdminCard hover className="p-5 h-full cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--adm-accent)" }} />
                    <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                      {settings?.labelOverride || f.label}
                    </h3>
                  </div>
                  {settings?.accentColor && (
                    <span
                      className="h-4 w-4 rounded-full shrink-0 border"
                      style={{ background: settings.accentColor, borderColor: "var(--adm-line)" }}
                      title={settings.accentColor}
                    />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      background: f.categoria === "core" ? "var(--adm-surface-2)" : "var(--adm-accent-soft)",
                      color: f.categoria === "core" ? "var(--adm-text-dim)" : "var(--adm-accent)",
                    }}
                  >
                    {f.categoria === "core" ? "Core" : "Premium"}
                  </span>
                  {killed && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: "#fca5a5", background: "#450a0a", border: "1px solid #7f1d1d" }}
                    >
                      Desativado globalmente
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {total} de {tenants.length} empresas com acesso
                </p>
              </AdminCard>
            </Link>
          );
        })}
      </div>

      {emBreve.length > 0 && (
        <div>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--adm-text-faint)" }}
          >
            Em breve
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emBreve.map((f) => {
              const Icon = getFeatureIcon(f.icone);
              return (
                <AdminCard key={f.key} className="p-4 opacity-60">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>
                      {f.label}
                    </span>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `app/(admin)/admin/modulos/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/modulos/page.tsx"
git commit -m "feat: add module listing page at /admin/modulos"
```

---

### Task 6: `ModuloKillSwitchButton` — botão + confirmação

**Files:**
- Create: `components/admin/ModuloKillSwitchButton.tsx`

**Interfaces:**
- Consumes: `toggleKillSwitch(featureKey: string, enabled: boolean): Promise<{ error?: string }>` de `@/lib/actions/admin-modulos` (Task 3).
- Produces: componente `ModuloKillSwitchButton` com props `{ featureKey: string; featureLabel: string; killSwitchEnabled: boolean; affectedTenantCount: number }`. Consumido pela Task 9.

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useState } from "react";
import { toggleKillSwitch } from "@/lib/actions/admin-modulos";

export function ModuloKillSwitchButton({
  featureKey,
  featureLabel,
  killSwitchEnabled,
  affectedTenantCount,
}: {
  featureKey: string;
  featureLabel: string;
  killSwitchEnabled: boolean;
  affectedTenantCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await toggleKillSwitch(featureKey, !killSwitchEnabled);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150"
        style={
          killSwitchEnabled
            ? { background: "var(--adm-surface-2)", color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)" }
            : { background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d" }
        }
      >
        {killSwitchEnabled ? "Reativar módulo" : "Desativar módulo para todos"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--adm-text)" }}>
              {killSwitchEnabled ? "Reativar" : "Desativar"} {featureLabel}?
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--adm-text-dim)" }}>
              {killSwitchEnabled
                ? "O módulo voltará a ficar disponível para as empresas que já tinham acesso configurado."
                : `Isso vai remover o acesso ao módulo ${featureLabel} de ${affectedTenantCount} ${
                    affectedTenantCount === 1 ? "empresa" : "empresas"
                  } imediatamente.`}
            </p>
            {error && (
              <p className="mt-2 text-sm" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--adm-surface-2)", color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--adm-accent)", color: "#04121a" }}
              >
                {loading ? "Aplicando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloKillSwitchButton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloKillSwitchButton.tsx
git commit -m "feat: add kill-switch button with confirmation modal"
```

---

### Task 7: `ModuloAcessoForm` — aba Acesso

**Files:**
- Create: `components/admin/ModuloAcessoForm.tsx`

**Interfaces:**
- Consumes: `salvarAcessoModulo(featureKey: string, formData: FormData): Promise<void>` de `@/lib/actions/admin-modulos` (Task 3); tipo `Plan` de `@/lib/plans`.
- Produces: componente `ModuloAcessoForm` com props `{ featureKey: string; tenants: { id: string; name: string; plan: Plan; ativo: boolean }[]; killSwitchEnabled: boolean }`. Consumido pela Task 9.

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useRef, useTransition } from "react";
import type { Plan } from "@/lib/plans";
import { salvarAcessoModulo } from "@/lib/actions/admin-modulos";

type TenantRow = { id: string; name: string; plan: Plan; ativo: boolean };

export function ModuloAcessoForm({
  featureKey,
  tenants,
  killSwitchEnabled,
}: {
  featureKey: string;
  tenants: TenantRow[];
  killSwitchEnabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function marcarTodosPremium() {
    const form = formRef.current;
    if (!form) return;
    form
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-plan="premium"]')
      .forEach((cb) => {
        cb.checked = true;
      });
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await salvarAcessoModulo(featureKey, formData);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {killSwitchEnabled && (
        <p
          className="text-sm rounded-lg px-4 py-3"
          style={{ background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d" }}
        >
          Este módulo está com kill-switch ligado — as mudanças aqui só valerão quando ele for reativado.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={marcarTodosPremium}
          className="text-xs font-medium"
          style={{ color: "var(--adm-accent)" }}
        >
          Marcar todas as empresas Premium
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          {isPending ? "Salvando..." : "Salvar acesso"}
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--adm-line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--adm-surface-2)" }}>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Empresa
              </th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Plano
              </th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--adm-text-dim)" }}>
                Acesso
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--adm-line)" }}>
                <td className="px-4 py-2.5" style={{ color: "var(--adm-text)" }}>
                  {t.name}
                </td>
                <td className="px-4 py-2.5 capitalize" style={{ color: "var(--adm-text-dim)" }}>
                  {t.plan}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="checkbox"
                    name="tenant"
                    value={t.id}
                    data-plan={t.plan}
                    defaultChecked={t.ativo}
                    className="h-4 w-4 rounded"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloAcessoForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloAcessoForm.tsx
git commit -m "feat: add module access form (per-tenant toggle table)"
```

---

### Task 8: `ModuloAparenciaForm` — aba Aparência/Comercial com preview

**Files:**
- Create: `components/admin/ModuloAparenciaForm.tsx`

**Interfaces:**
- Consumes: `salvarAparenciaModulo(featureKey: string, formData: FormData): Promise<void>` de `@/lib/actions/admin-modulos` (Task 3); `BarChart, Bar, ResponsiveContainer, XAxis` de `recharts` (já é dependência do projeto).
- Produces: componente `ModuloAparenciaForm` com props `{ featureKey: string; initialAccentColor: string; initialPricingModel: "incluso_free" | "incluso_premium" | "avulso"; initialPrecoAvulso: number | null }`. Consumido pela Task 9.

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useState, useTransition } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis } from "recharts";
import { salvarAparenciaModulo } from "@/lib/actions/admin-modulos";

const PREVIEW_DATA = [
  { name: "Jan", valor: 40 },
  { name: "Fev", valor: 65 },
  { name: "Mar", valor: 50 },
  { name: "Abr", valor: 80 },
];

type PricingModel = "incluso_free" | "incluso_premium" | "avulso";

export function ModuloAparenciaForm({
  featureKey,
  initialAccentColor,
  initialPricingModel,
  initialPrecoAvulso,
}: {
  featureKey: string;
  initialAccentColor: string;
  initialPricingModel: PricingModel;
  initialPrecoAvulso: number | null;
}) {
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [pricingModel, setPricingModel] = useState<PricingModel>(initialPricingModel);
  const [precoAvulso, setPrecoAvulso] = useState(initialPrecoAvulso?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await salvarAparenciaModulo(featureKey, formData);
      setSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form action={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
            Cor de destaque
          </label>
          <input
            type="color"
            name="accent_color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-10 w-20 rounded cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
            Modelo comercial
          </label>
          <select
            name="pricing_model"
            value={pricingModel}
            onChange={(e) => setPricingModel(e.target.value as PricingModel)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--adm-surface-2)",
              color: "var(--adm-text)",
              border: "1px solid var(--adm-line-strong)",
            }}
          >
            <option value="incluso_free">Incluso no Free</option>
            <option value="incluso_premium">Incluso no Premium</option>
            <option value="avulso">Vendido à parte</option>
          </select>
        </div>

        {pricingModel === "avulso" && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--adm-text)" }}>
              Preço avulso (R$)
            </label>
            <input
              type="number"
              name="preco_avulso"
              step="0.01"
              min="0"
              value={precoAvulso}
              onChange={(e) => setPrecoAvulso(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--adm-surface-2)",
                color: "var(--adm-text)",
                border: "1px solid var(--adm-line-strong)",
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--adm-accent)", color: "#04121a" }}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
          {saved && !isPending && (
            <span className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
              Salvo.
            </span>
          )}
        </div>
      </form>

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--adm-text-faint)" }}
        >
          Preview
        </p>
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: "var(--adm-surface-2)", borderLeft: `3px solid ${accentColor}` }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Card de exemplo
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--adm-text-dim)" }}>
            Assim fica o destaque deste módulo para o cliente.
          </p>
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PREVIEW_DATA}>
              <XAxis dataKey="name" tick={{ fill: "var(--adm-text-dim)", fontSize: 11 }} />
              <Bar dataKey="valor" fill={accentColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/admin/ModuloAparenciaForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ModuloAparenciaForm.tsx
git commit -m "feat: add module appearance form with live preview"
```

---

### Task 9: Tela de detalhe (`/admin/modulos/[key]`)

**Files:**
- Create: `app/(admin)/admin/modulos/[key]/page.tsx`

**Interfaces:**
- Consumes: `FEATURES_CATALOG` de `@/lib/features`; `getModuleSettings`, `countTenantsWithFeature` de `@/lib/db/modules`; `getAllTenants` de `@/lib/db/admin`; `AdminPageHeader` de `@/components/admin/AdminPageHeader`; `ModuloKillSwitchButton` (Task 6), `ModuloAcessoForm` (Task 7), `ModuloAparenciaForm` (Task 8).

- [ ] **Step 1: Implementar a página**

```tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES_CATALOG } from "@/lib/features";
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

export default async function ModuloDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { key } = await params;
  const { aba: abaParam } = await searchParams;
  const abaAtiva: Aba = (ABAS.some((a) => a.valor === abaParam) ? abaParam : "acesso") as Aba;

  const feature = FEATURES_CATALOG.find((f) => f.key === key);
  if (!feature) notFound();

  const [settings, tenants, tenantsComFeature] = await Promise.all([
    getModuleSettings(key),
    getAllTenants(),
    countTenantsWithFeature(key),
  ]);

  const killed = settings?.killSwitchEnabled ?? false;

  return (
    <div className="space-y-6 p-8">
      <AdminPageHeader
        eyebrow="Módulos"
        title={settings?.labelOverride || feature.label}
        subtitle={feature.descricao}
        actions={
          <ModuloKillSwitchButton
            featureKey={key}
            featureLabel={feature.label}
            killSwitchEnabled={killed}
            affectedTenantCount={tenantsComFeature}
          />
        }
      />

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--adm-line)" }}>
        {ABAS.map((a) => {
          const isActive = abaAtiva === a.valor;
          return (
            <Link
              key={a.valor}
              href={`/admin/modulos/${key}?aba=${a.valor}`}
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150"
              style={{
                borderColor: isActive ? "var(--adm-accent)" : "transparent",
                color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
              }}
            >
              {a.label}
            </Link>
          );
        })}
      </div>

      {abaAtiva === "acesso" && (
        <ModuloAcessoForm
          featureKey={key}
          tenants={tenants.map((t) => ({
            id: t.id,
            name: t.name,
            plan: t.plan,
            ativo: t.features.includes(key),
          }))}
          killSwitchEnabled={killed}
        />
      )}

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

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `app/(admin)/admin/modulos/[key]/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/modulos/[key]/page.tsx"
git commit -m "feat: add module detail page with Acesso and Aparência/Comercial tabs"
```

---

### Task 10: Verificação manual end-to-end

**Files:** nenhum (só verificação).

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 2: Subir o dev server e navegar até a listagem**

Run: `npm run dev`

Logar como `is_system_admin`. Acessar `/admin` e confirmar que "Módulos" aparece no grupo "Sistema" do menu lateral. Clicar e confirmar que `/admin/modulos` mostra um card por módulo `disponivel: true` do catálogo, com contador "X de Y empresas com acesso", e uma seção "Em breve" no fim com os módulos `disponivel: false`.

- [ ] **Step 3: Testar a aba Acesso**

Clicar em um módulo (ex. Financeiro) para abrir `/admin/modulos/modulo_financeiro`. Confirmar que a aba Acesso lista todas as empresas com checkbox marcado conforme `tenant_features`. Desmarcar uma empresa que tinha acesso, clicar "Salvar acesso", confirmar que a página recarrega com o novo estado persistido (reabrir a página confirma). Verificar no SQL Editor que `tenant_features` reflete a mudança e que as OUTRAS features dessa empresa continuam intactas.

- [ ] **Step 4: Testar a aba Aparência/Comercial**

Ir para `?aba=aparencia`. Mudar a cor no color picker e confirmar que o preview (card + gráfico) atualiza instantaneamente, sem precisar salvar. Escolher "Vendido à parte" e confirmar que o campo de preço aparece. Salvar e confirmar (reabrindo a página) que a cor e o modelo comercial persistiram. Verificar no SQL Editor: `select * from module_settings where feature_key = 'modulo_financeiro';` mostra os valores salvos, e `select * from module_audit_log where feature_key = 'modulo_financeiro' order by created_at desc;` tem uma linha `cor_alterada`.

- [ ] **Step 5: Testar o fluxo de kill-switch**

Clicar em "Desativar módulo para todos". Confirmar que o modal mostra a contagem correta de empresas afetadas (deve bater com o que aparecia na listagem). Confirmar. Verificar:
- O botão agora diz "Reativar módulo".
- No dashboard do cliente (outra aba/janela, logado como usuário de uma empresa afetada), o módulo sumiu do menu lateral (comportamento já validado no Plano 1 — aqui é só a confirmação de que o toggle pela UI produz o mesmo efeito que o toggle manual via SQL).
- `select * from kill_switch_revocations where feature_key = 'modulo_financeiro' order by revoked_at desc;` tem uma linha por empresa afetada.
- `select * from module_audit_log where feature_key = 'modulo_financeiro' and event_type = 'kill_switch_on';` tem a linha correspondente.

Clicar em "Reativar módulo". Confirmar que o módulo volta a aparecer no dashboard do cliente sem precisar reconfigurar a aba Acesso.

- [ ] **Step 6: Confirmar que a aba "Módulos" da tela de empresa continua funcionando**

Ir em `/admin/empresas/[id]?aba=features` de uma empresa qualquer e confirmar que o comportamento de toggle por-empresa (já existente, não tocado neste plano) continua idêntico ao de antes do Plano 2.

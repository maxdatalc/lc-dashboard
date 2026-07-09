# Gestão de Módulos — Plano 4: Propagação de Cor para o Dashboard do Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a `accent_color` configurada em `/admin/modulos/[key]` (aba Aparência/Comercial, Plano 2) chegar de verdade nos gráficos do dashboard do cliente, com fallback pro valor fixo atual quando não houver override — migração gradual, um componente de exemplo primeiro, não a base inteira de uma vez.

**Architecture:** `app/(dashboard)/layout.tsx` passa a buscar também `module_settings.accent_color` (só as linhas com cor definida) e expor via `EmpresaProvider`. `lib/contexts/empresa-context.tsx` ganha `getModuleColor(key)` ao lado do `hasFeature` já existente. Um componente de gráfico real (`components/charts/FinFluxoMensalChart.tsx`, módulo Financeiro) é migrado como prova de conceito, trocando um hex fixo (`#ef4444`) por `getModuleColor("modulo_financeiro")` com o mesmo hex como fallback.

## Global Constraints

- Path alias `@/*` mapeia para a raiz.
- `app/(dashboard)/layout.tsx` e `lib/contexts/empresa-context.tsx` já foram modificados no Plano 1 (motor de resolução + kill-switch) — as edições aqui são incrementais sobre esse estado, não uma reescrita.
- Migração de cor é **gradual por design**: esta plano migra só `FinFluxoMensalChart.tsx` como exemplo. Não migrar outros gráficos/módulos nesta rodada.
- Sem cor configurada (`module_settings.accent_color` nulo ou linha inexistente), o comportamento visual deve ficar idêntico ao de hoje (mesmo hex fixo como fallback).
- Não modificar `lib/db/modules.ts` neste plano — a leitura de cores no dashboard do cliente é feita via query direta no `adminClient` já existente em `app/(dashboard)/layout.tsx` (mesmo padrão usado para `killedFeatureKeys` no Plano 1), não via a camada de dados do admin.

---

### Task 1: Propagar `accent_color` via `EmpresaProvider`

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `lib/contexts/empresa-context.tsx`

**Interfaces:**
- Produces: `EmpresaContextValue.getModuleColor(key: string): string | undefined`, prop `moduleColors?: Record<string, string>` em `EmpresaProvider`. Consumido pela Task 2 e por qualquer componente futuro que quiser cor dinâmica de módulo.

- [ ] **Step 1: Adicionar a 8ª query ao `Promise.all` de `app/(dashboard)/layout.tsx`**

De:

```typescript
  const [profileRes, tenantAccessRes, empresaRes, featuresRes, userSettingsRes, tenantCountRes, killedRes] = await Promise.all([
```

Para:

```typescript
  const [profileRes, tenantAccessRes, empresaRes, featuresRes, userSettingsRes, tenantCountRes, killedRes, moduleColorsRes] = await Promise.all([
```

E adicionar a nova query como último elemento do array, logo depois da query de `killedRes` (antes do `]);` de fechamento):

```typescript
    // Módulos com kill-switch ligado globalmente (afeta todos os tenants)
    adminClient
      .from("module_settings")
      .select("feature_key")
      .eq("kill_switch_enabled", true),

    // Cores de destaque configuradas por módulo (para propagar aos gráficos do cliente)
    adminClient
      .from("module_settings")
      .select("feature_key, accent_color")
      .not("accent_color", "is", null),
  ]);
```

- [ ] **Step 2: Computar o mapa de cores, logo após o cálculo de `killedFeatureKeys`**

De:

```typescript
  const killedFeatureKeys = ((killedRes.data ?? []) as { feature_key: string }[]).map(
    (r) => r.feature_key
  );
```

Para:

```typescript
  const killedFeatureKeys = ((killedRes.data ?? []) as { feature_key: string }[]).map(
    (r) => r.feature_key
  );

  const moduleColors = Object.fromEntries(
    ((moduleColorsRes.data ?? []) as { feature_key: string; accent_color: string }[]).map(
      (r) => [r.feature_key, r.accent_color]
    )
  );
```

- [ ] **Step 3: Passar `moduleColors` para `EmpresaProvider`**

De:

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

Para:

```tsx
    <EmpresaProvider
      empresaId={selectedTenantId ?? ""}
      empresaNome={empresaData?.name ?? ""}
      plan={plan}
      userRole={isAdmin ? "owner" : userRole}
      features={effectiveFeatures}
      killedFeatureKeys={killedFeatureKeys}
      moduleColors={moduleColors}
    >
```

- [ ] **Step 4: Atualizar `lib/contexts/empresa-context.tsx` — substituir o arquivo inteiro**

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
  /** Cor de destaque configurada para um módulo (admin), ou undefined se não houver override */
  getModuleColor: (key: string) => string | undefined;
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
  moduleColors,
}: {
  children:    React.ReactNode;
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  features?:   string[];
  killedFeatureKeys?: string[];
  moduleColors?: Record<string, string>;
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
    getModuleColor: (key) => moduleColors?.[key],
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
Expected: sem erros em `app/(dashboard)/layout.tsx` nem `lib/contexts/empresa-context.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx" lib/contexts/empresa-context.tsx
git commit -m "feat: propagate module accent color to client dashboard via EmpresaProvider"
```

---

### Task 2: Migrar `FinFluxoMensalChart` (prova de conceito)

**Files:**
- Modify: `components/charts/FinFluxoMensalChart.tsx`

**Interfaces:**
- Consumes: `useEmpresa()` de `@/lib/contexts/empresa-context` (Task 1), especificamente `getModuleColor(key: string): string | undefined`.

Este componente já é `"use client"` e já é renderizado dentro da árvore do `EmpresaProvider` (via `app/(dashboard)/dashboard/financeiro/page.tsx`, também client) — `useEmpresa()` pode ser chamado diretamente, sem ajuste de boundary.

- [ ] **Step 1: Adicionar o import de `useEmpresa`**

De:

```tsx
"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, LabelList,
} from "recharts";
```

Para:

```tsx
"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, LabelList,
} from "recharts";
import { useEmpresa } from "@/lib/contexts/empresa-context";
```

- [ ] **Step 2: Calcular a cor dinâmica no topo do componente**

De:

```tsx
export function FinFluxoMensalChart({ data, selectedMes, onMesClick }: Props) {
  const handleClick = (entry: FinFluxoMensalData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);
  const showLabels = data.length <= 8;
```

Para:

```tsx
export function FinFluxoMensalChart({ data, selectedMes, onMesClick }: Props) {
  const { getModuleColor } = useEmpresa();
  const pagamentosColor = getModuleColor("modulo_financeiro") ?? "#ef4444";

  const handleClick = (entry: FinFluxoMensalData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);
  const showLabels = data.length <= 8;
```

- [ ] **Step 3: Substituir os 3 usos do hex fixo `#ef4444` pela cor dinâmica**

De:

```tsx
          <linearGradient id="fluxoPag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
          </linearGradient>
```

Para:

```tsx
          <linearGradient id="fluxoPag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pagamentosColor} stopOpacity={0.9} />
            <stop offset="100%" stopColor={pagamentosColor} stopOpacity={0.5} />
          </linearGradient>
```

E de:

```tsx
        <Bar dataKey="pagamentos" name="Pagamentos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={34} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinFluxoMensalData)}>
```

Para:

```tsx
        <Bar dataKey="pagamentos" name="Pagamentos" fill={pagamentosColor} radius={[4, 4, 0, 0]} maxBarSize={34} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinFluxoMensalData)}>
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/charts/FinFluxoMensalChart.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/charts/FinFluxoMensalChart.tsx
git commit -m "feat: migrate FinFluxoMensalChart to dynamic module accent color"
```

---

### Task 3: Verificação manual end-to-end

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 2: Confirmar que o comportamento padrão (sem cor configurada) não muda**

Subir `npm run dev`. Logar como usuário de uma empresa com o módulo Financeiro ativo. Ir em `/dashboard/financeiro`. Confirmar que o gráfico "Fluxo Mensal" mostra a barra de "Pagamentos" na mesma cor vermelha de sempre (`#ef4444`) — sem nenhuma mudança visual, já que nenhuma cor foi configurada em `/admin/modulos/modulo_financeiro` ainda.

- [ ] **Step 3: Configurar uma cor customizada e confirmar que ela aparece no gráfico**

Logado como admin, ir em `/admin/modulos/modulo_financeiro?aba=aparencia`, escolher uma cor bem diferente (ex. roxo `#8b5cf6`) no color picker, salvar. Voltar pro dashboard do cliente (recarregar `/dashboard/financeiro` — precisa de um novo request ao server component, já que a cor é lida no layout do dashboard). Confirmar que a barra de "Pagamentos" e o gradiente do gráfico agora usam a cor roxa escolhida, não mais o vermelho fixo.

- [ ] **Step 4: Confirmar que outros gráficos do Financeiro (não migrados) continuam com cor fixa**

No mesmo `/dashboard/financeiro`, verificar o gráfico "Contas em Aberto" (`FinContasAbertoChart`) — que não foi tocado neste plano. Confirmar que ele continua com o vermelho fixo de sempre, independente da cor configurada no admin — prova de que a migração é realmente gradual/isolada, e o resto do app não foi afetado.

- [ ] **Step 5: Remover a cor customizada (opcional) e confirmar que volta ao padrão**

Voltar em `/admin/modulos/modulo_financeiro?aba=aparencia` e definir a cor de volta pro tom original (ou deixar como está, já que isso foi só um teste). Confirmar que o gráfico reflete a última cor salva corretamente.

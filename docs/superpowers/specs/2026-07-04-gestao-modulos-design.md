# Gestão de Módulos (Admin) — Design

**Data**: 2026-07-04
**Status**: Aprovado para planejamento de implementação

## Contexto e motivação

Hoje o controle de módulos ("features") é feito exclusivamente **por empresa**: dentro de `/admin/empresas/[id]`, aba "Módulos", o admin marca quais features (`lib/features.ts` → `FEATURES_CATALOG`) aquela empresa tem contratado, gravando em `tenant_features`. Não existe:

- uma visão **módulo-cêntrica** (abrir "Financeiro" e ver todas as empresas que o usam, de uma vez);
- um **kill-switch global** (desativar um módulo para todo mundo de uma vez, ex. manutenção ou descontinuação);
- customização de **cor de destaque** por módulo (gráficos/componentes) com preview;
- rastreio de **quais módulos são mais usados**;
- um canal para registrar **solicitações de alteração** por módulo (backlog interno de pedidos de melhoria);
- um campo de **modelo comercial** por módulo (incluso/avulso), preparando terreno para a tabela `module_subscriptions` (já existe no banco via migration `20260627_module_subscriptions.sql`, mas nunca foi usada por nenhum código).

Esta spec descreve uma nova seção `/admin/modulos` que cobre essas lacunas, complementando (não substituindo) a aba "Módulos" já existente na tela de empresa.

## Escopo

**Dentro do escopo:**
- Tela de listagem de módulos e tela de detalhe por módulo (5 abas: Acesso, Aparência/Comercial, Métricas, Solicitações, Histórico).
- Kill-switch global por módulo, com confirmação e possibilidade de restaurar o estado anterior.
- Cor de destaque única por módulo (global, não por empresa), propagada ao dashboard do cliente.
- Campo de modelo comercial (incluso free/incluso premium/avulso) — **informativo apenas**, sem cobrança real.
- Rastreio de acesso por módulo (nova tabela de eventos) para alimentar "módulos mais acessados".
- Backlog simples de solicitações de alteração por módulo (sem fluxo de atribuição/kanban).
- Log de auditoria das ações acima.
- Um motor de resolução de acesso centralizado (função única, reutilizada por todas as telas e pelo dashboard do cliente) para evitar lógica de permissão duplicada e divergente.

**Fora do escopo (fases futuras, não construir agora):**
- Migrar o catálogo de módulos (`lib/features.ts`) para o banco — criar um módulo novo continua exigindo código/deploy.
- Cobrança real via Asaas conectada a `module_subscriptions`.
- Papel de permissão "gestor" separado — por ora qualquer usuário com acesso a `/admin` (system_admin ou suporte) pode usar a tela sem distinção.
- Exportação CSV da aba Acesso.
- Cor customizável por empresa (só existe uma cor global por módulo).

## Localização e navegação

Novo item de menu em `/admin/modulos`, dentro do grupo **"Sistema"** do sidebar do admin (`app/(admin)/admin/layout.tsx`), ao lado de "Usuários". Sem regra de visibilidade adicional (mesma condição de acesso ao `/admin` já existente).

Rotas:
- `/admin/modulos` — grid com todos os módulos do `FEATURES_CATALOG`.
- `/admin/modulos/[key]` — detalhe de um módulo, abas via `?aba=...` (mesmo padrão de `/admin/empresas/[id]`).

## Modelo de dados

### `module_settings` (overlay editável por módulo — PK `feature_key`)
```sql
feature_key         text primary key   -- bate com Feature.key em lib/features.ts
kill_switch_enabled boolean not null default false
accent_color        text               -- hex, cor única global do módulo
label_override      text               -- opcional, sobrescreve o label do catálogo
descricao_override  text               -- opcional
pricing_model        text not null default 'incluso_free'  -- incluso_free | incluso_premium | avulso
preco_avulso         numeric            -- opcional, só relevante se pricing_model = 'avulso'
updated_at           timestamptz not null default now()
updated_by           uuid references auth.users(id)
```
Ausência de linha para um `feature_key` = usar os valores padrão do catálogo (kill-switch desligado, sem cor customizada, incluso conforme plano). Nenhum dado precisa ser migrado para o sistema continuar funcionando como hoje.

### `tenant_module_access_stats` (analytics — PK composta)
```sql
tenant_id       uuid references tenants(id) on delete cascade
feature_key     text
last_seen_at    timestamptz not null default now()
total_accesses  bigint not null default 1
primary key (tenant_id, feature_key)
```
Alimentada estendendo `requireFeature()`/`requireTenantAccess()` (`lib/api/plan-guard.ts`, `lib/api/tenant-guard.ts`), que já recebem o `featureKey` no momento da chamada mas hoje descartam essa informação. Upsert com throttle de 60s por `(tenant_id, feature_key, user_id)`, mesmo padrão já usado por `tenant_access_stats`.

### `module_change_requests` (backlog de solicitações)
```sql
id            uuid primary key default gen_random_uuid()
feature_key   text not null
tenant_id     uuid references tenants(id)  -- opcional, só informativo
titulo        text not null
descricao     text
status        text not null default 'aberto'  -- aberto | em_andamento | concluido
created_by    uuid references auth.users(id)
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
```

### `kill_switch_revocations` (snapshot para restore)
```sql
feature_key    text not null
tenant_id      uuid references tenants(id)
revoked_at     timestamptz not null default now()
restored_at    timestamptz
primary key (feature_key, tenant_id, revoked_at)
```
Guarda quais empresas tinham o módulo ativo no momento em que o kill-switch foi ligado, para restaurar exatamente esse conjunto ao desligar. Como `tenant_features` nunca é apagada pelo kill-switch, essa tabela serve apenas como **log/auditoria do evento**, não como fonte de verdade do restore (a fonte de verdade continua sendo `tenant_features`).

### `module_audit_log` (histórico de ações)
```sql
id          uuid primary key default gen_random_uuid()
feature_key text not null
event_type  text not null  -- kill_switch_on | kill_switch_off | cor_alterada | acesso_empresa_alterado | preco_alterado
actor_id    uuid references auth.users(id)
detalhes    jsonb
created_at  timestamptz not null default now()
```
Populada automaticamente por cada ação das telas acima — não é uma tela de input manual.

## Motor de resolução de acesso

Novo helper único, ex. `lib/access/resolve-modules.ts`, chamado por **todas** as superfícies que precisam saber "esse módulo está disponível":

```ts
resolveModules(tenantId, userId?) => Array<{
  key: string;
  killedGlobally: boolean;   // module_settings.kill_switch_enabled
  allowedByTenant: boolean;  // tenant_features / fallback de plano
  allowedByGroup: boolean | null;
  allowedByUser: boolean | null;
  effective: boolean;        // AND de todas as camadas acima
}>
```

Modelo: cada camada só pode **restringir**, nunca **conceder** algo negado pela camada acima —
`Kill-switch ∩ Tenant ∩ Grupo (se houver) ∩ Usuário (se houver)`.

Dois modos de consumo:
- **Dashboard do cliente** (`app/(dashboard)/layout.tsx`, `Sidebar.tsx`): usa só `effective` — módulo killed **some completamente** do menu e das rotas, sem estado "desabilitado".
- **Telas de configuração** (aba Módulos da empresa, aba Módulos do usuário, aba Acesso da tela `/admin/modulos/[key]`): usam o objeto completo. Um módulo com `killedGlobally = true` aparece **desmarcado e desabilitado**, com aviso "Desativado globalmente — reative em Módulos → [nome]" (link para `/admin/modulos/[key]`) — nunca some da tela de configuração, para não confundir quem está tentando entender por que não consegue marcar o checkbox.

Centralizar essa lógica num único helper evita que as 3 telas de configuração (empresa/grupo/usuário) e o dashboard do cliente reimplementem a mesma conta de formas diferentes e divirjam com o tempo.

**Importante**: kill-switch (eixo global, "não existe pra ninguém agora") e configuração por tenant/grupo/usuário (eixo de negócio, "essa empresa/usuário optou por não usar") são independentes. Restringir um módulo de um usuário específico dentro de uma empresa continua sendo feito pela camada de usuário já existente (`user_tenant_settings.modulos`) — não precisa e não deve usar o kill-switch para isso.

## Fluxo do kill-switch

1. Admin abre `/admin/modulos/[key]` e clica em "Desativar módulo para todos".
2. Sistema conta quantas empresas têm o módulo ativo hoje (via `tenant_features`) e mostra modal de confirmação com esse número antes de aplicar.
3. Ao confirmar: grava snapshot dessas empresas em `kill_switch_revocations`, seta `module_settings.kill_switch_enabled = true`, registra evento em `module_audit_log`.
4. `tenant_features` **não é alterada** — a contratação de cada empresa continua intacta, só é ignorada pelo motor de resolução enquanto o kill-switch estiver ligado.
5. Efeito imediato: `resolveModules(...).effective` vira `false` para todos → módulo some do menu/rotas do dashboard do cliente; nas telas de configuração o checkbox correspondente fica desmarcado, desabilitado, com aviso.
6. Ao desligar o kill-switch: módulo volta a seguir as regras normais de tenant/grupo/usuário — as mesmas empresas de antes voltam a ver o módulo automaticamente, porque `tenant_features` nunca foi tocada.

## Telas

### Listagem (`/admin/modulos`)
Segue os componentes existentes do admin (`AdminCard`, `AdminPageHeader`, `AdminButton`, tokens `--adm-*`, sem paleta nova). Grid de cards, um por módulo do catálogo, mostrando: ícone + label, badge de categoria (core/premium, com texto visível, não só cor), badge de status ("Ativo" / "Desativado globalmente"), contador "X de Y empresas com acesso", swatch da `accent_color`. Módulos com `disponivel: false` no catálogo aparecem em seção separada no fim, sem contadores.

### Detalhe (`/admin/modulos/[key]`)
Header com nome do módulo e botão "Desativar módulo para todos" sempre visível. Abas via `?aba=`:

- **Acesso**: tabela de empresas com toggle de acesso (espelho invertido da aba "Módulos" da tela de empresa), incluindo ação em massa (ex. "ativar para todas as empresas Premium"). Empresas afetadas pelo kill-switch aparecem com o aviso descrito acima.
- **Aparência/Comercial**: color picker para `accent_color` com **preview ao vivo** (mini-gráfico + card de exemplo atualizando sem salvar) e os campos de `pricing_model`/`preco_avulso`.
- **Métricas**: ranking de empresas por `tenant_module_access_stats.total_accesses`, com "último acesso" relativo.
- **Solicitações**: lista de `module_change_requests`, botão "Nova solicitação" (título, descrição, empresa opcional), badges de status.
- **Histórico**: lista de `module_audit_log`, somente leitura.

## Propagação da cor para o dashboard do cliente

`app/(dashboard)/layout.tsx` passa a buscar também `module_settings.accent_color` de cada módulo ativo e expor via `EmpresaProvider` (`lib/contexts/empresa-context.tsx`), com uma função `getModuleColor(featureKey)` ao lado do `hasFeature` já existente. Componentes de gráfico/cards de cada módulo passam a consumir essa cor em vez de um hex fixo, com fallback para o valor atual quando não houver override — migração **gradual**, módulo por módulo, sem precisar trocar tudo de uma vez.

## Permissões

Sem distinção de papel adicional por enquanto: qualquer usuário com acesso a `/admin` (`is_system_admin` ou `is_suporte`) tem acesso completo à tela de Gestão de Módulos, incluindo kill-switch. Revisitar se surgir necessidade de restringir ações mais sensíveis (ex. kill-switch) a `is_system_admin` apenas.

## Papel do Codex

Você deve atuar apenas em alterações pequenas, seguras e rastreáveis no projeto LC Gestor.

Para tarefas de frontend, foque em layout, Tailwind, shadcn/ui, responsividade, textos, cards, tabelas, botões, modais, estados visuais e acabamento visual.

Não atue como arquiteto de backend, banco, autenticação, sincronização ou segurança sem autorização explícita.

---

## Stack do projeto

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui customizado
- Supabase Auth
- Supabase PostgreSQL com RLS
- Dashboard SaaS multi-tenant
- Supabase Edge Functions para sincronização

---

## Permitido em tarefas frontend

Você pode alterar:

- componentes visuais;
- classes Tailwind;
- estrutura visual de telas;
- textos e microcopy;
- espaçamentos;
- responsividade;
- estados loading/empty/error;
- cards;
- botões;
- badges;
- tabelas;
- modais;
- fundos visuais e animações CSS leves.

---

## Proibido sem autorização explícita

Não altere:

- autenticação;
- login logic;
- cookies;
- middleware;
- tenant;
- permissões;
- RLS;
- banco de dados;
- migrations;
- schema SQL;
- Supabase Edge Functions;
- sincronização;
- filas de sync;
- APIs;
- Route Handlers;
- Server Actions sensíveis;
- cálculos de KPI;
- RPCs;
- queries SQL;
- service role;
- variáveis de ambiente;
- credenciais;
- tokens;
- URLs sensíveis;
- integração com API MaxData.

Se uma alteração visual exigir mexer em qualquer uma dessas áreas, pare e explique antes.

---

## Regras de implementação

Antes de alterar:

1. Identifique o arquivo principal.
2. Informe quais arquivos pretende alterar.
3. Explique a menor mudança necessária.
4. Não altere arquivos fora do escopo.

Durante a alteração:

1. Faça a menor mudança possível.
2. Não refatore componente inteiro sem necessidade.
3. Preserve props, states, handlers e tipos existentes.
4. Preserve filtros, dados reais e comportamento atual.
5. Preserve responsividade.
6. Não adicione dependências novas sem autorização.
7. Não use mock no lugar de dado real.

Depois de alterar:

1. Informe arquivos alterados.
2. Resuma o que mudou.
3. Informe como testar visualmente.
4. Rode, se disponível:

```bash
npm run lint
npm run typecheck
npm run build

## Regras obrigatórias

### O que você PODE fazer
- Ajustar classes Tailwind (espaçamento, cores, tipografia, responsividade)
- Criar ou editar componentes puramente visuais (`"use client"` ou Server Component sem side effects)
- Adicionar ícones Lucide React
- Corrigir layout quebrado, overflow, alinhamento
- Melhorar acessibilidade visual (contraste, foco visível)
- Ajustar tabelas, cards, modais, badges e formulários já existentes

### O que você NÃO deve tocar
- Arquivos em `app/actions/` — Server Actions
- Arquivos em `supabase/functions/` — Edge Functions Deno
- Arquivos em `lib/supabase/` — clientes Supabase
- Arquivos em `app/api/` — Route Handlers
- Lógica de autenticação, cookies ou redirecionamentos
- Queries ao banco de dados
- Variáveis de ambiente ou configurações de build

---

## Padrões visuais do projeto

### Paleta de cores
- Fundo do dashboard: `bg-white` / `bg-slate-50`
- Sidebar admin: `bg-slate-900` com texto `text-slate-300`
- Acento principal: `text-blue-600` / `bg-blue-600`
- Acento cyan (sync): `#06b6d4` (via CSS var `--accent-cyan`)
- Destrutivo: `text-red-600` / `bg-red-50`
- Sucesso: `text-emerald-600` / `bg-emerald-50`
- Atenção: `text-amber-600` / `bg-amber-50`

### Tipografia
- Títulos de seção: `text-lg font-semibold text-slate-900`
- Labels de tabela: `text-xs font-semibold uppercase tracking-wider text-slate-500`
- Corpo: `text-sm text-slate-600`
- Código/IDs: `font-mono`

### Botões
- Primário: `bg-slate-900 text-white hover:bg-slate-700`
- Secundário: `border border-slate-200 text-slate-600 hover:bg-slate-50`
- Destrutivo: `border border-red-200 text-red-600 hover:bg-red-50`
- Tamanho padrão: `px-3 py-1.5 text-sm rounded-md`

### Cards e containers
- Cards: `bg-white border border-slate-200 rounded-xl`
- Tabelas: `rounded-xl border border-slate-200 overflow-hidden`
- Cabeçalho de tabela: `bg-slate-50`
- Divisores de linha: `divide-y divide-slate-100`

### Modais
- Overlay: `fixed inset-0 z-50 bg-black/40 backdrop-blur-sm`
- Painel: `bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm`

### Badges de status
- Ativo/Sucesso: `bg-emerald-100 text-emerald-700`
- Inativo/Neutro: `bg-slate-100 text-slate-500`
- Processando: `bg-blue-100 text-blue-700`
- Erro: `bg-red-100 text-red-700`
- Pausado/Atenção: `bg-amber-100 text-amber-700`
- Formato: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium`

---

## Convenções de código

- Sem comentários explicando o que o código faz — apenas o *porquê* quando não óbvio
- Sem emojis em código ou comentários
- Componentes Client: declare `"use client"` na primeira linha
- Imports de ícones: `import { IconName } from "lucide-react"` — nunca inline SVG exceto se estritamente necessário
- Não crie arquivos de documentação além deste

---

## Contexto multi-tenant

O dashboard exibe dados de uma única empresa por vez (tenant selecionado via cookie `selected_tenant_id`). O painel admin (`/admin/*`) é exclusivo para administradores do sistema (`is_system_admin = true`). Não confunda os dois contextos visuais — sidebar admin é escura, dashboard do cliente é clara.

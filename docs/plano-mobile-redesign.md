# Plano — Redesign Mobile do LC Dashboard

> Documento de execução. Escrito para ser seguido por um agente (Fable) sem contexto
> adicional da conversa que o originou — cada fase lista arquivos exatos, specs de
> componente e critério de "pronto". Não é um brainstorm: é o plano já decidido.

## 0. Diagnóstico (por que o mobile não funciona hoje)

Investigação no código (não suposição) encontrou 3 classes de problema, em ordem de gravidade:

1. **Admin ("Centro de Comando") não tem NENHUM tratamento mobile.**
   `app/(admin)/admin/layout.tsx` renderiza um `<aside className="flex w-60 shrink-0 ...">`
   sempre visível, sem `hidden md:flex`, sem drawer, sem bottom nav. Em 375px de largura
   o conteúdo fica espremido em ~135px. É o maior buraco e a prioridade #1.

2. **Duas fontes de navegação desconectadas.**
   O dashboard cliente (`components/layout/Sidebar.tsx`) já tem uma bottom tab bar mobile
   funcional (`md:hidden`, `env(safe-area-inset-bottom)`, linhas ~753–799) — mas ela é uma
   lista hardcoded de 5 itens, separada da árvore `GRUPOS` que alimenta o menu desktop.
   Seções inteiras (ex.: sub-itens de Relatórios) não aparecem no mobile hoje.

3. **Inconsistência de componentes** que gera bugs específicos de mobile:
   - **KPI cards**: 4 implementações paralelas (`components/ui/KpiCard.tsx`,
     `components/home/KpiCard.tsx`, `components/dashboard/kpi-card.tsx`,
     `components/ui/KpiBar.tsx`) sem grid responsivo próprio — funciona quando a página
     já define `grid-cols-2 md:grid-cols-4`, quebra quando não define.
   - **`KpiBar.tsx`**: strip horizontal com `overflowX: 'auto'` e itens `minWidth: 130–200px`,
     sem nenhuma dica visual de scroll (sem sombra/gradiente) — usuário não sabe que pode
     arrastar.
   - **Gráficos (Recharts)**: `ResponsiveContainer` cuida da largura, mas a **altura é sempre
     um número fixo em px** (`height={230}`, `height={280}`, `ROW2_HEIGHT = 320` em
     `components/produtos/ProdutosDashboard.tsx`) — em telas pequenas isso vira scroll
     infinito de caixas de 300–380px empilhadas. `FinFaturamentoChart.tsx` ainda gasta
     ~150px de margem fixa (`right: 48` + eixo Y esquerdo `width={60}` + direito `width={38}`)
     antes de sobrar área de plot — em 375px isso é quase metade da tela.
   - **Tabelas**: 3 padrões coexistindo — shadcn `<Table>` (ok, tem scroll), `<table>` cru com
     wrapper manual (ok mas denso, fontes de 10.5–12.5px), e `<table>` **sem** wrapper de
     scroll (`components/admin/ModuloMetricasTab.tsx`, usa `overflow-hidden` que corta
     conteúdo em vez de rolar). Só um lugar (`components/dashboard/TabelaVendas.tsx`) já
     resolve isso direito: grid CSS com colunas que somem por breakpoint.
   - **Sem componente de segmented control reutilizável** — o toggle "Mensal/Semanal/Hoje"
     é reimplementado à mão em cada tela via uma classe CSS solta (`.seg-btn`).
   - **Sem drawer/bottom-sheet** — só existe `components/ui/dialog.tsx` (modal central fixo,
     `max-w-lg`), não uma variante que abre de baixo pra cima (melhor ergonomia mobile para
     filtros/formulários).

O que **já funciona** e deve ser reaproveitado, não recriado:
- Bottom tab bar do `Sidebar.tsx` (mecanismo é sólido, só falta unificar a fonte de dados)
- `Header.tsx`: troca `<select>` mobile por pill group desktop no seletor de período
- `TabelaVendas.tsx` + `.tabela-vendas-grid` no `globals.css`: referência de "tabela vira
  lista responsiva"
- `viewport` já configurado corretamente em `app/layout.tsx` (`viewportFit: "cover"`,
  `themeColor`), PWA manifest já existe
- Tipografia fluida com `clamp()` já usada em `KpiCard.tsx`/`KpiBar.tsx`

**Não vamos mexer em**: tema claro/escuro existente, cores de marca já usadas no desktop,
nenhuma lógica de dados/API. Isto é puramente layout/CSS/componentes de apresentação.

---

## 1. Direção visual

A imagem de referência (mock genérico de e-commerce) não é o produto real — o LC Dashboard
mostra Vendas, Financeiro, Produtos/Estoque, Clientes e O.S de lojas de autopeças
(MaxManager/BATAUTO), usado por lojista no celular entre um cliente e outro. A tradução não é
"pintar tudo de preto e rosa" — é pegar a **estrutura** do mock (cards com número grande +
barra de progresso colorida, segmented control sólido, gráfico simplificado, bottom nav com
ícone+label) e montá-la com os tokens que a marca já tem, evitando recolorir o produto inteiro.

### Paleta

Reaproveitar os tokens existentes em `app/globals.css` (claro e escuro já definidos) e
adicionar **apenas 2 tokens novos**, no mesmo padrão de nomenclatura `--accent-*` já usado:

| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Tinta primária (texto, série 1 de gráfico, pill selecionado) | `--text-primary` (já existe) | `#0f172a` | `#f1f5f9` |
| Neutro de comparação (série 2 de gráfico, trilho de progresso) | `--chart-mist` (**novo**) | `#e2e8f0` | `#1f2937` |
| Destaque (série 3 de gráfico, dot de "novo", 1 dos 4 tints de KPI) | `--accent-rose` (**novo**) | `#fb7185` | `#f43f5e` |
| Interativo (já existe, mantém papel de link/ícone ativo) | `--accent-cyan` | `#1d4ed8` | `#00e5ff` |
| Card | `--bg-card` (já existe) | `#ffffff` | `#111827` |

`--accent-rose` é a única cor nova de fato — cabe no enum que já existe
(`--accent-cyan/green/red/yellow/purple/orange`) como um 7º tom, com um papel específico
(destaque/3ª série), não uma repintura.

**Os 4 KPI cards do topo (padrão em toda página tipo "home") usam 4 tints fixos, sempre na
mesma ordem**, para virar a assinatura visual do redesign:

1. Faturamento/Receita → tint `--text-primary` (grafite/tinta — a métrica "âncora")
2. Pedidos/Vendas → tint `--accent-cyan` (já é a cor interativa da marca)
3. Clientes → tint `--chart-mist` (neutro)
4. Produtos/Estoque → tint `--accent-rose` (destaque)

A barra sob cada card **não é decorativa** — mostra progresso real do período (ex.: dia do
mês decorrido vs. meta, ou participação da métrica no total), com um `title`/tooltip
explicando o que representa. Isso resolve o "0% 70%" sem sentido do mock de referência.

### Tipografia

Manter o par já carregado em `app/layout.tsx` — não trocar fontes de um produto já em
produção:
- **Inter** (`--font-body`) — labels, texto de UI, cabeçalhos de seção
- **DM Mono** (`--font-numeric`) — todo número (KPI, moeda, %) em `tabular-nums`

Escala mobile explícita (resolve o problema de `fontSize: 10.5px` espalhado no código):

| Uso | Tamanho | Peso | Fonte |
|---|---|---|---|
| Valor de KPI | `clamp(20px, 6vw, 26px)` | 600 | DM Mono |
| Label de KPI | `12px` | 500 | Inter |
| Título de seção | `15px` | 600 | Inter |
| Célula de tabela/lista | `13px` (mínimo — nunca abaixo disso) | 400 | Inter |
| Eixo de gráfico | `11px`, máx. 4–5 ticks visíveis | 400 | Inter |

### Layout — conceito

```
Shell do dashboard cliente (< 768px)
┌─────────────────────────────┐
│ ← Vendas              🔍ⵗ   │  Header 56px, sticky
├─────────────────────────────┤
│ ┌────────────┐┌────────────┐│
│ │ Faturamento││  Pedidos   ││  grid-cols-2
│ │ R$ 45,2 mil││    210     ││  KpiTile (specs §3.1)
│ │ ▰▰▰▰▰▱▱▱▱▱ ││ ▰▰▰▰▰▰▰▱▱▱ ││  progress tint 1 e 2
│ └────────────┘└────────────┘│
│ ┌────────────┐┌────────────┐│
│ │  Clientes  ││  Produtos  ││
│ │            ││            ││  tint 3 (mist) e 4 (rose)
│ └────────────┘└────────────┘│
├─────────────────────────────┤
│ Faturamento      [M][S▮][H] │  SegmentedControl (§3.2)
│ ┌─────────────────────────┐ │
│ │      área/linha          │ │  height: clamp(180px,42vh,240px)
│ │  ink fill + mist ref.    │ │  (§3.3 — nunca px fixo)
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Últimas vendas         Ver› │
│ ⬤ João Silva     +R$120,00  │  ResponsiveRowList (§3.4)
│ ⬤ Maria Souza     +R$85,00  │
├─────────────────────────────┤
│ [Home][Vendas][Estoque][Cli]│  bottom nav unificado (§2)
│         [Mais ⋯]             │
└─────────────────────────────┘
```

```
Shell do admin (< 768px) — hoje não existe nada disso
┌─────────────────────────────┐
│ ☰   Centro de Comando    ⚙  │  topbar 52px
├─────────────────────────────┤
│                              │
│   conteúdo full-width        │
│                              │
└─────────────────────────────┘
☰ abre um Drawer (Sheet) da esquerda com os MESMOS itens do <aside> desktop.
```

### Assinatura do redesign (o risco assumido de propósito)

Não é uma cor ou um efeito — é **resolver as 3 fontes de verdade fragmentadas em 1 cada**:
nav (desktop `GRUPOS` + bottom nav viram uma árvore só), tabela (3 padrões viram 1
`ResponsiveRowList` genérico a partir do que `TabelaVendas.tsx` já faz certo), e altura de
gráfico (todo `ResponsiveContainer height={n}` fixo vira `clamp()` relativo ao viewport). É a
decisão certa para uma ferramenta operacional já em produção: o ganho visível pro lojista vem
de consistência e legibilidade, não de reinventar a marca.

---

## 2. Fundações técnicas (fazer antes de tocar em qualquer página)

### 2.1 Breakpoint `xs` no Tailwind

`tailwind.config.ts` — **substituir** (não usar `extend`, para não bagunçar a ordem de
geração das media queries — `extend.screens` pode inserir `xs` depois de `2xl` no objeto
mesclado e quebrar a cascata mobile-first):

```ts
theme: {
  screens: {
    xs: "420px",
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1400px",
  },
  container: { ... } // mantém como está
  extend: { ... }     // mantém como está
}
```

### 2.2 Tokens novos em `app/globals.css`

Adicionar `--chart-mist` e `--accent-rose` nos 3 blocos existentes (`:root`, `.light`,
dark — ao lado de `--accent-cyan` etc.):

```css
/* :root e .light */
--chart-mist: #e2e8f0;
--accent-rose: #fb7185;

/* bloco dark */
--chart-mist: #1f2937;
--accent-rose: #f43f5e;
```

### 2.3 Hook `useMediaQuery`

Não existe nenhum hoje (`hooks/` nem existe no repo). Criar `hooks/use-media-query.ts`:

```ts
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);
  return matches;
}
```
Usado só onde CSS puro não resolve (decidir entre renderizar `<Drawer>` vs `<aside>` no admin).

### 2.4 CSS morto para limpar

`globals.css` já tem `.table-scroll-x` e `.filters-mobile-stack` definidos e **nunca usados**
(confirmado por busca no código). Decidir por página durante a Fase 3/4: ou usar essas
classes nos lugares certos (`ModuloMetricasTab.tsx` é candidato óbvio pro `.table-scroll-x`),
ou remover se o `ResponsiveRowList` novo as tornar obsoletas. Não deixar as duas coisas.

Remover também os arquivos confirmados sem importação alguma:
`components/dashboard/nav-links.tsx`, `components/dashboard/loja-selector.tsx`,
`components/dashboard/periodo-selector.tsx`.

---

## 3. Componentes novos / refatorados

### 3.1 `components/ui/KpiTile.tsx` (substitui as 4 implementações paralelas)

Um único componente, usado em toda página com métricas:

```tsx
type KpiTileProps = {
  label: string;
  value: string;            // já formatado (BRL, número, %) pelo caller
  tint: "ink" | "cyan" | "mist" | "rose";
  progress?: { value: number; label: string }; // 0-100, label vira title="..."
  icon?: React.ReactNode;
};
```
- Grid do caller: `grid grid-cols-2 gap-3 md:grid-cols-4` (2 colunas até `md`, nunca 1 —
  1 coluna desperdiça espaço em 375px com números curtos).
- Valor em DM Mono, `clamp(20px,6vw,26px)`, `overflowWrap: "anywhere"` (mantém o fix que já
  existia em `components/home/KpiCard.tsx` pra moeda longa).
- Barra de progresso: `<div role="img" aria-label={progress.label}>`, altura 4px, trilho
  `--chart-mist`, preenchido com a cor do `tint`.
- Migrar, nesta ordem, todo lugar que usa `components/ui/KpiCard.tsx`,
  `components/home/KpiCard.tsx`, `components/dashboard/kpi-card.tsx` → apagar os 3 originais
  no final da Fase 5 (não antes — manter até todo caller migrado, para não quebrar build).

### 3.2 `components/ui/SegmentedControl.tsx` (substitui o `.seg-btn` ad-hoc)

```tsx
type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
};
```
- Pílula selecionada: fundo `--text-primary`, texto invertido (`--bg-card`), `rounded-full`.
- Não selecionada: texto `--text-secondary`, sem fundo.
- `role="tablist"` / cada opção `role="tab"` + `aria-selected` (acessibilidade — o mock de
  referência não tem isso, mas o produto real precisa).
- Usado no lugar de todo `.seg-btn` manual e no fallback `<select>` do `Header.tsx` **não**
  muda — o `<select>` mobile do Header já é a solução certa para aquele caso (economiza
  espaço horizontal quando há 4+ opções de período), o `SegmentedControl` novo é para os
  toggles de 2-3 opções tipo "Mensal/Semanal/Hoje" espalhados pelas páginas.

### 3.3 Altura de gráfico — regra única para todo `ResponsiveContainer`

Banir `height={230}` / `height={280}` / `ROW2_HEIGHT = 320` como número mágico solto.
Centralizar em `components/charts/chart-heights.ts`:

```ts
export const CHART_HEIGHT = {
  compact: "clamp(160px, 38vh, 220px)",  // sparkline/mini
  default: "clamp(200px, 45vh, 280px)",  // gráfico principal de uma seção
  featured: "clamp(240px, 55vh, 340px)", // gráfico único de destaque na página
} as const;
```
`ResponsiveContainer` aceita `height` como string CSS — trocar todo `height={230}` por
`height={CHART_HEIGHT.default}` (ajustar caso a caso qual papel cada gráfico tem hoje).
Em `components/produtos/ProdutosDashboard.tsx`, os `bodyStyle={{ height: ROW2_HEIGHT, ... }}`
somem — o `ChartCard` recebe a altura do token acima e, abaixo de `md`, `overflow: visible`
(mesma técnica que `.abc-unified-body` já faz em `globals.css` linhas 544-548 — só
generalizar pros outros 2 blocos).

Em `FinFaturamentoChart.tsx`: abaixo de `md`, reduzir margens (`margin={{ top:4, right:8,
left:0, bottom:0 }}` em vez de `right:48`), esconder o eixo Y direito (`hide` no `<YAxis
yAxisId="right">`) e limitar a 1 série visível por vez com o `SegmentedControl` de 3.2 para
trocar entre "Faturamento" / "Meta" em vez de plotar as duas linhas simultâneas — resolve o
aperto de 150px de margem de uma vez.

Paleta de série do gráfico (aplica a **todo** gráfico Recharts do produto, não só
Faturamento): série 1 = `var(--text-primary)` (ink), série 2 = `var(--chart-mist)`, série de
destaque/meta = `var(--accent-rose)`. Isso é o que traduz literalmente a "aparência" pedida
na imagem de referência (preto + cinza-claro + rosa nas barras).

### 3.4 `components/ui/ResponsiveRowList.tsx` (generaliza `TabelaVendas.tsx`)

Extrai o padrão que já funciona (`tabela-vendas-grid` + `hidden sm:block`/`hidden md:block`
por coluna) num componente configurável por colunas:

```tsx
type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  minBreakpoint?: "sm" | "md" | "lg"; // esconde abaixo desse breakpoint
  width: string; // usado no grid-template-columns
};
type ResponsiveRowListProps<T> = { columns: Column<T>[]; rows: T[]; keyField: keyof T };
```
Migrar para este componente, em ordem de prioridade:
1. `components/admin/ModuloMetricasTab.tsx` (é o único caso hoje com `overflow-hidden`
   cortando conteúdo em vez de rolar — bug real, não só falta de polish)
2. `components/produtos/AcaoTable.tsx` (13 colunas, fontes 10.5-12.5px — reduzir a 4-5
   colunas essenciais no mobile via `minBreakpoint`, resto vira `md:`/`lg:`)
3. `components/os/ServiceOrderList.tsx` e `AuditLogTable.tsx` (já têm scroll seguro via
   `<Table>` do shadcn — menor urgência, migrar por consistência visual, não por bug)

Tabelas que ficam como estão: `components/relatorios/ComissaoRecebimentoPage.tsx` (usa
`.relatorio-table-wrapper`, já tem scroll horizontal com momentum — funcional, só não é
"card list", aceitável para uma tabela de conciliação financeira densa que faz sentido rolar
lateralmente mesmo no desktop).

### 3.5 `components/ui/drawer.tsx` (bottom-sheet / side-sheet, não existe hoje)

Radix já é dependência do projeto (via outros primitivos shadcn) — implementar como
`Dialog` do Radix com posicionamento diferente (`data-[state=open]:slide-in-from-bottom` em
vez de centralizado), reaproveitando o padrão de `components/ui/dialog.tsx` como base. Duas
variantes:
- `side="left"`: usado pelo drawer de navegação do admin (§4, Fase 1)
- `side="bottom"`: usado por qualquer filtro/formulário que hoje abre em `dialog.tsx` central
  e fica apertado em 375px (avaliar caso a caso na Fase 4, não migrar tudo por padrão)

### 3.6 Nav unificada

Elevar a árvore `GRUPOS` de `components/layout/Sidebar.tsx` para um módulo compartilhado
(`lib/nav/grupos.ts` ou similar) que tanto o rail desktop quanto a bottom nav mobile
consomem. A bottom nav mostra os 4 primeiros grupos + um 5º item **"Mais"** que abre o
`Drawer` (side="left", reaproveitando 3.5) com a árvore completa — assim nenhuma seção fica
inacessível no mobile como acontece hoje.

---

## 4. Fases de execução

Cada fase termina em um estado que builda e funciona — não deixar nada pela metade entre
fases.

**Fase 0 — Fundação** (§2 completo): breakpoint `xs`, tokens novos, hook, limpeza de CSS/
arquivos mortos. Nenhuma página muda visualmente ainda.

**Fase 1 — Admin shell** (maior bug, prioridade #1):
`app/(admin)/admin/layout.tsx` ganha `hidden md:flex` no `<aside>` atual + topbar mobile
(52px, botão ☰) + `Drawer` (3.5) com os mesmos links do aside. Testar as 5 sub-rotas
(`empresas`, `usuarios`, `clientes`, `modulos`, `acessos`) em 375px.

**Fase 2 — Componentes base** (§3.1 a 3.4 implementados e cobertos por pelo menos 1 storybook
visual ou página de teste): `KpiTile`, `SegmentedControl`, `chart-heights.ts`,
`ResponsiveRowList`.

**Fase 3 — Dashboard cliente, páginas de maior tráfego**:
`app/(dashboard)/home`, `app/(dashboard)/dashboard` (Vendas), `financeiro`, `clientes` —
migrar KPIs para `KpiTile`, gráficos para alturas em `clamp()`, nav unificada (§3.6).

**Fase 4 — Restante**:
`produtos` (inclui o caso complexo de `ProdutosDashboard.tsx` com 3 alturas fixas),
`os` (Ordens de Serviço), `fiscal/transmissao-xmls`, `relatorios/comissao-recebimento`,
`clientes` do admin, `sincronizacao-inicial`.

**Fase 5 — Polish e remoção de código morto**:
apagar as 3 implementações de KPI card substituídas, apagar `.table-scroll-x`/
`.filters-mobile-stack` se não usadas, revisão de contraste dos 2 tokens novos em ambos os
temas, checklist de QA abaixo em todas as rotas.

---

## 5. Checklist de QA (rodar em cada página, nas 2 fases finais)

Viewports: **375×667** (iPhone SE — o mais apertado ainda relevante), **390×844** (iPhone
padrão), **768×1024** (tablet/breakpoint `md`).

- [ ] Nenhum scroll horizontal na página inteira (só dentro de containers explícitos de
      tabela/lista)
- [ ] Todo texto ≥ 13px (exceto legendas de eixo de gráfico, mínimo 11px)
- [ ] KPI com valor longo (ex. `R$ 1.234.567,89`) não estoura o card
- [ ] Gráfico visível sem rolar a página inteira dentro de outro scroll (nada de scroll
      aninhado)
- [ ] Bottom nav não sobrepõe conteúdo (checar `.mobile-safe-bottom` aplicado)
- [ ] Toggle de período (`SegmentedControl` ou `<select>`) alcançável com o polegar (zona
      inferior/central da tela, não escondido no topo)
- [ ] Admin: drawer abre/fecha, todos os 5 links navegam
- [ ] Dark mode: os 2 tokens novos (`--chart-mist`, `--accent-rose`) com contraste adequado
      sobre `--bg-card` escuro

---

## 6. O que NÃO fazer

- Não recolorir o produto inteiro para preto/rosa — só os 2 tokens novos descritos em §1.
- Não trocar Inter/DM Mono por outras fontes.
- Não tocar em lógica de dados, chamadas de API, ou regras de negócio — isto é 100%
  apresentação.
- Não quebrar o layout desktop existente — toda mudança é aditiva via breakpoints
  (`md:`/`lg:`), nunca removendo uma classe desktop que já funciona.
- Não apagar as 4 implementações de KPI card / arquivos mortos antes de confirmar que todo
  caller foi migrado (Fase 5, não antes).

# LC Gestor — Contexto Completo do Projeto

## Stack
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (ref: usokjuxnttfhffuvkhec) — PostgreSQL + Edge Functions + Storage
- Upstash Redis
- Vercel Hobby (lucasruanaf-4052)
- Cloudflare Tunnel por cliente (Type=HTTP obrigatório)
- GitHub: maxdatalc/lc-dashboard (privado, branch main)

## URLs
- Produção: app.lcgestor.com.br
- ECOMMMERCE: TERÁ OUTRO URL

## Multi-tenancy
- tenant → lojas[] (cada empId = 1 loja)
- Clientes ativos:
  - Batauto (teste): lojaId 78475a01-8956-4706-9a87-13ecfc3d55cf
  - Supermercado Maxdata: lojaId c10c6500-3e7e-4a7f-8a92-387f77cd962e

## Schema Principal
```sql
tenants, lojas (sync_services_enabled, is_active)
vendas (source, tipo, cfop, atendente_id, cpf_cnpj)
  UNIQUE: loja_id + external_id + source
venda_itens (loja_id, venda_external_id, produto_external_id,
             produto_nome, quantidade, valor_unitario, valor_total)
venda_pagamentos (loja_id, venda_external_id, forma_pagamento, valor, parcelas)
produtos (loja_id, external_id, codigo, nome, grupo_nome, sub_grupo_nome,
          fabricante, preco_venda, valor_custo, estoque_atual)
vendedores (loja_id, external_id, nome, apelido, email, perfil)
clientes, financeiro
sync_log, sync_inicial, sync_queue
  sync_queue tipos: vendas | os | produtos | itens | atendente
cfop_classificacoes
ecommerce_lojas, ecommerce_produtos, ecommerce_pedidos (em breve)
```

## Arquitetura de Sync

### sync-erp (Edge Function, pg_cron */15min)
- Janela: últimos 40 minutos
- Busca: vendas novas + pagamentos
- Salva atendente_id em cada venda

### sync-erp-daily (Edge Function, pg_cron 0 19 * * *)
- Janela: últimas 24h
- Busca: vendas + pagamentos + produtos + vendedores

### sync-queue-processor (Edge Function, pg_cron * * * * *)
- Processa fila sync_queue
- Tipos: vendas | os | produtos | itens | atendente
- Reset automático de jobs travados após 10min
- MAX_JOBS_PARALELOS = 3

### sync-erp-inicial (Edge Function)
- Chamada pelo frontend (SyncInicialModal)
- Recebe { lojaId, dataInicial, dataFinal }
- Processa página por página sem acumular memória

### sync-direto (Next.js API, maxDuration=300)
- app/api/admin/sync-direto/route.ts
- Substitui Edge Function para sync inicial manual
- Aceita pageLimit e startPage

## pg_cron jobs ativos
- jobid=1: sync-erp (*/15 * * * *)
- jobid=2: sync-financeiro (pausado)
- jobid=4: sync-queue-processor (* * * * *)
- jobid=5: sync-erp-daily (0 19 * * *)

## Dashboard — Funcionalidades

### KpiBar (horizontal)
- Venda (valor + qtd vendas + devoluções)
- Custo (calculado via venda_itens × produtos.valor_custo em lotes de 500)
- Ticket Médio
- Total Lucro = Venda - Custo - Devoluções
- Qtde Clientes (únicos por CPF/CNPJ no período)

### Gráficos funcionando
- Faturamento Mensal (recharts barras)
- Pessoa Física vs Jurídica (donut)
- Top 50 Produtos (click para expandir: grupo, cód, custo, margem)
- Top 50 Clientes (hover expandido)
- Formas de Pagamento (donut)
- Top 10 Vendedores (com cross-filtering)

### Cross-filtering global
- FilterContext em lib/contexts/filter-context.tsx
- ActiveFilterBar component
- Clicar em vendedor filtra todo o dashboard

## Painel Admin
- Visão geral, lista clientes, criar cliente N lojas
- SyncInicialModal: abas Vendas | O.S. | Produtos | Itens | Atendentes
- Botão "Sync Completo" enfileira tudo de uma vez
- Modo background: fecha modal, sync continua
- Polling 5s, badge "Sync ativo", botão "Ver progresso"
- Reset automático de jobs com erro ao reabrir modal

## Regras Técnicas Obrigatórias
- Cloudflare Tunnel: Type=HTTP (nunca HTTPS — erro 525)
- OS: source='os', external_id positivo, tipo='venda'
- Status vendas: 'finalizada','cancelada','pendente'
- Join venda_itens: via venda_external_id (não venda_id)
- Pagamentos negativos = estornos (não contar)
- git pull --rebase antes de push
- RLS ativo em todas as tabelas
- Frontend nunca acessa API MaxData diretamente
- Token JWT nunca exposto no frontend

## CFOPs Mapeados
Vendas: 5101,5102,5401,5403,5405,6101,6102,6401,6403,6404
Devoluções: 1201,1202,1410,1411,2201,2202,2410,2411
Serviços: 5900,5901,5902,5933,5949
Transferências: 1152,2152,5152,6152

## Módulos Pendentes
- Módulo Financeiro (contas a receber/pagar)
- Tela de Login com branding LC Gestor
- Responsividade mobile (prompt gerado)
- E-commerce (novo chat dedicado)

## Variáveis de Ambiente Necessárias
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

## Separação de Responsabilidades (IMPORTANTE)
Dashboard chat altera:
  app/(dashboard)/**, components/dashboard/**
  app/api/dashboard/**, supabase/functions/sync-*

E-commerce chat altera:
  app/(ecommerce)/**, app/loja/**
  components/ecommerce/**
  app/api/ecommerce/**

COMPARTILHADO (avisar antes de alterar):
  lib/supabase/**, lib/contexts/**
  components/ui/**, middleware.ts, app/layout.tsx

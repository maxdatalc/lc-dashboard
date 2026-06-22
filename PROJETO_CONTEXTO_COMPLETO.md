# LC Gestor — Contexto Completo do Projeto

## Stack
- Next.js 14 App Router, TypeScript, Tailwind v3, shadcn/ui (componentes criados manualmente — shadcn@latest é incompatível com Tailwind v3)
- Supabase (ref: usokjuxnttfhffuvkhec) — PostgreSQL + Storage
- Upstash Redis — cache de queries Bridge SQL
- Vercel Hobby (lucasruanaf-4052)
- GitHub: maxdatalc/lc-dashboard (privado, branch main)

## URLs
- Produção: app.lcgestor.com.br

## Multi-tenancy
- tenant → lojas[] (cada empId do MaxManager = 1 loja)
- Clientes ativos:
  - Batauto (teste): lojaId 78475a01-8956-4706-9a87-13ecfc3d55cf
  - Supermercado Maxdata: lojaId c10c6500-3e7e-4a7f-8a92-387f77cd962e

---

## Arquitetura: Bridge SQL (atual)

O dashboard **não sincroniza dados** do ERP para o Supabase. Em vez disso, cada consulta executa diretamente no banco MSSQL do cliente via Bridge SQL.

### Como funciona
1. O cliente instala um agente Bridge localmente (acessa o MSSQL interno)
2. O admin cadastra a URL e o token do Bridge em cada loja
3. Toda query do dashboard vai para `POST {bridgeUrl}/query` com o SQL
4. A resposta é cacheada no Redis para evitar chamadas repetidas

### Função central
```typescript
// lib/bridge/client.ts
queryBridge<T>(config: { bridgeUrl: string; token: string }, sql: string): Promise<T[]>
```

### Cloudflare Tunnel (obrigatório)
- Type=HTTP (nunca HTTPS — causa erro 525)
- O Bridge roda internamente no cliente e é exposto via Tunnel

---

## Schema do Banco (Supabase)

Tabelas ativas no projeto:

```
tenants           — empresas clientes (name, slug, plan, is_active)
lojas             — lojas de cada tenant (empId, name, cnpj, sqlBridgeUrl, sqlBridgeToken, sqlEnabled)
tenant_features   — add-ons ativados por tenant (chaves de feature)
tenant_users      — vínculo usuário ↔ tenant ↔ lojas com permissões
user_tenant_settings — preferências do usuário por tenant (loja selecionada, tema)
profiles          — dados do usuário (nome, avatar, is_system_admin)
integration_configs — config MaxAPI por loja (token, base URL, cache TTL)
loja_usuarios_erp — mapeamento de usuário ERP por loja (módulo O.S.)
cfop_classificacoes — classificação de CFOPs para NF-e/FiscalStock
produtos          — catálogo de produtos (rota /dashboard/produtos — dados vazios; a migrar para Bridge SQL)
fs_profiles       — perfis FiscalStock por loja
fs_audit_logs     — auditoria do módulo FiscalStock
tenant_access_stats — estatísticas de acesso admin
```

> **Nota**: tabelas do sistema de sync antigo (vendas, venda_itens, venda_pagamentos,
> financeiro, clientes, vendedores, staging_*, sync_queue, sync_log etc.) foram
> removidas em jun/2026 junto com os cron jobs e Edge Functions de sync.

---

## MaxManager ERP — Tabelas MSSQL relevantes

Consultadas diretamente via Bridge SQL:

```sql
-- Empresas/lojas
config         → cofId (empId), cofEmpRazao, cofEmpFantasia, cofEmpCnpj

-- Vendas
vendas         → venId, venData, venTotal, venTipo, venStatus
venda_itens    → ...
venda_pagamentos → venPgId, venId, ...

-- Produtos/estoque
produtos       → proId, proNome, proCodigo, proEstoqueAtual, ...

-- Vendedores / O.S.
vendedores, os, os_itens, ...
```

---

## Módulos do Dashboard

### KPIs e Gráficos (app/(dashboard)/dashboard)
- Faturamento, Custo, Ticket Médio, Lucro
- Gráficos: barras mensais, pagamentos, top produtos, top clientes, top vendedores
- Cross-filtering via FilterContext (lib/contexts/filter-context.tsx)
- Dados: Bridge SQL → queryBridge()

### Relatório de Comissão por Recebimento
- Rota: /dashboard/relatorios/comissao-recebimento
- Dados: Bridge SQL (vendas + pagamentos + vendedores)
- Exportação XLSX e PDF

### Produtos & Estoque (app/(dashboard)/dashboard/produtos)
- Rota: /dashboard/produtos
- **Atenção**: ainda usa tabela Supabase `produtos` (0 rows — pendente migração para Bridge SQL)

### FiscalStock
- Rota: /dashboard/fiscal-stock
- Dados: Bridge SQL + MaxAPI
- Perfis em fs_profiles, auditoria em fs_audit_logs
- Fórmula fiscal com 5 componentes; token MaxAPI cacheado no Redis

### Módulo O.S. (Ordens de Serviço)
- Rota: /dashboard/os
- Técnicos: tabela loja_usuarios_erp (mapeamento usuário ERP)
- Dados em tempo real via Bridge SQL

### NF-e XML (integração SIEG)
- Tabela: nf, coluna nfNFeXMLDestinatarioBase64Zip (Base64+zlib)
- 622 notas disponíveis; guia em docs/nfe-xml-integracao-sieg.md

---

## Painel Admin (app/(admin)/admin)

- `/admin/empresas` — lista de tenants
- `/admin/empresas/novo` — cadastro: 1) conectar Bridge → busca lojas do MSSQL, 2) dados da empresa, 3) módulos, 4) gestor
- `/admin/empresas/[id]` — abas: Lojas | Módulos | Usuários
- Edição inline de nome da empresa e das lojas (EditNomeTenantClient, LojasSectionClient)
- CNPJ suportado (busca automática via Bridge na criação; edição manual)

---

## Regras Técnicas

- Cloudflare Tunnel: Type=HTTP obrigatório
- AES-256-GCM para criptografar token Bridge antes de persistir no Supabase
- shadcn CLI incompatível com Tailwind v3 → criar componentes manualmente
- RLS ativo em todas as tabelas públicas
- Frontend nunca acessa a API MaxData ou o banco MSSQL diretamente
- `git pull --rebase` antes de push

## Variáveis de Ambiente
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

## CFOPs Mapeados
Vendas: 5101,5102,5401,5403,5405,6101,6102,6401,6403,6404
Devoluções: 1201,1202,1410,1411,2201,2202,2410,2411
Serviços: 5900,5901,5902,5933,5949
Transferências: 1152,2152,5152,6152

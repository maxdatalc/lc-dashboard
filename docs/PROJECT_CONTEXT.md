# Contexto do Projeto — LC Dashboard

## Objetivo do sistema
Fornecer um painel administrativo e de análise para lojas integradas ao ERP MaxManager (MaxData), consolidando vendas, clientes, produtos e indicadores financeiros para operação e tomada de decisão.

## Público-alvo
- Operadores de lojas (franqueados/lojas físicas)
- Equipes de vendas e gerência
- Equipe financeira e contábil
- Admins de produto e suporte técnico

## Problema que o sistema resolve
Centraliza dados do ERP MaxManager em um dashboard web para facilitar acompanhamento de vendas, performance por produto/cliente, sincronização e monitoramento de integridade dos dados entre ERP e banco do aplicativo.

## Principais módulos
- Dashboard (gráficos, KPIs, seletores de período e loja)
- Sincronização (produtos, clientes, vendas) com MaxData
- Gestão de lojas e tokens (armazenamento seguro de terminais)
- Área administrativa para operações e testes de integração
- Autenticação via Supabase Auth

## Tecnologias utilizadas
- Frontend: Next.js (App Router, React 18), TypeScript, Tailwind CSS, Recharts (gráficos)
- Backend: Next.js Route Handlers / Server Actions, Supabase (Postgres + Edge Functions)
- Integrações: MaxData (ERP MaxManager) via REST, Upstash Redis (cache de tokens)
- Dev tooling: ESLint, TypeScript, PostCSS, Tailwind

## Diferenciais do produto
- Sincronização incremental e inicial de vendas com controle de logs
- Tokens do ERP cacheados em Redis para reduzir autenticações
- Uso de Supabase Functions (Edge) para jobs agendados e isolados
- Criptografia AES-GCM para segredos de terminais armazenados

## Integrações externas
- ERP MaxManager (API MaxData v2)
- Supabase (Postgres, Auth, Edge Functions)
- Upstash Redis (cache)
- Possível deploy em Vercel (Next.js) ou infra compatível com Edge Functions

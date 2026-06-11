# LC Gestor — Bridge SQL Server

Guia de instalação para técnicos.

---

## O que é isso?

Um programa pequeno que fica rodando na máquina do cliente e permite que o painel LC Gestor acesse o banco de dados da empresa de forma segura, pela internet.

A porta 1433 do SQL Server **nunca é exposta** — apenas a porta 3055 da bridge é acessível externamente, e somente com o token correto.

---

## Requisitos

- Windows 10 ou 11
- Node.js LTS (o instalador instala automaticamente se não estiver presente)
- SQL Server do cliente rodando localmente
- Usuário SQL com permissão de leitura no banco (ver seção de criação de usuário)
- Cloudflare Tunnel configurado para apontar porta 3055

---

## Instalação

1. Copie a pasta `lc-sql-bridge` para o computador do cliente (ex: `C:\LC\lc-sql-bridge`)
2. Clique com o botão direito em `instalar-bridge.ps1` → **Executar com PowerShell**
3. Siga as instruções na tela

O instalador fará tudo automaticamente:
- Verificar/instalar Node.js
- Instalar dependências
- Coletar configurações do SQL Server
- Gerar token de segurança
- Criar o arquivo `.env`
- Configurar inicialização automática
- Testar a conexão

---

## Criar usuário SQL somente leitura (faça antes da instalação)

No SSMS (SQL Server Management Studio), conectado como `sa`:

```sql
-- Substituir NOME_DO_BANCO pelo banco do cliente
USE master;
CREATE LOGIN lc_dashboard WITH PASSWORD = 'SenhaForte@2025!';

USE NOME_DO_BANCO;
CREATE USER lc_dashboard FOR LOGIN lc_dashboard;
EXEC sp_addrolemember 'db_datareader', 'lc_dashboard';
DENY INSERT, UPDATE, DELETE, EXECUTE, ALTER TO lc_dashboard;
```

---

## Como iniciar manualmente

Se precisar iniciar sem aguardar o login automático:

```
Duplo clique em: iniciar-bridge.ps1
```

Ou no PowerShell:
```powershell
powershell.exe -ExecutionPolicy Bypass -File iniciar-bridge.ps1
```

---

## Como testar

```
Duplo clique em: testar-bridge.ps1
```

O script lê o token automaticamente do `.env` e mostra o resultado.

---

## Como parar a bridge

Abra o Gerenciador de Tarefas → aba **Detalhes** → localize o processo `node.exe` → **Finalizar tarefa**.

Ou no PowerShell:
```powershell
Get-Process node | Stop-Process
```

---

## Como verificar os logs

Os logs ficam em `logs\bridge.log`. Cada linha é um registro JSON:

```json
{"ts":"2025-06-11T10:00:00.000Z","level":"info","msg":"lc-sql-bridge iniciado","port":3055}
{"ts":"2025-06-11T10:01:00.000Z","level":"warn","msg":"Autenticação falhou","ip":"127.0.0.1"}
```

Para ver os últimos registros no PowerShell:
```powershell
Get-Content logs\bridge.log -Tail 50
```

---

## Como trocar configurações

1. Abra o arquivo `.env` com o Bloco de Notas
2. Edite os valores desejados
3. Reinicie a bridge (pare e inicie novamente)

**Nunca compartilhe o arquivo `.env` — ele contém credenciais e o token de segurança.**

---

## Como gerar um novo token

1. Execute `instalar-bridge.ps1` novamente
2. Escolha a opção **Reconfigurar**
3. Responda **S** para gerar novo token
4. Após instalação, atualize o token no painel Supabase do LC Gestor

---

## Como reinstalar

Execute `instalar-bridge.ps1` novamente e escolha:
- **Reparar** — mantém `.env` e token existentes, reinstala dependências e tarefa agendada
- **Reconfigurar** — novo `.env`, opção de novo token

---

## Como desinstalar

```
Duplo clique em: desinstalar-bridge.ps1
```

Remove a tarefa agendada. O Node.js não é removido. O `.env` é preservado por padrão (perguntará antes de apagar).

---

## Configurar o Cloudflare Tunnel

Após a instalação, aponte uma rota do Cloudflare Tunnel para a bridge:

1. Acesse o painel Cloudflare → Zero Trust → Networks → Tunnels
2. Clique no tunnel do cliente → **Public Hostname** → **Add a public hostname**
3. Preencha:
   - Subdomain: `sql-nomecliente`
   - Domain: `lctecnologias.com.br`
   - Type: `HTTP`
   - URL: `localhost:3055`
4. Salvar

A URL resultante (`https://sql-nomecliente.lctecnologias.com.br`) e o token devem ser cadastrados no painel admin do LC Gestor.

---

## Erros comuns

| Erro | Causa provável |
|---|---|
| Node.js não encontrado | Instale o Node.js LTS em nodejs.org |
| npm bloqueado | Use `npm.cmd` ao invés de `npm` no PowerShell |
| Login failed | Usuário ou senha SQL incorretos |
| Cannot open database | Nome do banco incorreto no `.env` |
| Tabela 'venda' não encontrada | Banco correto mas schema diferente — altere a query de teste |
| Bridge não respondeu | Verifique se a porta 3055 está disponível |
| Timeout | SQL Server lento ou firewall bloqueando porta 1433 |
| 401 Unauthorized | Token no Supabase diferente do token no `.env` |

---

## Segurança

- O SQL Server **nunca é exposto** diretamente na internet
- Apenas consultas `SELECT` são aceitas — escrita é bloqueada no código e no usuário SQL
- O token é verificado em toda requisição
- As credenciais SQL ficam apenas no arquivo `.env` na máquina do cliente
- O `.env` nunca é enviado ao Git (está no `.gitignore`)
- Os logs nunca registram senhas, tokens completos ou conteúdo das consultas

---

## Cadastrar no LC Gestor após a instalação

Após instalar, informe ao suporte da LC Tecnologias:

1. **URL da bridge**: `https://sql-nomecliente.lctecnologias.com.br`
2. **Token**: exibido ao final da instalação (copie do `.env` se necessário)

Esses dados são cadastrados no painel admin do LC Gestor e **não são compartilhados com o cliente**.

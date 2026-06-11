# instalar-bridge.ps1
# Instalador automatico da lc-sql-bridge para Windows.
# Uso: clique com botao direito -> "Executar com PowerShell"
# Ou: powershell.exe -ExecutionPolicy Bypass -File instalar-bridge.ps1

#Requires -Version 5.1
Set-StrictMode -Off
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ── Constantes ────────────────────────────────────────────────────────────────
$TaskName    = "LC Gestor SQL Bridge"
$BridgeDir   = $PSScriptRoot
$EnvFile     = Join-Path $BridgeDir ".env"
$BridgeFile  = Join-Path $BridgeDir "bridge.js"
$PackageFile = Join-Path $BridgeDir "package.json"
$SummaryFile = Join-Path $BridgeDir "configuracao-cliente.txt"
$TotalSteps  = 8

# ── Helpers de saida ──────────────────────────────────────────────────────────
function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n/$TotalSteps] $msg" -ForegroundColor Cyan
}
function Write-OK($msg)   { Write-Host "   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "   AVISO: $msg" -ForegroundColor Yellow }
function Write-Fail($msg) {
    Write-Host ""
    Write-Host "   ERRO: $msg" -ForegroundColor Red
    Write-Host ""
}
function Abort($msg) {
    Write-Fail $msg
    Write-Host "Instalacao cancelada." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   LC Gestor — Instalador da Bridge SQL   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ── PASSO 1: Verificar privilegios ────────────────────────────────────────────
Write-Step 1 "Verificando ambiente"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if ($isAdmin) {
    Write-OK "Executando como Administrador."
} else {
    Write-OK "Executando como usuario normal (suficiente para a maioria das etapas)."
    Write-Host "   Nota: a tarefa agendada sera criada para o usuario atual ($env:USERNAME)." -ForegroundColor Gray
}

# Verificar se .env ja existe (reinstalacao)
$isReinstall = Test-Path $EnvFile
if ($isReinstall) {
    Write-Warn "Instalacao existente detectada."
    Write-Host ""
    Write-Host "   O que deseja fazer?" -ForegroundColor White
    Write-Host "   [1] Reparar (manter .env e token existentes)" -ForegroundColor White
    Write-Host "   [2] Reconfigurar (novo .env, opcao de novo token)" -ForegroundColor White
    Write-Host "   [3] Cancelar" -ForegroundColor White
    Write-Host ""
    $reinstallOp = Read-Host "   Escolha [1/2/3]"
    switch ($reinstallOp) {
        '3' { Write-Host "Cancelado." -ForegroundColor Gray; exit 0 }
        '2' { $isReinstall = $false }
        default { $isReinstall = $true }
    }
}

# ── PASSO 2: Verificar Node.js ────────────────────────────────────────────────
Write-Step 2 "Verificando Node.js"

$nodeOk = $false
$nodePath = $null

try {
    $nodeVersion = & node -v 2>&1
    $nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue)?.Source
    if ($nodeVersion -match 'v\d+') {
        Write-OK "Node.js encontrado: $nodeVersion"
        $nodeOk = $true
    }
} catch { }

if (-not $nodeOk) {
    Write-Warn "Node.js nao encontrado."
    Write-Host ""

    # Tentar instalar via winget
    $wingetOk = $false
    try {
        $wg = & winget -v 2>&1
        if ($wg -match '\d+\.\d+') { $wingetOk = $true }
    } catch { }

    if ($wingetOk) {
        $instalarNode = Read-Host "   Instalar Node.js LTS automaticamente via winget? [S/N]"
        if ($instalarNode -match '^[Ss]') {
            Write-Host "   Instalando Node.js LTS..." -ForegroundColor Cyan
            try {
                & winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
                Write-Host ""
                Write-Host "   Node.js instalado. Atualizando PATH da sessao..." -ForegroundColor Cyan

                # Recarrega PATH
                $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                            [System.Environment]::GetEnvironmentVariable('PATH', 'User')

                $nodeVersion = & node -v 2>&1
                $nodePath    = (Get-Command node.exe -ErrorAction SilentlyContinue)?.Source
                if ($nodeVersion -match 'v\d+') {
                    Write-OK "Node.js instalado com sucesso: $nodeVersion"
                    $nodeOk = $true
                } else {
                    Write-Warn "Node.js instalado mas nao esta no PATH desta sessao."
                    Write-Host ""
                    Write-Host "   Feche este terminal, abra um novo e execute instalar-bridge.ps1 novamente." -ForegroundColor Yellow
                    Read-Host "Pressione Enter para sair"
                    exit 1
                }
            } catch {
                Abort "Falha ao instalar Node.js via winget: $_"
            }
        } else {
            Abort "Node.js LTS e obrigatorio. Baixe em: https://nodejs.org"
        }
    } else {
        Write-Host ""
        Write-Host "   winget nao disponivel. Instale manualmente:" -ForegroundColor Yellow
        Write-Host "   1. Acesse https://nodejs.org e baixe a versao LTS" -ForegroundColor White
        Write-Host "   2. Execute o instalador" -ForegroundColor White
        Write-Host "   3. Abra um novo terminal e execute instalar-bridge.ps1 novamente" -ForegroundColor White
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

# Verificar npm
try {
    $npmVersion = & npm.cmd -v 2>&1
    Write-OK "npm encontrado: v$npmVersion"
} catch {
    Abort "npm nao encontrado. Reinstale o Node.js."
}

# ── PASSO 3: Validar arquivos ─────────────────────────────────────────────────
Write-Step 3 "Validando arquivos da bridge"

if (-not (Test-Path $BridgeFile))  { Abort "bridge.js nao encontrado em $BridgeDir" }
if (-not (Test-Path $PackageFile)) { Abort "package.json nao encontrado em $BridgeDir" }
Write-OK "bridge.js e package.json encontrados."

# Verificar se dotenv esta no package.json
$pkgJson = Get-Content $PackageFile -Raw | ConvertFrom-Json
$temDotenv = $false
try {
    $temDotenv = $null -ne $pkgJson.dependencies.dotenv -or $null -ne $pkgJson.devDependencies?.dotenv
} catch { }

if (-not $temDotenv) {
    Write-Warn "dotenv nao declarado em package.json. Sera instalado separadamente."
}

# ── PASSO 4: Instalar dependencias ────────────────────────────────────────────
Write-Step 4 "Instalando dependencias (npm install)"

try {
    Push-Location $BridgeDir
    $output = & npm.cmd install 2>&1
    Pop-Location
    Write-OK "Dependencias instaladas."
} catch {
    Pop-Location -ErrorAction SilentlyContinue
    Abort "Falha ao executar npm install: $_"
}

if (-not $temDotenv) {
    try {
        Push-Location $BridgeDir
        & npm.cmd install dotenv --save 2>&1 | Out-Null
        Pop-Location
        Write-OK "dotenv instalado."
    } catch {
        Pop-Location -ErrorAction SilentlyContinue
        Abort "Falha ao instalar dotenv: $_"
    }
}

# ── PASSO 5: Coletar configuracoes ────────────────────────────────────────────
Write-Step 5 "Coletando configuracoes"

$clienteNome = ''
$dbHost      = 'localhost'
$dbPort      = '1433'
$dbName      = ''
$dbUser      = ''
$bridgePort  = '3055'
$dbPass      = ''

# Se for reparar, le valores do .env existente
if ($isReinstall) {
    Write-Host "   Mantendo configuracoes do .env existente." -ForegroundColor Gray
    $envVars = @{}
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $envVars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    $dbHost     = if ($envVars['DB_HOST'])  { $envVars['DB_HOST'] }  else { 'localhost' }
    $dbPort     = if ($envVars['DB_PORT'])  { $envVars['DB_PORT'] }  else { '1433' }
    $dbName     = $envVars['DB_NAME']  ?? ''
    $dbUser     = $envVars['DB_USER']  ?? ''
    $bridgePort = if ($envVars['PORT'])     { $envVars['PORT'] }     else { '3055' }
    $existingToken = $envVars['BRIDGE_TOKEN'] ?? ''

    Write-OK "Host: $dbHost  Banco: $dbName  Porta bridge: $bridgePort"

    # Preservar token ou gerar novo
    $regenerarToken = Read-Host "   Gerar novo token de seguranca? [S/N] (padrao: N)"
    if ($regenerarToken -match '^[Ss]') {
        $existingToken = ''
        Write-Warn "Novo token sera gerado. Atualize o token no Supabase apos a instalacao."
    } else {
        Write-OK "Token existente preservado."
    }

    # Senha nao fica no .env em texto visivel... mas esta em texto puro la
    # Re-le para nao perder
    $dbPass = $envVars['DB_PASS'] ?? ''

} else {
    # Nova instalacao — coleta interativa
    Write-Host ""
    $clienteNome = Read-Host "   Nome do cliente (para identificacao)"

    Write-Host ""
    Write-Host "   Configuracoes do SQL Server:" -ForegroundColor White
    $dbHostInput = Read-Host "   Host do SQL Server [localhost]"
    if ($dbHostInput.Trim() -ne '') { $dbHost = $dbHostInput.Trim() }

    $dbPortInput = Read-Host "   Porta do SQL Server [1433]"
    if ($dbPortInput.Trim() -ne '') { $dbPort = $dbPortInput.Trim() }

    $dbName = ''
    while ($dbName.Trim() -eq '') {
        $dbName = Read-Host "   Nome do banco de dados"
    }

    $dbUser = ''
    while ($dbUser.Trim() -eq '') {
        $dbUser = Read-Host "   Usuario SQL (ex: lc_dashboard)"
    }

    # Senha com entrada segura
    Write-Host "   Senha SQL (nao sera exibida): " -NoNewline -ForegroundColor White
    $securePass = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $dbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

    Write-Host ""
    Write-Host "   Configuracoes da bridge:" -ForegroundColor White
    $portaInput = Read-Host "   Porta da bridge [3055]"
    if ($portaInput.Trim() -ne '') { $bridgePort = $portaInput.Trim() }

    $existingToken = ''
}

# ── PASSO 6: Verificar porta e criar .env ─────────────────────────────────────
Write-Step 6 "Preparando configuracao"

# Verifica porta em uso
$portaOcupada = $false
try {
    $conns = Get-NetTCPConnection -LocalPort ([int]$bridgePort) -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $portaOcupada = $true
        $pid = $conns[0].OwningProcess
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        $procNome = if ($proc) { $proc.Name } else { "PID $pid" }
        Write-Warn "Porta $bridgePort ja esta em uso pelo processo '$procNome' (PID $pid)."
        Write-Host ""
        $outraPorta = Read-Host "   Informe outra porta (ou Enter para tentar continuar mesmo assim)"
        if ($outraPorta.Trim() -ne '') { $bridgePort = $outraPorta.Trim() }
    } else {
        Write-OK "Porta $bridgePort disponivel."
    }
} catch {
    Write-OK "Porta $bridgePort (nao foi possivel verificar, continuando)."
}

# Gerar token se necessario
if ($existingToken -eq '' -or $null -eq $existingToken) {
    $tokenBytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($tokenBytes)
    $novoToken = [System.BitConverter]::ToString($tokenBytes).Replace('-', '').ToLower()
} else {
    $novoToken = $existingToken
}

# Gravar .env (UTF-8 sem BOM)
$envContent = "BRIDGE_TOKEN=$novoToken`nDB_HOST=$dbHost`nDB_PORT=$dbPort`nDB_NAME=$dbName`nDB_USER=$dbUser`nDB_PASS=$dbPass`nPORT=$bridgePort"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($EnvFile, $envContent, $utf8NoBom)
Write-OK ".env criado com sucesso."

# Garantir que .env esta no .gitignore
$gitignorePath = Join-Path $BridgeDir ".gitignore"
if (Test-Path $gitignorePath) {
    $gi = Get-Content $gitignorePath -Raw
    if ($gi -notmatch '(^|\n)\.env(\r|\n|$)') {
        Add-Content $gitignorePath "`n.env"
    }
} else {
    ".env`nnode_modules/`nlogs/`nconfiguracao-cliente.txt" | Out-File $gitignorePath -Encoding utf8
}
Write-OK ".env protegido no .gitignore."

# ── PASSO 7: Configurar inicializacao automatica ──────────────────────────────
Write-Step 7 "Configurando inicializacao automatica (Agendador de Tarefas)"

$nodeFull = $null
try {
    $nodeFull = (Get-Command node.exe).Source
} catch {
    # Tenta caminhos comuns
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $nodeFull = $c; break }
    }
}

if (-not $nodeFull) {
    Write-Warn "Caminho do node.exe nao encontrado para tarefa agendada."
    Write-Host "   Inicializacao automatica nao configurada." -ForegroundColor Yellow
    Write-Host "   Use iniciar-bridge.ps1 para iniciar manualmente." -ForegroundColor Yellow
} else {
    try {
        # Remove tarefa anterior se existir
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

        $action = New-ScheduledTaskAction `
            -Execute $nodeFull `
            -Argument "bridge.js" `
            -WorkingDirectory $BridgeDir

        $trigger = New-ScheduledTaskTrigger -AtLogOn

        $settings = New-ScheduledTaskSettingsSet `
            -ExecutionTimeLimit 0 `
            -MultipleInstances IgnoreNew `
            -RestartCount 3 `
            -RestartInterval (New-TimeSpan -Minutes 2) `
            -StartWhenAvailable $true

        $principal = New-ScheduledTaskPrincipal `
            -UserId "$env:USERDOMAIN\$env:USERNAME" `
            -LogonType Interactive `
            -RunLevel Limited

        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Principal $principal `
            -Description "LC Gestor - Bridge SQL Server (porta $bridgePort)" `
            -Force | Out-Null

        Write-OK "Tarefa '$TaskName' criada — inicia automaticamente no login."
        Write-Host "   Executando como: $env:USERNAME  |  Reinicia em falha: 3x (intervalo 2 min)" -ForegroundColor Gray
    } catch {
        Write-Warn "Nao foi possivel criar tarefa agendada: $_"
        Write-Host "   Inicializacao automatica nao configurada." -ForegroundColor Yellow
        Write-Host "   Use iniciar-bridge.ps1 para iniciar manualmente." -ForegroundColor Yellow
    }
}

# ── PASSO 8: Iniciar bridge e testar ─────────────────────────────────────────
Write-Step 8 "Iniciando bridge e testando conexao"

# Inicia em background
$env:BRIDGE_TOKEN = $novoToken
$env:DB_HOST      = $dbHost
$env:DB_PORT      = $dbPort
$env:DB_NAME      = $dbName
$env:DB_USER      = $dbUser
$env:DB_PASS      = $dbPass
$env:PORT         = $bridgePort

Write-Host "   Aguardando bridge iniciar..." -ForegroundColor Gray

$bridgeProc = Start-Process -FilePath $nodeFull `
    -ArgumentList "bridge.js" `
    -WorkingDirectory $BridgeDir `
    -PassThru `
    -WindowStyle Hidden `
    -ErrorAction SilentlyContinue

Start-Sleep -Seconds 3

$baseUrl  = "http://localhost:$bridgePort"
$testeOk  = $false
$sqlOk    = $false
$sqlErro  = ''

# Health check
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    if ($health.ok) {
        Write-OK "Bridge online. Banco: $($health.db)"
        $testeOk = $true
    }
} catch {
    Write-Warn "Bridge nao respondeu ao health check."
}

# Query de teste
if ($testeOk) {
    $queryTeste = "SELECT TOP 1 vedId FROM venda"
    Write-Host ""
    Write-Host "   Query de teste padrao: $queryTeste" -ForegroundColor Gray
    $customQ = Read-Host "   Usar outra query? (Enter para usar padrao)"
    if ($customQ.Trim() -ne '') { $queryTeste = $customQ.Trim() }

    try {
        $headers = @{
            Authorization  = "Bearer $novoToken"
            'Content-Type' = 'application/json'
        }
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes("{""sql"":""$($queryTeste -replace '"', '\"')""}")
        $resp = Invoke-RestMethod -Uri "$baseUrl/query" -Method POST `
            -Headers $headers -Body $bodyBytes -TimeoutSec 15

        if ($null -ne $resp.rows) {
            Write-OK "SQL Server acessivel. $($resp.rows.Count) linha(s) retornada(s)."
            $sqlOk = $true
        }
    } catch {
        $statusCode = $_.Exception.Response?.StatusCode?.value__
        $errBody    = ''
        try { $errBody = $_.ErrorDetails.Message } catch {}

        $sqlErro = switch ($statusCode) {
            401 { "Token invalido — verifique o .env" }
            403 { "Query bloqueada — verifique se e um SELECT" }
            500 {
                if ($errBody -match 'Login failed')           { "Login SQL Server recusado — verifique DB_USER e DB_PASS" }
                elseif ($errBody -match 'Cannot open database') { "Banco '$dbName' nao encontrado — verifique DB_NAME" }
                elseif ($errBody -match 'Invalid object')     { "Tabela 'venda' nao encontrada neste banco" }
                elseif ($errBody -match 'network-related')    { "SQL Server inacessivel — verifique DB_HOST e firewall" }
                elseif ($errBody -match 'Timeout')            { "Timeout — SQL Server lento ou fora do ar" }
                else { "Erro SQL: $errBody" }
            }
            default { "Sem resposta — bridge nao iniciou (PID $($bridgeProc?.Id))" }
        }
        Write-Warn "Teste de query falhou: $sqlErro"
    }
}

# ── Resultado final ───────────────────────────────────────────────────────────
$dataInstalacao = Get-Date -Format "dd/MM/yyyy HH:mm"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

if ($testeOk -and $sqlOk) {
    Write-Host "   Instalacao concluida com sucesso!" -ForegroundColor Green
} elseif ($testeOk) {
    Write-Host "   Bridge online — SQL com aviso (veja acima)" -ForegroundColor Yellow
} else {
    Write-Host "   Instalacao com problemas (veja avisos acima)" -ForegroundColor Yellow
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Bridge:               $(if ($testeOk) { 'online' } else { 'nao respondeu' })" -ForegroundColor White
Write-Host "  SQL Server:           $(if ($sqlOk) { 'conectado' } else { "aviso: $sqlErro" })" -ForegroundColor White
Write-Host "  Banco:                $dbName" -ForegroundColor White
Write-Host "  Porta:                $bridgePort" -ForegroundColor White
Write-Host "  Inicializacao auto:   $(if ($nodeFull) { 'configurada' } else { 'manual' })" -ForegroundColor White
Write-Host "  Data:                 $dataInstalacao" -ForegroundColor White
Write-Host ""

# Token — exibir uma vez e oferecer clipboard
Write-Host "  TOKEN DE SEGURANCA (copie para o Supabase):" -ForegroundColor Yellow
Write-Host "  $novoToken" -ForegroundColor White
Write-Host ""

$copiar = Read-Host "  Copiar token para a area de transferencia? [S/N]"
if ($copiar -match '^[Ss]') {
    try {
        $novoToken | Set-Clipboard
        Write-Host "  Token copiado." -ForegroundColor Green
    } catch {
        Write-Host "  Nao foi possivel copiar automaticamente." -ForegroundColor Yellow
        Write-Host "  Copie manualmente o token acima." -ForegroundColor Yellow
    }
}

# Arquivo de resumo (sem token)
$summary = @"
LC Gestor — Configuracao da Bridge SQL
=======================================
Cliente:             $clienteNome
Host SQL Server:     $dbHost
Porta SQL Server:    $dbPort
Banco de dados:      $dbName
Usuario SQL:         $dbUser
Porta bridge:        $bridgePort
URL local:           http://localhost:$bridgePort
URL Cloudflare:      (configurar no Cloudflare Tunnel apontando para localhost:$bridgePort)
Status do teste:     $(if ($sqlOk) { 'OK' } elseif ($testeOk) { 'Bridge OK / SQL com aviso' } else { 'Verificar' })
Data de instalacao:  $dataInstalacao

IMPORTANTE: O token de seguranca NAO esta neste arquivo.
Ele esta no arquivo .env e foi exibido na tela durante a instalacao.
Cadastre o token no painel Supabase do LC Gestor.
"@

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($SummaryFile, $summary, $utf8NoBom)
Write-Host ""
Write-Host "  Resumo salvo em: configuracao-cliente.txt (sem token)" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para sair"

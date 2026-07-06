# Instaladores Windows/PowerShell — armadilhas (lc-sql-bridge)

Aprendizados de construir e distribuir o instalador da SQL Bridge para máquinas de cliente (Windows, muitas vezes sem suporte técnico local).

- `?.` (null-conditional) só existe em PowerShell 7+; Windows vem com PS 5.1 por padrão — o operador causa falha silenciosa de parse e a janela fecha instantaneamente sem erro visível.
- `-StartWhenAvailable $true` falha em `Register-ScheduledTask` — é um parâmetro switch, deve ser passado sem valor (`-StartWhenAvailable`).
- Gatilho `AtLogon` no Task Scheduler não dispara em reboot sem ninguém logar. Um serviço de background como a Bridge deve ser registrado como `SYSTEM` com `AtStartup` para sobreviver a reboot sem login.
- Quando o processo Node roda como `SYSTEM`, `dotenv` deve resolver `.env` via `path.join(__dirname, '.env')` — nunca confiar em `cwd`, que pode ser `C:\Windows\System32` sob `SYSTEM`.
- `.ps1` executado via duplo-clique ou "Run with PowerShell" esbarra na `ExecutionPolicy` `Restricted` padrão e fecha sem output — o único ponto de entrada confiável é um `.bat` que chama `powershell -ExecutionPolicy Bypass`.
- Scripts compilados com PS2EXE recebem `$PSScriptRoot` **vazio** em runtime — qualquer script que faça `Set-Location $PSScriptRoot` como primeira linha precisa de fallback (ex.: caminho do processo) ou o .exe compilado crasha imediatamente.
- PowerShell 5.1 lê `.ps1` sem BOM UTF-8 como Windows-1252 — caracteres especiais (ex.: travessão —) saem corrompidos e o byte residual pode quebrar o parse do restante do arquivo. Evitar caracteres não-ASCII em conteúdo de instalador, ou forçar BOM UTF-8.
- Falha de `git push` para o repo da organização por causa do Windows Credential Manager cachear a conta pessoal em vez da conta da organização — resolver limpando as credenciais cacheadas para forçar novo login via navegador.

<#
.SYNOPSIS
  Aplica as migrações do banco (Alembic) na Neon de produção.

.DESCRIPTION
  - Pede a connection string da Neon OCULTA (Read-Host -AsSecureString): ela não aparece na tela,
    não fica no histórico e só vira texto na memória.
  - Limpa a string (aspas, "psql ", "-pooler", channel_binding): migrações usam a conexão direta.
  - Mostra só o host e o banco de destino (nunca a senha) e pede confirmação.
  - Roda python -m app.database.migrate (cria do zero ou faz alembic upgrade head).
  - Apaga a variável DATABASE_URL da sessão no final, mesmo se der erro.

  Uso (PowerShell, a partir de qualquer pasta):
    powershell -ExecutionPolicy Bypass -File C:\Projetos\ak-talent\backend\scripts\migrar-producao.ps1

  Este arquivo fica fora do deploy da Vercel (backend/.vercelignore: /scripts/).
#>

. (Join-Path $PSScriptRoot 'neon-common.ps1')

function Invoke-MigrarProducao {
    $backendDir = Split-Path -Parent $PSScriptRoot
    $python = Get-BackendPython $backendDir
    if (-not $python) { return }

    $url = Read-NeonTarget 'Aplicar as migrações'
    if (-not $url) { return }

    Invoke-WithDatabaseUrl $backendDir $url { & $python -m app.database.migrate }
    $url = $null
}

# Dot-sourcing (". .\migrar-producao.ps1") só carrega as funções, sem executar nada.
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-MigrarProducao
}

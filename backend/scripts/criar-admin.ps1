<#
.SYNOPSIS
  Cria o primeiro usuário administrador da AK Talent no banco da Neon (produção).

.DESCRIPTION
  - Pede a connection string da Neon (Read-Host: não fica no histórico do terminal).
  - Limpa a string: remove aspas, "psql ", o sufixo "-pooler" do host (usa a conexão direta)
    e o parâmetro channel_binding.
  - Mostra o host e o banco de destino (nunca a senha) e pede confirmação.
  - Roda python -m app.scripts.create_admin (que pede nome, e-mail e senha).
  - Apaga a variável DATABASE_URL da sessão no final, mesmo se der erro.

  Uso (PowerShell, a partir de qualquer pasta):
    powershell -ExecutionPolicy Bypass -File C:\Projetos\ak-talent\backend\scripts\criar-admin.ps1

  Este arquivo fica fora do deploy da Vercel (backend/.vercelignore: /scripts/).
#>

function Get-CleanNeonUrl {
    param([string]$Raw)

    $url = $Raw.Trim()
    # Painéis às vezes copiam o comando inteiro: psql 'postgresql://...'
    if ($url -match '^psql\s+') { $url = $url -replace '^psql\s+', '' }
    $url = $url.Trim().Trim('"', "'").Trim()

    # Conexão direta (sem PgBouncer): tira o "-pooler" do nome do host.
    $url = $url -replace '-pooler(?=\.)', ''

    # Remove channel_binding=... da query, onde quer que esteja.
    if ($url -match '\?') {
        $base, $query = $url -split '\?', 2
        $params = @($query -split '&' | Where-Object { $_ -and ($_ -notmatch '^channel_binding=') })
        $url = if ($params.Count -gt 0) { "${base}?" + ($params -join '&') } else { $base }
    }
    return $url
}

function Get-UrlTarget {
    param([string]$Url)

    # postgresql://usuario:senha@host[:porta]/banco?params  -> host e banco, sem a senha
    if ($Url -match '^(postgres|postgresql)(\+\w+)?://[^@]+@([^/:?]+)(:\d+)?/([^?]+)') {
        return [pscustomobject]@{ Host = $Matches[3]; Database = $Matches[5] }
    }
    return $null
}

function Invoke-CriarAdmin {
    $backendDir = Split-Path -Parent $PSScriptRoot
    $python = Join-Path $backendDir '.venv\Scripts\python.exe'
    if (-not (Test-Path $python)) {
        Write-Host "Não encontrei o Python do backend em $python" -ForegroundColor Red
        Write-Host "Crie o ambiente: cd $backendDir; python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt"
        return
    }

    $raw = Read-Host 'Cole a connection string da Neon'
    if (-not $raw.Trim()) {
        Write-Host 'Nenhuma connection string informada. Nada foi feito.' -ForegroundColor Yellow
        return
    }

    $url = Get-CleanNeonUrl $raw
    $target = Get-UrlTarget $url
    if (-not $target) {
        Write-Host 'Isso não parece uma connection string do Postgres (postgresql://usuario:senha@host/banco). Nada foi feito.' -ForegroundColor Red
        return
    }

    Write-Host ''
    Write-Host "Destino: $($target.Host) / $($target.Database)" -ForegroundColor Cyan
    if ($target.Host -notmatch '\.neon\.tech$') {
        Write-Host 'ATENÇÃO: o host não termina em .neon.tech. Confira se é mesmo o banco de produção.' -ForegroundColor Yellow
    }
    $answer = Read-Host 'Criar o admin neste banco? (s/N)'
    if ($answer.Trim().ToLower() -ne 's') {
        Write-Host 'Cancelado. Nada foi feito.' -ForegroundColor Yellow
        return
    }

    Push-Location $backendDir
    try {
        $env:DATABASE_URL = $url
        & $python -m app.scripts.create_admin
    }
    finally {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
        Pop-Location
        Remove-Variable raw, url -ErrorAction SilentlyContinue
        Write-Host 'Variável DATABASE_URL apagada da sessão.'
    }
}

# Dot-sourcing (". .\criar-admin.ps1") só carrega as funções, sem executar nada.
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-CriarAdmin
}

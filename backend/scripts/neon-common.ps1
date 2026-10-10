# Funções comuns dos scripts que usam a connection string da Neon (criar-admin.ps1, migrar-producao.ps1).
# Regra: a connection string NUNCA aparece na tela. É digitada/colada oculta (Read-Host -AsSecureString),
# vira texto só na memória e o script mostra apenas o host e o banco.

function Read-SecretText {
    param([string]$Prompt)

    $secure = Read-Host $Prompt -AsSecureString
    if (-not $secure -or $secure.Length -eq 0) { return '' }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $secure.Dispose()
    }
}

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

function Read-NeonTarget {
    <#
      Pede a connection string oculta, limpa, mostra só host/banco e pede confirmação.
      Devolve a URL limpa (em memória) ou $null se algo não estiver certo ou a pessoa cancelar.
    #>
    param([string]$Action)

    $raw = Read-SecretText 'Cole a connection string DIRETA da Neon (fica oculta)'
    if (-not $raw.Trim()) {
        Write-Host 'Nenhuma connection string informada. Nada foi feito.' -ForegroundColor Yellow
        return $null
    }

    $url = Get-CleanNeonUrl $raw
    $raw = $null
    $target = Get-UrlTarget $url
    if (-not $target) {
        Write-Host 'Isso não parece uma connection string do Postgres (postgresql://usuario:senha@host/banco). Nada foi feito.' -ForegroundColor Red
        return $null
    }

    Write-Host ''
    Write-Host "Destino: $($target.Host) / $($target.Database)" -ForegroundColor Cyan
    if ($target.Host -notmatch '\.neon\.tech$') {
        Write-Host 'ATENÇÃO: o host não termina em .neon.tech. Confira se é mesmo o banco de produção.' -ForegroundColor Yellow
    }
    $answer = Read-Host "$Action neste banco? (s/N)"
    if ($answer.Trim().ToLower() -ne 's') {
        Write-Host 'Cancelado. Nada foi feito.' -ForegroundColor Yellow
        return $null
    }
    return $url
}

function Get-BackendPython {
    param([string]$BackendDir)

    $python = Join-Path $BackendDir '.venv\Scripts\python.exe'
    if (-not (Test-Path $python)) {
        Write-Host "Não encontrei o Python do backend em $python" -ForegroundColor Red
        Write-Host "Crie o ambiente: cd $BackendDir; python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt"
        return $null
    }
    return $python
}

function Invoke-WithDatabaseUrl {
    <# Roda o comando com DATABASE_URL só durante a execução e apaga a variável no final, mesmo com erro. #>
    param([string]$BackendDir, [string]$Url, [scriptblock]$Command)

    Push-Location $BackendDir
    try {
        $env:DATABASE_URL = $Url
        & $Command
    }
    finally {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
        Pop-Location
        Write-Host 'Variável DATABASE_URL apagada da sessão.'
    }
}

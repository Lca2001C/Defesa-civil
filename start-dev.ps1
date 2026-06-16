# =============================================================================
# Plataforma Defesa Civil MG — Script de inicialização (DESENVOLVIMENTO)
# =============================================================================
# Uso:
#   .\start-dev.ps1            → app no host (Vite + API) + túnel ngrok público
#   .\start-dev.ps1 -NoTunnel  → sobe a app no host sem o túnel ngrok
#   .\start-dev.ps1 -Rebuild   → força rebuild da imagem local do ngrok
#
# O que faz:
#   1. Garante o .env (copia de .env.example se não existir)
#   2. Valida o NGROK_AUTHTOKEN (desativa o túnel se ausente/placeholder)
#   3. Sobe PostgreSQL + Redis (Docker Compose) e aguarda healthchecks
#   4. Aplica migrations + seed (Prisma, a partir do host)
#   5. Inicia a API NestJS (:4000) e o Vite (:3000) no host (janelas separadas)
#   6. Sobe o container do ngrok (imagem local) tunelando host.docker.internal:3000
#      e exibe/abre a URL pública
#
# Topologia: o ngrok tuneliza o Vite (:3000) no host, que serve a SPA e faz
# proxy de /api e /socket.io para a API — tudo na mesma origem pública.
#
# Pré-requisitos: Docker Desktop em execução, Node.js >= 20, corepack (pnpm).
# =============================================================================

param(
    [switch]$NoTunnel,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$PlaceholderToken = "troque-este-token-do-ngrok"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Plataforma Defesa Civil MG — Inicialização      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Set-Location $Root

# ── 1. Verificar .env ─────────────────────────────────────────────────────────
$envFile = Join-Path $Root ".env"
$envExample = Join-Path $Root ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[1/6] .env criado a partir de .env.example." -ForegroundColor Yellow
        Write-Host "      ⚠  Revise as variáveis (JWT secrets, senhas, NGROK_AUTHTOKEN)." -ForegroundColor Yellow
    } else {
        Write-Host "[ERR] .env.example não encontrado. Crie o arquivo .env manualmente." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/6] .env encontrado. OK." -ForegroundColor Green
}

# ── 2. Validar NGROK_AUTHTOKEN + binário do ngrok ────────────────────────────
$usarTunnel = -not $NoTunnel
if ($usarTunnel) {
    $linhaToken = Select-String -Path $envFile -Pattern '^\s*NGROK_AUTHTOKEN\s*=\s*(.+)\s*$' -ErrorAction SilentlyContinue | Select-Object -First 1
    $token = if ($linhaToken) { $linhaToken.Matches[0].Groups[1].Value.Trim() } else { "" }

    if ([string]::IsNullOrWhiteSpace($token) -or $token -eq $PlaceholderToken) {
        Write-Host "[2/6] NGROK_AUTHTOKEN ausente ou padrão — túnel DESATIVADO." -ForegroundColor Yellow
        Write-Host "      Para habilitar: obtenha o token em https://dashboard.ngrok.com" -ForegroundColor Yellow
        Write-Host "      e defina NGROK_AUTHTOKEN no arquivo .env." -ForegroundColor Yellow
        $usarTunnel = $false
    } else {
        Write-Host "[2/6] NGROK_AUTHTOKEN configurado — túnel ATIVADO." -ForegroundColor Green
    }

    # Garante o binário do ngrok (baixado pelo host; copiado na imagem local).
    $ngrokBin = Join-Path $Root "infra\ngrok\bin\ngrok"
    if ($usarTunnel -and -not (Test-Path $ngrokBin)) {
        Write-Host "      Baixando binário do ngrok (linux-amd64)..." -ForegroundColor Gray
        New-Item -ItemType Directory -Force (Split-Path $ngrokBin) | Out-Null
        $tgz = Join-Path $env:TEMP "ngrok-dl.tgz"
        try {
            Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz" -OutFile $tgz -UseBasicParsing -TimeoutSec 120
            tar -xzf $tgz -C (Split-Path $ngrokBin)
            Remove-Item $tgz -Force -ErrorAction SilentlyContinue
            Write-Host "      Binário do ngrok pronto." -ForegroundColor Green
        } catch {
            Write-Host "      ⚠  Falha ao baixar o binário do ngrok — túnel desativado." -ForegroundColor Yellow
            $usarTunnel = $false
        }
    }
} else {
    Write-Host "[2/6] -NoTunnel informado — túnel desativado." -ForegroundColor Gray
}

# ── 3. Subir PostgreSQL + Redis ───────────────────────────────────────────────
Write-Host "[3/6] Subindo PostgreSQL e Redis (Docker Compose)..." -ForegroundColor Cyan
docker compose up postgres redis -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Falha ao subir os containers. Verifique o Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "      Aguardando PostgreSQL e Redis ficarem saudáveis..." -ForegroundColor Gray
$tentativas = 0
$maxTentativas = 30
do {
    Start-Sleep -Seconds 2
    $tentativas++
    $status = docker compose ps --format json 2>$null | ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object { $_.Name -match "postgres|redis" }
    $saudaveis = ($status | Where-Object { $_.Health -eq "healthy" }).Count
    Write-Host "      Saudáveis: $saudaveis/2 (tentativa $tentativas/$maxTentativas)" -ForegroundColor Gray
} while ($saudaveis -lt 2 -and $tentativas -lt $maxTentativas)

if ($saudaveis -lt 2) {
    Write-Host "      ⚠  Timeout no healthcheck. Continuando mesmo assim..." -ForegroundColor Yellow
} else {
    Write-Host "      PostgreSQL + Redis prontos." -ForegroundColor Green
}

# ── 4. Migrations + seed (a partir do host) ──────────────────────────────────
Write-Host "[4/6] Aplicando migrations Prisma (host → localhost:5436)..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "apps\api")
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] prisma migrate deploy falhou." -ForegroundColor Red
    Pop-Location
    exit 1
}
npx prisma db seed 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      (seed pulado/falhou — seguindo; dados podem já existir)" -ForegroundColor Gray
} else {
    Write-Host "      Migrations + seed aplicados." -ForegroundColor Green
}
Pop-Location

# ── 5. Iniciar API + Vite no host (janelas separadas) ────────────────────────
Write-Host "[5/6] Iniciando API NestJS (:4000) e Vite (:3000) no host..." -ForegroundColor Cyan
$apiProc = Start-Process -PassThru -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; `$host.ui.RawUI.WindowTitle = 'DCMG - API'; corepack pnpm --filter @dcmg/api start:dev"
) -WindowStyle Normal
Write-Host "      API iniciada (PID $($apiProc.Id)). Aguardando /api/health..." -ForegroundColor Gray
$tentativas = 0
do {
    Start-Sleep -Seconds 2
    $tentativas++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch { }
} while ($tentativas -lt 30)
Write-Host "      API pronta." -ForegroundColor Green

$webProc = Start-Process -PassThru -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; `$host.ui.RawUI.WindowTitle = 'DCMG - Web'; corepack pnpm --filter @dcmg/web dev"
) -WindowStyle Normal
Write-Host "      Vite iniciado (PID $($webProc.Id)). Aguardando :3000..." -ForegroundColor Gray
$tentativas = 0
do {
    Start-Sleep -Seconds 2
    $tentativas++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch { }
} while ($tentativas -lt 30)
Write-Host "      Vite pronto." -ForegroundColor Green

# ── 6. Subir o container do ngrok + obter URL pública ────────────────────────
$urlPublica = $null
if ($usarTunnel) {
    Write-Host "[6/6] Subindo o container do ngrok (imagem local)..." -ForegroundColor Cyan
    # --build sempre: na 1ª vez builda a imagem local; depois usa o cache de layers.
    # -Rebuild força ignorar o cache (--no-cache) caso o binário/Dockerfile mudem.
    if ($Rebuild) {
        docker compose --profile tunnel build --no-cache ngrok
    }
    docker compose --profile tunnel up -d --build ngrok
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ⚠  Falha ao subir o ngrok. Veja 'docker compose logs ngrok'." -ForegroundColor Yellow
    } else {
        $inspPort = 4040
        $linhaPorta = Select-String -Path $envFile -Pattern '^\s*NGROK_INSPECTOR_PORT\s*=\s*(\d+)\s*$' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($linhaPorta) { $inspPort = [int]$linhaPorta.Matches[0].Groups[1].Value }

        Write-Host "      Aguardando a URL pública (inspector :$inspPort)..." -ForegroundColor Gray
        $tentativas = 0
        do {
            Start-Sleep -Seconds 2
            $tentativas++
            try {
                $tunnels = Invoke-RestMethod -Uri "http://localhost:$inspPort/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
                $urlPublica = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } |
                    Select-Object -First 1 -ExpandProperty public_url
            } catch { }
        } while (-not $urlPublica -and $tentativas -lt 15)

        if ($urlPublica) {
            Set-Content -Path (Join-Path $Root ".ngrok-url") -Value $urlPublica -Encoding utf8
            Write-Host "      URL pública: $urlPublica" -ForegroundColor Green
        } else {
            Write-Host "      ⚠  Não consegui ler a URL. Veja o inspector em http://localhost:$inspPort" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[6/6] Túnel desativado." -ForegroundColor Gray
}

# ── Resumo ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Plataforma em execução!                 ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
if ($urlPublica) {
    Write-Host "║  Público   : $urlPublica" -ForegroundColor Green
}
Write-Host "║  SPA local : http://localhost:3000                   ║" -ForegroundColor Green
Write-Host "║  API       : http://localhost:4000/api               ║" -ForegroundColor Green
Write-Host "║  Swagger   : http://localhost:4000/api/docs          ║" -ForegroundColor Green
if ($usarTunnel) {
    Write-Host "║  Inspector : http://localhost:4040                   ║" -ForegroundColor Green
}
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Para parar: .\stop-dev.ps1                           ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Abre o navegador (URL pública se houver túnel; senão a SPA local)
Start-Sleep -Seconds 2
if ($urlPublica) {
    Start-Process $urlPublica
} else {
    Start-Process "http://localhost:3000"
}

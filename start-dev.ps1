# =============================================================================
# Plataforma Defesa Civil MG — Script de inicialização (DESENVOLVIMENTO)
# =============================================================================
# Uso:
#   .\start-dev.ps1            → sobe a stack Docker completa + túnel ngrok
#   .\start-dev.ps1 -Build     → força rebuild das imagens api/web (após mudar código)
#   .\start-dev.ps1 -NoTunnel  → sobe a stack sem o túnel ngrok
#
# O que faz:
#   1. Garante o .env (copia de .env.example se não existir)
#   2. Valida o NGROK_AUTHTOKEN (desativa o túnel se ausente/placeholder)
#   3. Sobe PostgreSQL + Redis (Docker Compose) e aguarda healthchecks
#   4. Aplica as migrations Prisma (a partir do host)
#   5. Sobe API + Web (nginx) e, se habilitado, o ngrok (profile tunnel)
#   6. Lê e exibe a URL pública do ngrok e abre o navegador
#
# Topologia: o ngrok tuneliza o container web (nginx :8080), que serve a SPA e
# faz proxy de /api e /socket.io para a API — tudo na mesma origem pública.
#
# Pré-requisitos: Docker Desktop em execução, Node.js >= 20, pnpm (via corepack).
# =============================================================================

param(
    [switch]$Build,
    [switch]$NoTunnel
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

# ── 2. Validar NGROK_AUTHTOKEN ───────────────────────────────────────────────
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

# ── 4. Migrations (a partir do host) ─────────────────────────────────────────
Write-Host "[4/6] Aplicando migrations Prisma (host → localhost:5436)..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "apps\api")
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] prisma migrate deploy falhou." -ForegroundColor Red
    Pop-Location
    exit 1
}
# Seed idempotente (best-effort — não interrompe o boot se falhar)
npx prisma db seed 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      (seed pulado/falhou — seguindo; dados podem já existir)" -ForegroundColor Gray
} else {
    Write-Host "      Migrations + seed aplicados." -ForegroundColor Green
}
Pop-Location

# ── 5. Subir API + Web (+ ngrok) ─────────────────────────────────────────────
# Monta os argumentos dinamicamente para não passar flags vazias ao compose.
$composeArgs = [System.Collections.Generic.List[string]]::new()
$composeArgs.Add("compose")
if ($usarTunnel) {
    $composeArgs.Add("--profile"); $composeArgs.Add("tunnel")
    Write-Host "[5/6] Subindo API + Web + ngrok (profile tunnel)..." -ForegroundColor Cyan
} else {
    Write-Host "[5/6] Subindo API + Web..." -ForegroundColor Cyan
}
$composeArgs.Add("up"); $composeArgs.Add("-d")
if ($Build) { $composeArgs.Add("--build") }

docker @composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Falha ao subir API/Web. Veja 'docker compose logs'." -ForegroundColor Red
    exit 1
}

Write-Host "      Aguardando a API responder em http://localhost:4000/api/health..." -ForegroundColor Gray
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

# ── 6. Obter URL pública do ngrok ────────────────────────────────────────────
$urlPublica = $null
if ($usarTunnel) {
    Write-Host "[6/6] Aguardando o ngrok gerar a URL pública..." -ForegroundColor Cyan
    $tentativas = 0
    do {
        Start-Sleep -Seconds 2
        $tentativas++
        try {
            $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
            $urlPublica = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } |
                Select-Object -First 1 -ExpandProperty public_url
        } catch { }
    } while (-not $urlPublica -and $tentativas -lt 15)

    if ($urlPublica) {
        Set-Content -Path (Join-Path $Root ".ngrok-url") -Value $urlPublica -Encoding utf8
        Write-Host "      URL pública: $urlPublica" -ForegroundColor Green
    } else {
        Write-Host "      ⚠  Não consegui ler a URL. Veja o inspector em http://localhost:4040" -ForegroundColor Yellow
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
    Write-Host "║  Inspector : http://localhost:4040                   ║" -ForegroundColor Green
}
Write-Host "║  SPA local : http://localhost:8080                   ║" -ForegroundColor Green
Write-Host "║  API       : http://localhost:4000/api               ║" -ForegroundColor Green
Write-Host "║  Swagger   : http://localhost:4000/api/docs          ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Após mudar código: .\start-dev.ps1 -Build           ║" -ForegroundColor Yellow
Write-Host "║  Para parar:        .\stop-dev.ps1                    ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Abre o navegador (URL pública se houver túnel; senão a SPA local)
Start-Sleep -Seconds 2
if ($urlPublica) {
    Start-Process $urlPublica
} else {
    Start-Process "http://localhost:8080"
}

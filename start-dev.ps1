# =============================================================================
# Plataforma Defesa Civil MG — Script de inicialização (DESENVOLVIMENTO)
# =============================================================================
# Uso:
#   .\start-dev.ps1   → sobe PostgreSQL (Docker) + API NestJS (:4000) + Vite (:3000)
#
# O que faz:
#   1. Garante o .env (copia de .env.example se não existir)
#   2. Sobe o PostgreSQL (Docker Compose) e aguarda o healthcheck
#   3. Aplica migrations + seed (Prisma, a partir do host)
#   4. Inicia a API NestJS (:4000) e o Vite (:3000) no host (janelas separadas)
#
# A SPA (Vite :3000) faz proxy de /api para a API (:4000) — mesma origem.
# Cache, filas, WebSocket e Redis foram removidos (instância única).
#
# Pré-requisitos: Docker Desktop em execução, Node.js >= 20, corepack (pnpm).
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

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
        Write-Host "[1/4] .env criado a partir de .env.example." -ForegroundColor Yellow
        Write-Host "      ⚠  Revise as variáveis (JWT secrets, senhas)." -ForegroundColor Yellow
    } else {
        Write-Host "[ERR] .env.example não encontrado. Crie o arquivo .env manualmente." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/4] .env encontrado. OK." -ForegroundColor Green
}

# ── 2. Subir PostgreSQL ───────────────────────────────────────────────────────
Write-Host "[2/4] Subindo PostgreSQL (Docker Compose)..." -ForegroundColor Cyan
docker compose up postgres -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Falha ao subir o container. Verifique o Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "      Aguardando o PostgreSQL ficar saudável..." -ForegroundColor Gray
$tentativas = 0
$maxTentativas = 30
do {
    Start-Sleep -Seconds 2
    $tentativas++
    $status = docker compose ps --format json 2>$null | ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object { $_.Name -match "postgres" }
    $saudavel = ($status | Where-Object { $_.Health -eq "healthy" }).Count
    Write-Host "      Saudável: $saudavel/1 (tentativa $tentativas/$maxTentativas)" -ForegroundColor Gray
} while ($saudavel -lt 1 -and $tentativas -lt $maxTentativas)

if ($saudavel -lt 1) {
    Write-Host "      ⚠  Timeout no healthcheck. Continuando mesmo assim..." -ForegroundColor Yellow
} else {
    Write-Host "      PostgreSQL pronto." -ForegroundColor Green
}

# ── 3. Migrations + seed (a partir do host) ──────────────────────────────────
Write-Host "[3/4] Aplicando migrations Prisma (host → localhost:5436)..." -ForegroundColor Cyan
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

# ── 4. Iniciar API + Vite no host (janelas separadas) ────────────────────────
Write-Host "[4/4] Iniciando API NestJS (:4000) e Vite (:3000) no host..." -ForegroundColor Cyan
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
Write-Host "      Vite iniciado (PID $($webProc.Id))." -ForegroundColor Green

# ── Resumo ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Plataforma em execução!                 ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  SPA local : http://localhost:3000                   ║" -ForegroundColor Green
Write-Host "║  API       : http://localhost:4000/api               ║" -ForegroundColor Green
Write-Host "║  Swagger   : http://localhost:4000/api/docs          ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Para parar: .\stop-dev.ps1                           ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

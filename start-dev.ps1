# =============================================================================
# Plataforma Defesa Civil MG — Script de inicialização (DESENVOLVIMENTO)
# =============================================================================
# Uso: .\start-dev.ps1
#
# O que faz:
#   1. Verifica se o .env existe (copia de .env.example se não existir)
#   2. Sobe PostgreSQL + Redis via Docker Compose
#   3. Aguarda os serviços ficarem saudáveis
#   4. Executa as migrations Prisma (prisma migrate deploy)
#   5. Inicia a API NestJS em modo watch (processo separado)
#   6. Inicia o frontend Vite em modo dev (processo separado)
#
# Pré-requisitos:
#   - Docker Desktop instalado e em execução
#   - Node.js >= 20 instalado
#   - pnpm instalado (npm install -g pnpm)
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Plataforma Defesa Civil MG — Inicialização      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar .env ─────────────────────────────────────────────────────────
$envFile = Join-Path $Root ".env"
$envExample = Join-Path $Root ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[1/6] .env criado a partir de .env.example." -ForegroundColor Yellow
        Write-Host "      ⚠  Revise as variáveis (especialmente JWT_ACCESS_SECRET e senhas)." -ForegroundColor Yellow
    } else {
        Write-Host "[ERR] .env.example não encontrado. Crie o arquivo .env manualmente." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/6] .env encontrado. OK." -ForegroundColor Green
}

# ── 2. Subir PostgreSQL + Redis ───────────────────────────────────────────────
Write-Host "[2/6] Subindo PostgreSQL e Redis (Docker Compose)..." -ForegroundColor Cyan
Set-Location $Root
docker compose up postgres redis -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Falha ao subir os containers. Verifique o Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "      Containers iniciados." -ForegroundColor Green

# ── 3. Aguardar healthchecks ──────────────────────────────────────────────────
Write-Host "[3/6] Aguardando PostgreSQL e Redis ficarem saudáveis..." -ForegroundColor Cyan
$tentativas = 0
$maxTentativas = 30
do {
    Start-Sleep -Seconds 2
    $tentativas++
    $status = docker compose ps --format json 2>$null | ForEach-Object {
        $_ | ConvertFrom-Json
    } | Where-Object { $_.Name -match "postgres|redis" }
    $saudaveis = ($status | Where-Object { $_.Health -eq "healthy" }).Count
    Write-Host "      Saudáveis: $saudaveis/2 (tentativa $tentativas/$maxTentativas)" -ForegroundColor Gray
} while ($saudaveis -lt 2 -and $tentativas -lt $maxTentativas)

if ($saudaveis -lt 2) {
    Write-Host "      ⚠  Timeout aguardando healthcheck. Continuando mesmo assim..." -ForegroundColor Yellow
} else {
    Write-Host "      PostgreSQL + Redis prontos." -ForegroundColor Green
}

# ── 4. Instalar dependências + migrations ────────────────────────────────────
Write-Host "[4/6] Instalando dependências e aplicando migrations..." -ForegroundColor Cyan
Set-Location $Root

# Instala dependências se node_modules não existir
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Host "      Executando pnpm install..." -ForegroundColor Gray
    pnpm install
}

# Gera o Prisma Client
Write-Host "      Gerando Prisma Client..." -ForegroundColor Gray
Set-Location (Join-Path $Root "apps\api")
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] prisma generate falhou." -ForegroundColor Red; exit 1 }

# Aplica migrations
Write-Host "      Aplicando migrations (prisma migrate deploy)..." -ForegroundColor Gray
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] prisma migrate deploy falhou." -ForegroundColor Red; exit 1 }

Write-Host "      Migrations aplicadas." -ForegroundColor Green
Set-Location $Root

# ── 5. Iniciar API (background) ───────────────────────────────────────────────
Write-Host "[5/6] Iniciando API NestJS (porta 4000)..." -ForegroundColor Cyan
$apiJob = Start-Process -PassThru -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; `$host.ui.RawUI.WindowTitle = 'DCMG - API'; pnpm --filter @dcmg/api start:dev"
) -WindowStyle Normal

Write-Host "      API iniciada (PID $($apiJob.Id))." -ForegroundColor Green

# Aguarda a API subir (tenta /api/health por até 30s)
Write-Host "      Aguardando API responder em http://localhost:4000/api/health..." -ForegroundColor Gray
$tentativas = 0
do {
    Start-Sleep -Seconds 2
    $tentativas++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch { }
} while ($tentativas -lt 15)
Write-Host "      API pronta." -ForegroundColor Green

# ── 6. Iniciar Frontend (background) ─────────────────────────────────────────
Write-Host "[6/6] Iniciando frontend Vite (porta 5173)..." -ForegroundColor Cyan
$webJob = Start-Process -PassThru -FilePath "powershell" -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; `$host.ui.RawUI.WindowTitle = 'DCMG - Web'; pnpm --filter @dcmg/web dev"
) -WindowStyle Normal

Write-Host "      Frontend iniciado (PID $($webJob.Id))." -ForegroundColor Green

# ── Resumo ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Plataforma em execução!                 ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Frontend : http://localhost:5173                    ║" -ForegroundColor Green
Write-Host "║  API      : http://localhost:4000/api                ║" -ForegroundColor Green
Write-Host "║  Swagger  : http://localhost:4000/api/docs           ║" -ForegroundColor Green
Write-Host "║  Health   : http://localhost:4000/api/health/ready   ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Para parar: .\stop-dev.ps1                          ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Abre o navegador
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

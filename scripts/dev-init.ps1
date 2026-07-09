<#
.SYNOPSIS
    Inicializa o ambiente de desenvolvimento local da Plataforma Defesa Civil MG.

.DESCRIPTION
    Script idempotente (pode ser rodado varias vezes sem quebrar nada). Prepara
    tudo que e necessario para rodar `corepack pnpm dev` localmente:
      1) Valida Node.js e resolve o pnpm certo via `corepack pnpm` (nao exige
         um `pnpm` "puro" no PATH -- em varias maquinas o shim global do
         corepack nao fica disponivel sem admin/reiniciar o shell).
      2) Cria (ou repara) os arquivos .env a partir do template correto.
      3) Sobe o PostgreSQL via Docker Compose e aguarda ficar saudavel.
      4) Instala as dependencias do monorepo.
      5) Builda o pacote @dcmg/contracts (a API/Web dependem do dist dele).
      6) Gera o Prisma Client, aplica as migrations e roda o seed.

    Obs.: este arquivo evita acentos de proposito (ASCII puro). Scripts .ps1
    sem BOM podem ser lidos com o codepage errado pelo Windows PowerShell 5.1,
    corrompendo caracteres multi-byte (acentos, travessao) e quebrando o parse.

.PARAMETER SkipInstall
    Pula o `corepack pnpm install` (util em reruns rapidos, quando nada mudou no lockfile).

.PARAMETER SkipDocker
    Pula a subida do container do PostgreSQL (use se voce ja tem um Postgres
    proprio rodando em localhost:5436, ou se o Docker Desktop nao estiver disponivel).

.PARAMETER SkipMigrate
    Pula `prisma migrate deploy` (o schema ja esta em dia).

.PARAMETER SkipSeed
    Pula `prisma db seed` (o banco ja tem os dados base).

.EXAMPLE
    ./scripts/dev-init.ps1
    Primeira configuracao completa da maquina.

.EXAMPLE
    ./scripts/dev-init.ps1 -SkipInstall -SkipDocker
    Rerun rapido: so confere o .env, roda migrations/seed pendentes.
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDocker,
    [switch]$SkipMigrate,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

# ----------------------------------------------------------------------------
# Helpers de output
# ----------------------------------------------------------------------------
function Write-Step  ($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn2 ($msg) { Write-Host "    AVISO  $msg" -ForegroundColor Yellow }
function Write-Fail  ($msg) {
    Write-Host ""
    Write-Host "ERRO: $msg" -ForegroundColor Red
    exit 1
}

function Invoke-Checked {
    param([string]$Descricao, [scriptblock]$Comando)
    & $Comando
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falhou: $Descricao (exit code $LASTEXITCODE)"
    }
}

function New-RandomHex {
    param([int]$Bytes = 32)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    ($buffer | ForEach-Object { $_.ToString("x2") }) -join ""
}

# ----------------------------------------------------------------------------
# Localiza a raiz do repo (este script vive em <raiz>/scripts/)
# ----------------------------------------------------------------------------
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
Write-Host "Plataforma Defesa Civil MG - inicializacao do ambiente dev" -ForegroundColor Magenta
Write-Host "Repo: $RepoRoot"

# ----------------------------------------------------------------------------
# 1) Node.js + pnpm (via corepack)
# ----------------------------------------------------------------------------
Write-Step "Verificando Node.js e pnpm"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js nao encontrado no PATH. Instale o Node (veja .nvmrc) antes de continuar."
}

$nodeVersionAtual = (node -v).TrimStart("v")
$nodeVersionEsperada = (Get-Content (Join-Path $RepoRoot ".nvmrc")).Trim()
if (-not $nodeVersionAtual.StartsWith($nodeVersionEsperada)) {
    Write-Warn2 "Node $nodeVersionAtual detectado, .nvmrc pede versao $nodeVersionEsperada.x - o app/build funcionam, mas dependencias com binarios nativos (ex.: better-sqlite3, transitiva do mapshaper) podem falhar ao compilar sem o toolchain certo para essa versao do Node."
} else {
    Write-Ok "Node $nodeVersionAtual"
}

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    Write-Fail "corepack nao encontrado (vem com o Node >= 16.9). Atualize o Node.js."
}

$packageJson = Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
$pnpmVersion = ($packageJson.packageManager -split "@")[1]

# NAO dependemos de um `pnpm` "puro" no PATH: em varias maquinas (sem admin,
# ou sem reiniciar o shell apos instalar o Node) o `corepack enable`/`prepare
# --activate` nao cria o shim global, e um `pnpm ...` direto falha com
# "termo nao reconhecido". `corepack pnpm ...` funciona sempre, pois o proprio
# corepack resolve a versao certa a partir do campo "packageManager" do
# package.json -- e por isso o script chama SEMPRE `corepack pnpm`, nunca
# `pnpm` puro (veja os passos abaixo).
try {
    corepack enable *> $null
} catch {
    # Best-effort: se falhar (ex.: sem privilegio admin), nao e fatal --
    # `corepack pnpm` funciona independente disso.
    Write-Warn2 "corepack enable retornou aviso (normalmente inofensivo): $($_.Exception.Message)"
}

$pnpmDetectado = corepack pnpm --version
if ($LASTEXITCODE -ne 0 -or -not $pnpmDetectado) {
    Write-Fail "'corepack pnpm --version' falhou. Verifique a instalacao do Node/corepack."
}
Write-Ok "pnpm $pnpmDetectado disponivel via 'corepack pnpm' (esperado: $pnpmVersion)"

# ----------------------------------------------------------------------------
# 2) Arquivos .env -- cria a partir do template correto e repara problemas
#    conhecidos (DATABASE_URL invalida, segredos JWT ainda no valor padrao).
#
#    IMPORTANTE: o ConfigModule da API le "../../.env" (raiz) ANTES de
#    "apps/api/.env" -- em caso de a mesma variavel existir nos dois, a da
#    RAIZ tem precedencia. Por isso mantemos os dois arquivos sincronizados,
#    usando apps/api/.env.example como template (e o unico atualizado com a
#    arquitetura atual -- sem Redis/S3).
# ----------------------------------------------------------------------------
Write-Step "Verificando arquivos .env"

$templatePath = Join-Path $RepoRoot "apps/api/.env.example"
if (-not (Test-Path $templatePath)) {
    Write-Fail "Template nao encontrado: $templatePath"
}

$envTargets = @(
    (Join-Path $RepoRoot ".env"),
    (Join-Path $RepoRoot "apps/api/.env")
)

foreach ($envPath in $envTargets) {
    if (-not (Test-Path $envPath)) {
        Copy-Item $templatePath $envPath
        Write-Warn2 "Criado $envPath a partir do template (apps/api/.env.example)."
    } else {
        Write-Ok "$envPath ja existe -- mantendo valores atuais."
    }
}

function Get-EnvValor {
    param([string[]]$Linhas, [string]$Chave, [string]$Padrao)
    $linha = $Linhas | Where-Object { $_ -match "^\s*$Chave\s*=" } | Select-Object -First 1
    if (-not $linha) { return $Padrao }
    $valor = ($linha -split "=", 2)[1].Trim().Trim('"')
    if ([string]::IsNullOrWhiteSpace($valor)) { return $Padrao }
    return $valor
}

# Valores de exemplo conhecidos dos templates do repo (raiz e apps/api). Match
# EXATO de proposito -- nunca sobrescreve um segredo real que o dev ja gerou.
$PlaceholdersJwtAccess = @(
    "troque-este-segredo-de-access",
    "gere-um-segredo-aleatorio-com-no-minimo-32-caracteres"
)
$PlaceholdersJwtRefresh = @(
    "troque-este-segredo-de-refresh",
    "gere-OUTRO-segredo-aleatorio-distinto-do-access-32+"
)

function Repair-EnvFile {
    param([string]$EnvPath)

    $linhas = Get-Content $EnvPath
    $alterado = $false

    $pgUser = Get-EnvValor -Linhas $linhas -Chave "POSTGRES_USER" -Padrao "dcmg"
    $pgPass = Get-EnvValor -Linhas $linhas -Chave "POSTGRES_PASSWORD" -Padrao "dcmg"
    $pgDb   = Get-EnvValor -Linhas $linhas -Chave "POSTGRES_DB" -Padrao "defesa_civil_mg"

    for ($i = 0; $i -lt $linhas.Count; $i++) {
        $linha = $linhas[$i]

        # --- DATABASE_URL precisa (1) comecar com postgres:// ou postgresql://
        #     e (2) apontar para o Postgres LOCAL, nao para um host remoto
        #     (Azure, RDS, etc.). Este script prepara um ambiente de DEV e
        #     depois roda `prisma migrate deploy` / `prisma db seed` -- SE a
        #     DATABASE_URL apontar para producao (ex.: copiada sem querer de
        #     um .env.example antigo ou de outra maquina), esses comandos
        #     rodariam contra o banco de PRODUCAO de verdade. Ja aconteceu
        #     neste projeto (DATABASE_URL com host *.postgres.database.azure.com
        #     dentro do apps/api/.env local) -- por isso a checagem e agressiva
        #     de proposito: qualquer host que nao seja localhost/127.0.0.1 e
        #     tratado como invalido para este script, mesmo que a URL seja
        #     sintaticamente valida.
        if ($linha -match "^\s*DATABASE_URL\s*=") {
            $valor = ($linha -split "=", 2)[1].Trim().Trim('"')
            $novaUrl = "postgresql://${pgUser}:${pgPass}@localhost:5436/${pgDb}?schema=public"

            if ($valor -notmatch "^postgres(ql)?://") {
                Write-Warn2 "$EnvPath -- DATABASE_URL invalida (valor: $valor), corrigindo para o Postgres local de dev."
                $linhas[$i] = "DATABASE_URL=$novaUrl"
                $alterado = $true
            } elseif ($valor -notmatch "@(localhost|127\.0\.0\.1)[:/]") {
                Write-Warn2 "$EnvPath -- DATABASE_URL aponta para um host REMOTO (nao localhost) -- provavelmente producao/staging copiada por engano. Este script so deve rodar contra um Postgres local: corrigindo para $novaUrl. Se voce realmente precisa apontar para outro banco, edite o .env DEPOIS de rodar este script."
                $linhas[$i] = "DATABASE_URL=$novaUrl"
                $alterado = $true
            }
        }

        # --- Segredos JWT ainda no valor de exemplo de algum dos templates ---
        if ($linha -match "^\s*JWT_ACCESS_SECRET\s*=") {
            $valor = ($linha -split "=", 2)[1].Trim().Trim('"')
            if ($PlaceholdersJwtAccess -contains $valor) {
                $linhas[$i] = "JWT_ACCESS_SECRET=$(New-RandomHex 32)"
                Write-Warn2 "$EnvPath -- gerado um JWT_ACCESS_SECRET aleatorio (estava com o valor de exemplo)."
                $alterado = $true
            }
        }
        if ($linha -match "^\s*JWT_REFRESH_SECRET\s*=") {
            $valor = ($linha -split "=", 2)[1].Trim().Trim('"')
            if ($PlaceholdersJwtRefresh -contains $valor) {
                $linhas[$i] = "JWT_REFRESH_SECRET=$(New-RandomHex 32)"
                Write-Warn2 "$EnvPath -- gerado um JWT_REFRESH_SECRET aleatorio (estava com o valor de exemplo)."
                $alterado = $true
            }
        }
    }

    if ($alterado) {
        Set-Content -Path $EnvPath -Value $linhas -Encoding utf8
        Write-Ok "$EnvPath reparado."
    } else {
        Write-Ok "$EnvPath sem problemas conhecidos."
    }
}

foreach ($envPath in $envTargets) {
    Repair-EnvFile -EnvPath $envPath
}

# ----------------------------------------------------------------------------
# 3) PostgreSQL via Docker Compose
# ----------------------------------------------------------------------------
if (-not $SkipDocker) {
    Write-Step "Subindo o PostgreSQL (Docker Compose)"

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker nao encontrado no PATH. Instale o Docker Desktop ou rode com -SkipDocker se ja tiver um Postgres proprio em localhost:5436."
    }

    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Docker Desktop nao parece estar rodando. Abra o Docker Desktop e tente novamente (ou use -SkipDocker)."
    }

    Invoke-Checked "docker compose up -d postgres" {
        docker compose up -d postgres
    }

    Write-Host "    Aguardando o Postgres aceitar conexoes..." -NoNewline
    $pgUserEnv = (Get-Content (Join-Path $RepoRoot ".env") | Where-Object { $_ -match "^POSTGRES_USER=" } | Select-Object -First 1)
    $pgUserEnv = if ($pgUserEnv) { ($pgUserEnv -split "=", 2)[1].Trim() } else { "dcmg" }

    $tentativas = 0
    $pronto = $false
    while ($tentativas -lt 30 -and -not $pronto) {
        docker compose exec -T postgres pg_isready -U $pgUserEnv *> $null
        if ($LASTEXITCODE -eq 0) {
            $pronto = $true
        } else {
            Start-Sleep -Seconds 2
            $tentativas++
            Write-Host "." -NoNewline
        }
    }
    Write-Host ""

    if (-not $pronto) {
        Write-Fail "Postgres nao ficou pronto a tempo. Rode 'docker compose logs postgres' para investigar."
    }
    Write-Ok "Postgres pronto em localhost:5436"
} else {
    Write-Step "Pulando Docker (-SkipDocker) -- assumindo que ha um Postgres acessivel em DATABASE_URL"
}

# ----------------------------------------------------------------------------
# 4) Dependencias do monorepo
#
#    Uma instalacao anterior INTERROMPIDA (fechar o terminal, sleep do
#    Windows, antivirus bloqueando arquivos durante o rm/instalacao) pode
#    deixar node_modules pela metade sem que o proximo `pnpm install` note
#    -- ele confia no hash do lockfile e nao reinstala nada. O sintoma
#    classico: `tsc`/`prisma`/etc falham la na frente com "Cannot find
#    module ...\node_modules\<pacote>\...", bem longe da causa real. Por
#    isso verificamos a instalacao logo apos o install e, se algo faltar,
#    limpamos e reinstalamos automaticamente (uma vez) antes de prosseguir.
# ----------------------------------------------------------------------------
function Test-InstalacaoCompleta {
    corepack pnpm --filter @dcmg/contracts exec tsc --version *> $null
    return ($LASTEXITCODE -eq 0)
}

if (-not $SkipInstall) {
    Write-Step "Instalando dependencias (corepack pnpm install)"
    Invoke-Checked "corepack pnpm install" { corepack pnpm install }
    Write-Ok "Dependencias instaladas"

    Write-Step "Verificando integridade da instalacao"
    if (-not (Test-InstalacaoCompleta)) {
        Write-Warn2 "Instalacao incompleta detectada (provavel resquicio de uma instalacao anterior interrompida). Limpando node_modules e reinstalando..."
        foreach ($nm in @("node_modules", "apps/api/node_modules", "apps/web/node_modules", "packages/contracts/node_modules")) {
            $full = Join-Path $RepoRoot $nm
            if (Test-Path $full) {
                Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        Invoke-Checked "corepack pnpm install (nova tentativa apos limpeza)" { corepack pnpm install }

        if (-not (Test-InstalacaoCompleta)) {
            Write-Fail "Instalacao continua incompleta apos reinstalar do zero. Possiveis causas: antivirus bloqueando arquivos durante a instalacao, ou o VS Code/outro processo com o node_modules aberto. Feche o editor, desative temporariamente o antivirus (ou adicione uma excecao para a pasta do repo) e rode o script de novo."
        }
    }
    Write-Ok "Instalacao verificada"
} else {
    Write-Step "Pulando install de dependencias (-SkipInstall)"
}

# ----------------------------------------------------------------------------
# 5) Build do pacote de contratos compartilhados
# ----------------------------------------------------------------------------
Write-Step "Buildando @dcmg/contracts"
Invoke-Checked "corepack pnpm --filter @dcmg/contracts build" {
    corepack pnpm --filter @dcmg/contracts build
}
Write-Ok "@dcmg/contracts buildado"

# ----------------------------------------------------------------------------
# 6) Prisma: generate + migrate + seed
#
#    Guarda final: uma variavel de ambiente DATABASE_URL ja exportada NESTA
#    sessao do shell (ex.: `$env:DATABASE_URL = "..."` num perfil do
#    PowerShell, ou herdada de um terminal anterior) tem PRECEDENCIA sobre o
#    .env e ignoraria silenciosamente todo o reparo feito no passo 2. Como
#    migrate/seed são operacoes que ESCREVEM no banco, checamos aqui de novo,
#    direto no processo, antes de continuar.
# ----------------------------------------------------------------------------
if ($env:DATABASE_URL -and ($env:DATABASE_URL -notmatch "@(localhost|127\.0\.0\.1)[:/]")) {
    Write-Fail "A variavel de ambiente DATABASE_URL desta sessao do shell aponta para um host remoto (nao localhost) -- isso teria PRECEDENCIA sobre o .env e faria as migrations/seed rodarem contra esse banco remoto. Rode 'Remove-Item Env:\DATABASE_URL' nesta sessao (ou abra um terminal novo) e execute o script de novo."
}

Write-Step "Gerando o Prisma Client"
Invoke-Checked "prisma generate" {
    corepack pnpm --filter @dcmg/api exec prisma generate
}
Write-Ok "Prisma Client gerado"

if (-not $SkipMigrate) {
    Write-Step "Aplicando migrations (prisma migrate deploy)"
    Invoke-Checked "prisma migrate deploy" {
        corepack pnpm --filter @dcmg/api exec prisma migrate deploy
    }
    Write-Ok "Migrations aplicadas"
} else {
    Write-Step "Pulando migrations (-SkipMigrate)"
}

if (-not $SkipSeed) {
    Write-Step "Rodando o seed (perfis, permissoes, UFs, municipios, admin)"
    Invoke-Checked "prisma db seed" {
        corepack pnpm --filter @dcmg/api exec prisma db seed
    }
    Write-Ok "Seed concluido"
} else {
    Write-Step "Pulando seed (-SkipSeed)"
}

# ----------------------------------------------------------------------------
# Resumo final
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "Ambiente de desenvolvimento pronto." -ForegroundColor Green
Write-Host ""
Write-Host "Para rodar a aplicacao (API + Web em paralelo):"
Write-Host "  corepack pnpm dev" -ForegroundColor Cyan
Write-Host "  (use 'corepack pnpm', nao 'pnpm' puro -- nesta maquina o pnpm nao esta no PATH)"
Write-Host ""
Write-Host "URLs locais:"
Write-Host "  Web (Vite)      http://localhost:5173"
Write-Host "  API             http://localhost:4000/api"
Write-Host "  Swagger (docs)  http://localhost:4000/api/docs"
Write-Host ""
Write-Host "Login padrao do seed (SOMENTE DEV -- nunca use em producao):"
Write-Host "  e-mail: admin@defesacivil.mg.gov.br"
Write-Host "  senha:  Defesa@Civil2026!"
Write-Host ""

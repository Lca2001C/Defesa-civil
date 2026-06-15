# =============================================================================
# Plataforma Defesa Civil MG — Script de parada (DESENVOLVIMENTO)
# =============================================================================
# Derruba toda a stack Docker (postgres, redis, api, web e ngrok do profile
# tunnel). Os volumes (dados do Postgres, uploads) são preservados.
# =============================================================================

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "Parando Plataforma Defesa Civil MG..." -ForegroundColor Yellow

# Derruba todos os serviços, incluindo o ngrok (profile tunnel).
Write-Host "  Derrubando containers (incl. ngrok)..." -ForegroundColor Gray
docker compose --profile tunnel down
Write-Host "  Containers removidos (volumes preservados)." -ForegroundColor Green

# Remove o arquivo com a última URL pública do ngrok, se existir.
$ngrokUrlFile = Join-Path $Root ".ngrok-url"
if (Test-Path $ngrokUrlFile) {
    Remove-Item $ngrokUrlFile -Force -ErrorAction SilentlyContinue
}

# Encerra processos Node residuais do modo antigo (Vite/Nest no host), se houver.
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Processos Node.js residuais encerrados ($($nodeProcs.Count))." -ForegroundColor Green
}

Write-Host "  Plataforma parada." -ForegroundColor Green
Write-Host ""

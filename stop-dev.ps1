# =============================================================================
# Plataforma Defesa Civil MG — Script de parada (DESENVOLVIMENTO)
# =============================================================================
# Derruba a stack Docker (postgres). Os volumes (dados do Postgres, uploads)
# são preservados.
# =============================================================================

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "Parando Plataforma Defesa Civil MG..." -ForegroundColor Yellow

Write-Host "  Derrubando containers..." -ForegroundColor Gray
docker compose down
Write-Host "  Containers removidos (volumes preservados)." -ForegroundColor Green

# Encerra processos Node residuais (Vite/Nest no host), se houver.
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Processos Node.js residuais encerrados ($($nodeProcs.Count))." -ForegroundColor Green
}

Write-Host "  Plataforma parada." -ForegroundColor Green
Write-Host ""

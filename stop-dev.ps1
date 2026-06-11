# =============================================================================
# Plataforma Defesa Civil MG — Script de parada (DESENVOLVIMENTO)
# =============================================================================
# Para os containers Docker (PostgreSQL + Redis) e mata processos Node da API
# e do frontend Vite que foram iniciados pelo start-dev.ps1
# =============================================================================

Write-Host ""
Write-Host "Parando Plataforma Defesa Civil MG..." -ForegroundColor Yellow

# Para os containers
Write-Host "  Parando containers Docker..." -ForegroundColor Gray
docker compose stop postgres redis
Write-Host "  Containers parados." -ForegroundColor Green

# Mata processos node que estejam rodando nest ou vite
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Processos Node.js encerrados ($($nodeProcs.Count))." -ForegroundColor Green
} else {
    Write-Host "  Nenhum processo Node.js ativo encontrado." -ForegroundColor Gray
}

Write-Host "  Plataforma parada." -ForegroundColor Green
Write-Host ""

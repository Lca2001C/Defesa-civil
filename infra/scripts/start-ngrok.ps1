# =============================================================================
# Plataforma Defesa Civil MG — Iniciar com Ngrok (acesso público temporário)
# =============================================================================
# Ativa o perfil "tunnel" do Docker Compose que sobe o container do Ngrok,
# criando uma URL pública HTTPS/WSS que aponta para a plataforma local.
#
# Uso:
#   1. Primeiro inicie a plataforma: .\start-dev.ps1
#   2. Depois execute: .\infra\scripts\start-ngrok.ps1
#
# O NGROK_AUTHTOKEN deve estar definido no .env
# Obtenha em: https://dashboard.ngrok.com
# =============================================================================

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

Write-Host ""
Write-Host "Iniciando Ngrok (perfil tunnel)..." -ForegroundColor Cyan

docker compose --profile tunnel up ngrok -d

Write-Host "Aguardando Ngrok gerar a URL pública..." -ForegroundColor Gray
Start-Sleep -Seconds 4

# Exibe a URL pública via API local do Ngrok
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    foreach ($t in $tunnels.tunnels) {
        Write-Host ""
        Write-Host "  URL pública: $($t.public_url)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  Painel Ngrok: http://localhost:4040" -ForegroundColor Gray
    Write-Host ""
    # Abre o navegador com a URL pública
    $url = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    if ($url) { Start-Process $url }
} catch {
    Write-Host "  (Ngrok ainda iniciando — acesse http://localhost:4040 para ver a URL)" -ForegroundColor Yellow
}

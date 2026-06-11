# =============================================================================
# Substitui o logo SVG gerado pelo logo PNG/SVG oficial fornecido.
# =============================================================================
# Uso:
#   .\infra\scripts\set-logo.ps1 -ImagemPath "C:\caminho\para\logo.png"
#
# A imagem será copiada para apps/web/public/logo.png (ou .svg conforme extensão)
# e o index.html será atualizado com o tipo MIME correto.
# =============================================================================
param(
    [Parameter(Mandatory=$true)]
    [string]$ImagemPath
)

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ext = [System.IO.Path]::GetExtension($ImagemPath).ToLower()

if ($ext -eq ".png") {
    $destino = Join-Path $Root "apps\web\public\logo.png"
    Copy-Item -Path $ImagemPath -Destination $destino -Force
    Write-Host "Logo copiado para: $destino" -ForegroundColor Green

    # Atualiza index.html para referenciar .png
    $html = Join-Path $Root "apps\web\index.html"
    (Get-Content $html -Raw) `
        -replace 'href="/logo\.svg"', 'href="/logo.png"' `
        -replace 'type="image/svg\+xml"', 'type="image/png"' |
        Set-Content $html -Encoding UTF8
    Write-Host "index.html atualizado para logo.png" -ForegroundColor Green

    # Atualiza AppLayout.tsx
    $layout = Join-Path $Root "apps\web\src\app\AppLayout.tsx"
    (Get-Content $layout -Raw) -replace '"/logo\.svg"', '"/logo.png"' |
        Set-Content $layout -Encoding UTF8
    Write-Host "AppLayout.tsx atualizado para logo.png" -ForegroundColor Green

} elseif ($ext -eq ".svg") {
    $destino = Join-Path $Root "apps\web\public\logo.svg"
    Copy-Item -Path $ImagemPath -Destination $destino -Force
    Write-Host "Logo SVG copiado para: $destino" -ForegroundColor Green
} else {
    Write-Host "[ERR] Formato não suportado: $ext. Use .png ou .svg." -ForegroundColor Red
    exit 1
}

Write-Host "Pronto! Reinicie o servidor dev para ver as mudanças." -ForegroundColor Cyan

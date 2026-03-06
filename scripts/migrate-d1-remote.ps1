# Script para ejecutar migraciones D1 en producción (remote).
# Ejecutar desde la raíz del proyecto.

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "Migraciones D1 REMOTE (producción) - venezuela-live-db" -ForegroundColor Cyan
Write-Host ""

$migrations = @(
    "./migrations/0001_create_profiles.sql",
    "./migrations/0002_add_username.sql",
    "./migrations/0003_create_proposals_schema.sql",
    "./migrations/0004_seed_proposals.sql",
    "./migrations/0005_create_achievements.sql",
    "./migrations/0006_create_user_achievements.sql",
    "./migrations/0007_add_gamification_to_profiles.sql"
)

foreach ($m in $migrations) {
    if (Test-Path $m) {
        Write-Host "Ejecutando: $m" -ForegroundColor Gray
        npx wrangler d1 execute venezuela-live-db --remote --file=$m
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host ""
Write-Host "Migraciones remotas completadas correctamente." -ForegroundColor Green
exit 0

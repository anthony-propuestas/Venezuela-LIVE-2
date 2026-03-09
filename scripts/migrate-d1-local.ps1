# Script para ejecutar migraciones D1 locales de forma segura.
# Usa --persist-to en %LOCALAPPDATA% para evitar SQLITE_READONLY
# (Desktop/OneDrive puede bloquear escritura en la carpeta del proyecto).
# El worker (dev:worker) debe usar la misma ruta: npm run dev:worker

$WranglerPort = 8787
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$PersistPath = "$env:LOCALAPPDATA\venezuela-live-wrangler"

# 1. Comprobar si wrangler dev esta corriendo
$portInUse = $false
try {
    $conn = Get-NetTCPConnection -LocalPort $WranglerPort -ErrorAction SilentlyContinue
    if ($conn) { $portInUse = $true }
} catch { }

if (-not $portInUse) {
    $netstat = netstat -ano 2>$null | Select-String ":$WranglerPort\s"
    if ($netstat) { $portInUse = $true }
}

if ($portInUse) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ERROR: El worker esta en ejecucion" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cierra la terminal donde corre 'npm run dev:worker'" -ForegroundColor White
    Write-Host "Luego ejecuta: npm run db:migrate:local:safe" -ForegroundColor White
    Write-Host ""
    exit 1
}

# 2. Ejecutar migraciones con persist-to en AppData (evita SQLITE_READONLY)
Set-Location $ProjectRoot
Write-Host "Usando persistencia en: $PersistPath" -ForegroundColor Cyan
Write-Host "Ejecutando migraciones D1 locales..." -ForegroundColor Cyan
# Permitir que comandos nativos (npx/wrangler) devuelvan errores sin detener todo el script,
# para poder inspeccionar la salida y manejar casos esperados como la columna username duplicada.
$ErrorActionPreference = "Continue"

$migrations = @(
    "./migrations/0001_create_profiles.sql",
    "./migrations/0002_add_username.sql",
    "./migrations/0003_create_proposals_schema.sql",
    "./migrations/0004_seed_proposals.sql",
    "./migrations/0005_create_achievements.sql",
    "./migrations/0006_create_user_achievements.sql",
    "./migrations/0007_add_gamification_to_profiles.sql",
    "./migrations/0008_add_is_premium_and_payment_tickets.sql",
    "./migrations/0009_add_unique_email_and_payment_reference.sql",
    "./migrations/0010_add_role_to_profiles.sql"
)

foreach ($m in $migrations) {
    if (Test-Path $m) {
        $output = npx wrangler d1 execute venezuela-live-db --local --persist-to=$PersistPath --file=$m 2>&1
        if ($LASTEXITCODE -ne 0) {
            # Caso especial: la migracion 0002 puede fallar con "duplicate column name: username"
            # cuando ya se aplico previamente sobre esta base local. En ese caso, continuamos.
            if ($m -like "*0002_add_username.sql" -and ($output -match "duplicate column name: username")) {
                Write-Host "Aviso: la columna 'username' ya existe en la base local. Se omite este error y se continua." -ForegroundColor Yellow
                continue
            }

            Write-Host "Error al ejecutar migracion $m" -ForegroundColor Red
            Write-Host $output
            exit $LASTEXITCODE
        }
    }
}

Write-Host ""
Write-Host "Migraciones completadas correctamente." -ForegroundColor Green
Write-Host "Nota: Ejecuta 'npm run dev:worker' para que el worker use la misma BD." -ForegroundColor Gray
exit 0

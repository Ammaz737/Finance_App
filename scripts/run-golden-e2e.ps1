$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$databaseUrl = "postgresql://postgres:12345@localhost:5432/finance_e2e"
$env:PGPASSWORD = "12345"
$env:COREPACK_HOME = Join-Path $root ".corepack"
$env:NODE_OPTIONS = "--require=$root\scripts\node-userinfo-shim.cjs"
New-Item -ItemType Directory -Force -Path (Join-Path $root "apps\web\test-results") | Out-Null

function Wait-Http([string]$Url) {
  $uri = [Uri]$Url
  for ($i = 0; $i -lt 40; $i++) {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect($uri.Host, $uri.Port); if ($client.Connected) { return } } catch {} finally { $client.Dispose() }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for $Url"
}

& $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'finance_e2e';"
& $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS finance_e2e;"
& $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE finance_e2e;"

try {
  Push-Location (Join-Path $root "apps\api")
  $env:DATABASE_URL = $databaseUrl
  & (Join-Path $root "node_modules\.bin\prisma.CMD") migrate deploy --schema prisma/schema.prisma
  & (Join-Path $root "node_modules\.bin\tsx.CMD") prisma/seed.ts
  & (Join-Path $root "node_modules\.bin\tsx.CMD") prisma/seed-e2e-tenant.ts
  Pop-Location

  $api = Start-Process -FilePath "node.exe" -ArgumentList @((Join-Path $root "node_modules\tsx\dist\cli.mjs"), "apps/api/src/app/server.ts") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root "apps\web\test-results\api.log") -RedirectStandardError (Join-Path $root "apps\web\test-results\api-error.log") -Environment @{
    DATABASE_URL=$databaseUrl; REDIS_URL="redis://localhost:6379"; JWT_SECRET="golden-e2e-secret"; PORT="3101"; NODE_ENV="test"; PAYMENT_PROVIDER_MODE="mock"; STORAGE_PATH=(Join-Path $root "data\e2e-uploads"); NODE_OPTIONS=$env:NODE_OPTIONS
  }
  $web = Start-Process -FilePath "node.exe" -ArgumentList @((Join-Path $root "apps\web\node_modules\next\dist\bin\next"), "dev", "apps/web", "-p", "3102") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root "apps\web\test-results\web.log") -RedirectStandardError (Join-Path $root "apps\web\test-results\web-error.log") -Environment @{
    API_ORIGIN="http://localhost:3101"; NODE_ENV="development"; NEXT_PUBLIC_ENABLE_P1_ROUTES="false"; NEXT_PUBLIC_ENABLE_P2_ROUTES="false"; NODE_OPTIONS=$env:NODE_OPTIONS
  }
  Wait-Http "http://localhost:3101/api/v1/health"
  Wait-Http "http://localhost:3102/login"
  Push-Location (Join-Path $root "apps\web")
  $env:E2E_BASE_URL = "http://localhost:3102"
  & .\node_modules\.bin\playwright.CMD test
  if ($LASTEXITCODE -ne 0) { throw "Playwright failed with exit code $LASTEXITCODE" }
  Pop-Location
} finally {
  if ($api -and !$api.HasExited) { Stop-Process -Id $api.Id -Force }
  if ($web -and !$web.HasExited) { Stop-Process -Id $web.Id -Force }
  Pop-Location -ErrorAction SilentlyContinue
}

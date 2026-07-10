$ErrorActionPreference = "Stop"

$port = if ($env:DASHBOARD_VERIFY_PORT) { $env:DASHBOARD_VERIFY_PORT } else { "3017" }
$existing = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue

if ($existing) {
  throw "Dashboard verification port $port is already in use."
}

$node = (Get-Command node).Source
$dashboardRoot = (Resolve-Path "$PSScriptRoot\..").Path
$logDirectory = Join-Path $dashboardRoot ".next"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$stdoutLog = Join-Path $logDirectory "verify-server-$port.stdout.log"
$stderrLog = Join-Path $logDirectory "verify-server-$port.stderr.log"
$arguments = @(
  "node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  $port
)
$server = $null
$launcherStartedAt = $null
$serverOwner = $null
$serverStartedAt = $null

try {
  $server = Start-Process `
    -FilePath $node `
    -ArgumentList $arguments `
    -WorkingDirectory $dashboardRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
  $launcherStartedAt = $server.StartTime

  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    $listener = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($listener) {
      $serverOwner = $listener.OwningProcess
      $serverStartedAt = (Get-Process -Id $serverOwner -ErrorAction Stop).StartTime
      break
    }

    Start-Sleep -Milliseconds 250
  }

  if (-not $serverOwner) {
    throw "Dashboard verification server did not listen on port $port."
  }

  & $node "$PSScriptRoot\verify-dashboard.mjs"

  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $stdoutLog) {
      Get-Content -LiteralPath $stdoutLog -Tail 80
    }

    if (Test-Path -LiteralPath $stderrLog) {
      Get-Content -LiteralPath $stderrLog -Tail 80
    }

    throw "Dashboard browser verification failed with exit code $LASTEXITCODE."
  }
} finally {
  $currentServer = if ($serverOwner) {
    Get-Process -Id $serverOwner -ErrorAction SilentlyContinue
  } else {
    $null
  }

  if (
    $currentServer -and
    $currentServer.ProcessName -eq "node" -and
    $currentServer.StartTime -eq $serverStartedAt
  ) {
    Stop-Process -Id $serverOwner -Force -ErrorAction SilentlyContinue
  } elseif ($server) {
    $currentLauncher = Get-Process -Id $server.Id -ErrorAction SilentlyContinue

    if (
      $currentLauncher -and
      $currentLauncher.ProcessName -eq "node" -and
      $currentLauncher.StartTime -eq $launcherStartedAt
    ) {
      Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

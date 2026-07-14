[CmdletBinding()]
param(
  [ValidateSet('naver', 'kakao')][string]$Provider,
  [ValidateRange(1, 1440)][int]$Minutes = 60,
  [ValidateRange(50, 2000)][int]$VolumeGB = 80,
  [string]$Flavor,
  [string]$BaseUrl = 'https://cloud-gpu-runner.vercel.app',
  [string]$Password
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$agentEnvs = @((Join-Path $root '.env.local'), 'C:\dev\cloud-gpu-runner\.env.local')
foreach ($agentEnv in $agentEnvs) {
  if (-not $env:CGR_PASSWORD -and (Test-Path -LiteralPath $agentEnv)) {
    Get-Content -LiteralPath $agentEnv | ForEach-Object { if ($_ -match '^CGR_PASSWORD=(.*)$') { $env:CGR_PASSWORD = $matches[1].Trim() } }
  }
}
if (-not $Password) { $Password = $env:CGR_PASSWORD }
if (-not $Password) { throw 'Set CGR_PASSWORD or pass -Password.' }
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Invoke-CclJson([string]$Uri, [string]$Method = 'GET', $Body = $null) {
  $args = @{ Uri = "$BaseUrl$Uri"; Method = $Method; WebSession = $session; UseBasicParsing = $true }
  if ($null -ne $Body) { $args.ContentType = 'application/json'; $args.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
  Invoke-RestMethod @args
}

$null = Invoke-CclJson '/api/login' 'POST' @{ password = $Password }
$usage = Invoke-CclJson '/api/usage'
$naver = Invoke-CclJson '/api/ncp-gpu'
$kakao = Invoke-CclJson '/api/cloud?action=readiness'

$rows = @(
  [pscustomobject]@{ Provider='naver'; CatalogReady=$naver.ok; Credit=[math]::Round($usage.credits.naver); Used=[math]::Round($usage.totals.naver); Remaining=[math]::Round($usage.remaining.naver); EligibleGPU=$naver.specs.Count },
  [pscustomobject]@{ Provider='kakao'; CatalogReady=$kakao.ok; Credit=[math]::Round($usage.credits.kakao); Used=[math]::Round($usage.totals.kakao); Remaining=[math]::Round($usage.remaining.kakao); EligibleGPU=$kakao.flavors.Count }
)
$rows | Format-Table -AutoSize

if ($Provider) {
  if ($Provider -eq 'naver') {
    if (-not $naver.ok) { throw "NAVER not ready: $($naver.missing -join ', ')" }
    if (-not $Flavor) { $Flavor = ($naver.specs | Sort-Object hourly_rate | Select-Object -First 1).serverSpecCode }
    $VolumeGB = 50
  } else {
    if (-not $kakao.ok) { throw 'Kakao not ready.' }
    if (-not $Flavor) { $Flavor = ($kakao.flavors | Where-Object { $_.manufacturer -eq 'nvidia' -and $_.vram_per_gpu_gb -ge 48 -and $kakao.pricing.gpu_hourly.PSObject.Properties[$_.name].Value } | Sort-Object { $kakao.pricing.gpu_hourly.PSObject.Properties[$_.name].Value } | Select-Object -First 1).name }
  }
  $estimate = Invoke-CclJson '/api/estimate?type=gpu' 'POST' @{ provider=$Provider; flavor=$Flavor; minutes=$Minutes; volume_gb=$VolumeGB }
  [pscustomobject]@{ Provider=$Provider; Flavor=$Flavor; Minutes=$Minutes; VolumeGB=$VolumeGB; GPU=[math]::Round($estimate.gpu,2); Disk=[math]::Round($estimate.disk,2); PublicIP=[math]::Round($estimate.public_ip,2); EstimatedTotal=[math]::Round($estimate.total,2); VAT='excluded' } | Format-List
}

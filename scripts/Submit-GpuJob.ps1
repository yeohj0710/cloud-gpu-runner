[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectPath,
  [string]$DataPath,
  [string]$Command = 'pip install -r requirements.txt && python train.py --data "$CCL_DATA_FILE" --output "$CCL_OUTPUT_DIR"',
  [ValidateSet('auto', 'naver', 'kakao')][string]$Provider = 'auto',
  [ValidateRange(15, 1440)][int]$Minutes = 60,
  [ValidateRange(50, 2000)][int]$VolumeGB = 80,
  [string]$OutputPath = 'outputs',
  [string]$BaseUrl = 'https://work-memory-ten.vercel.app',
  [string]$Password
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectPath).Path
if (-not (Test-Path -LiteralPath $project -PathType Container)) { throw "ProjectPath must be a folder: $project" }
if ($DataPath) { $DataPath = (Resolve-Path -LiteralPath $DataPath).Path }
if (-not $Password) {
  $secure = Read-Host 'Cloud Credit Lab password' -AsSecureString
  $Password = [System.Net.NetworkCredential]::new('', $secure).Password
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Invoke-CclJson([string]$Uri, [string]$Method = 'GET', $Body = $null) {
  $args = @{ Uri = "$BaseUrl$Uri"; Method = $Method; WebSession = $session; UseBasicParsing = $true }
  if ($null -ne $Body) { $args.ContentType = 'application/json'; $args.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
  $result = Invoke-RestMethod @args
  return $result
}

$null = Invoke-CclJson '/api/login' 'POST' @{ password = $Password }
$etc = Join-Path (Split-Path -Parent $PSScriptRoot) 'etc'
New-Item -ItemType Directory -Force -Path $etc | Out-Null
$archive = Join-Path $etc ("gpu-project-{0}.zip" -f [guid]::NewGuid().ToString('N'))

function Send-CclFile([string]$Path, [string]$Bucket) {
  $name = [IO.Path]::GetFileName($Path) -replace '[^A-Za-z0-9._-]', '-'
  $key = "gpu-workbench/{0}-{1}" -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), $name
  $signed = Invoke-CclJson '/api/ncp-storage?action=upload-url' 'POST' @{ bucket = $Bucket; key = $key }
  Invoke-WebRequest -Uri $signed.url -Method Put -InFile $Path -ContentType 'application/octet-stream' -UseBasicParsing | Out-Null
  $size = (Get-Item -LiteralPath $Path).Length
  $null = Invoke-CclJson '/api/ncp-storage?action=upload-complete' 'POST' @{ bucket = $Bucket; key = $key; size = $size }
  return $key
}

try {
  & tar.exe -a -cf $archive --exclude=.git --exclude=.venv --exclude=node_modules --exclude=__pycache__ --exclude=etc -C $project .
  if ($LASTEXITCODE -ne 0) { throw "Project archive failed: tar exit $LASTEXITCODE" }
  $buckets = Invoke-CclJson '/api/ncp-storage?action=buckets'
  $bucket = ($buckets.items | Where-Object { $_.name -match 'artifact|cloud-credit|work-memory' } | Select-Object -First 1).name
  if (-not $bucket) { $bucket = ($buckets.items | Select-Object -First 1).name }
  if (-not $bucket) { throw 'No NAVER Object Storage bucket is available.' }
  Write-Host "Uploading project: $project"
  $codeKey = Send-CclFile $archive $bucket
  $dataKey = if ($DataPath) { Write-Host "Uploading data: $DataPath"; Send-CclFile $DataPath $bucket } else { '' }
  $created = Invoke-CclJson '/api/jobs' 'POST' @{ type = 'custom-gpu'; provider = $Provider; bucket = $bucket; code_key = $codeKey; data_key = $dataKey; command = $Command; output_path = $OutputPath }

  $naver = $null
  try { $naver = Invoke-CclJson '/api/ncp-gpu' } catch { if ($Provider -eq 'naver') { throw } }
  $resolved = if ($Provider -eq 'auto') { if ($naver -and $naver.ok) { 'naver' } else { 'kakao' } } else { $Provider }
  if ($resolved -eq 'naver') {
    if (-not $naver.ok) { throw "NAVER GPU is not ready: $($naver.missing -join ', ')" }
    $spec = $naver.specs | Sort-Object hourly_rate | Select-Object -First 1
    $launch = $naver.launch_configs | Select-Object -First 1
    $null = Invoke-CclJson '/api/ncp-gpu' 'POST' @{ job_id = $created.job.id; spec_code = $spec.serverSpecCode; vpc_no = $launch.vpc_no; subnet_no = $launch.subnet_no; login_key_name = $naver.keys[0].loginKeyName; acg_no = $launch.acg_no; max_minutes = $Minutes; volume_gb = 50 }
  } else {
    $kakao = Invoke-CclJson '/api/cloud?action=readiness'
    $flavor = $kakao.flavors | Where-Object { $_.manufacturer -eq 'nvidia' -and $kakao.pricing.gpu_hourly.PSObject.Properties[$_.name].Value } | Sort-Object { $kakao.pricing.gpu_hourly.PSObject.Properties[$_.name].Value } | Select-Object -First 1
    $image = $kakao.images | Where-Object { $_.name -match 'nvidia' } | Select-Object -First 1
    $null = Invoke-CclJson '/api/cloud?action=create' 'POST' @{ job_id = $created.job.id; purpose = 'local-project'; flavor_id = $flavor.id; image_id = $image.id; subnet_id = $kakao.subnets[0].id; key_name = $kakao.keypairs[0].name; security_group = $kakao.security_groups[0].name; max_minutes = $Minutes; volume_gb = $VolumeGB }
  }
  Write-Host "Started $resolved GPU job: $($created.job.id)"
  Write-Host "$BaseUrl/jobs"
} finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
}

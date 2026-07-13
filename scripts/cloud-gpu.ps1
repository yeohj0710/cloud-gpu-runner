[CmdletBinding()]
param(
  [Parameter(Position = 0)][ValidateSet('status', 'run')][string]$Action = 'status',
  [ValidateSet('naver', 'kakao', 'auto')][string]$Provider = 'auto',
  [ValidateRange(1, 1440)][int]$Minutes = 60,
  [string]$ProjectPath,
  [string]$DataPath,
  [string]$Command = 'pip install -r requirements.txt && python train.py --data "$CGR_DATA_FILE" --output "$CGR_OUTPUT_DIR"',
  [switch]$ApproveEstimatedCost
)

$ErrorActionPreference = 'Stop'
$runner = 'C:\dev\cloud-gpu-runner-console\scripts'
if ($Action -eq 'status') {
  $statusProvider = if ($Provider -eq 'auto') { 'naver' } else { $Provider }
  & "$runner\Get-CloudCreditStatus.ps1" -Provider $statusProvider -Minutes $Minutes
  exit $LASTEXITCODE
}
if (-not $ProjectPath) { throw 'run requires -ProjectPath.' }
$args = @{
  ProjectPath = $ProjectPath
  Command = $Command
  Provider = $Provider
  Minutes = $Minutes
  ApproveEstimatedCost = $ApproveEstimatedCost
}
if ($DataPath) { $args.DataPath = $DataPath }
& "$runner\Submit-GpuJob.ps1" @args

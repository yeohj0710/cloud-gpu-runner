$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
if (-not (Test-Path "config.json")) { Copy-Item "config.example.json" "config.json" }
python -m work_memory --config "$Root\config.json" init
python -m work_memory --config "$Root\config.json" serve


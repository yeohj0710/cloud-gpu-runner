$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
python -m unittest discover -s tests -v
python -m compileall -q work_memory gpu
# Node unit tests run once via `npm run unit:test` (node --test scripts/*.test.mjs)
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'scripts\cloud-gpu.ps1'), [ref]$null, [ref]$parseErrors) | Out-Null
if ($parseErrors) { throw ($parseErrors | Out-String) }
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'scripts\Submit-GpuJob.ps1'), [ref]$null, [ref]$parseErrors) | Out-Null
if ($parseErrors) { throw ($parseErrors | Out-String) }

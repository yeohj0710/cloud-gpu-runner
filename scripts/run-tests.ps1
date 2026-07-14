$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
python -m unittest discover -s tests -v
python -m compileall -q work_memory gpu
node scripts/auth.test.mjs
node scripts/cloud-metadata.test.mjs
node scripts/gpu-workbench.test.mjs
node scripts/ncp-gpu.test.mjs
node scripts/agent-entrypoint.test.mjs
node scripts/dashboard.test.mjs
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'scripts\cloud-gpu.ps1'), [ref]$null, [ref]$parseErrors) | Out-Null
if ($parseErrors) { throw ($parseErrors | Out-String) }
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'scripts\Submit-GpuJob.ps1'), [ref]$null, [ref]$parseErrors) | Out-Null
if ($parseErrors) { throw ($parseErrors | Out-String) }

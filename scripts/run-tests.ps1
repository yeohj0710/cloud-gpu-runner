$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
python -m unittest discover -s tests -v
python -m compileall -q work_memory gpu
node scripts/auth.test.mjs
node scripts/cloud-metadata.test.mjs
node scripts/gpu-workbench.test.mjs
node scripts/ncp-gpu.test.mjs

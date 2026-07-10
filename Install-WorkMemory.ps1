$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "Work Memory.lnk"
$PowerShell = (Get-Command powershell.exe).Source
$Script = Join-Path $Root "Start-WorkMemory-Background.ps1"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $PowerShell
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = "Start Work Memory local service"
$Shortcut.Save()
Write-Output "Installed: $ShortcutPath"
Write-Output "Dashboard: http://127.0.0.1:8765"


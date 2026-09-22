$ErrorActionPreference = "Stop"

$Repo = "khs11235744-bit/-"
$Bridge = Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
$Project = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$TaskName = "KHS Phone Remote Bridge"
$LogDir = Join-Path $env:USERPROFILE "KHS_REMOTE_STATE"
$Log = Join-Path $LogDir "phone-remote-bootstrap.log"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
function Log([string]$m) {
  $line = "[" + (Get-Date).ToString("s") + "] " + $m
  Add-Content -Path $Log -Value $line -Encoding UTF8
  Write-Host $line
}

if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) { throw "gh.exe not found" }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "gh auth is not ready" }
if (-not (Test-Path $Project)) { throw "INDI+P project not found: $Project" }

if (-not (Test-Path (Join-Path $Bridge ".git"))) {
  Log "Cloning private remote-control repo..."
  gh repo clone $Repo $Bridge
  if ($LASTEXITCODE -ne 0) { throw "gh repo clone failed" }
} else {
  Log "Refreshing remote-control repo..."
  Push-Location $Bridge
  try {
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
    git reset --hard origin/main
    if ($LASTEXITCODE -ne 0) { throw "git reset failed" }
  } finally { Pop-Location }
}

$BridgeScript = Join-Path $Bridge "KHS_REMOTE\local_bridge.ps1"
if (-not (Test-Path $BridgeScript)) { throw "local_bridge.ps1 missing" }

$Launcher = Join-Path $Bridge "KHS_REMOTE\START_PHONE_REMOTE.cmd"
$launcherText = @"
@echo off
cd /d "%USERPROFILE%\KHS_REMOTE_BRIDGE"
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%USERPROFILE%\KHS_REMOTE_BRIDGE\KHS_REMOTE\local_bridge.ps1"
"@
[IO.File]::WriteAllText($Launcher,$launcherText,(New-Object Text.ASCIIEncoding))

# Use the per-user Startup folder instead of Task Scheduler.
# This needs no admin rights and does not fail when a scheduled task is absent.
$StartupDir = [Environment]::GetFolderPath("Startup")
if (-not (Test-Path $StartupDir)) {
  $StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
}
New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null

$StartupLauncher = Join-Path $StartupDir "KHS_PHONE_REMOTE.cmd"
$startupText = @"
@echo off
start "" /min "%USERPROFILE%\KHS_REMOTE_BRIDGE\KHS_REMOTE\START_PHONE_REMOTE.cmd"
"@
[IO.File]::WriteAllText($StartupLauncher,$startupText,(New-Object Text.ASCIIEncoding))
Log ("Startup launcher installed: " + $StartupLauncher)

# Prevent duplicate bridge processes before starting a fresh one.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*KHS_REMOTE*local_bridge.ps1*" } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }

Start-Process -FilePath $Launcher -WindowStyle Hidden
Start-Sleep -Seconds 3

$running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*KHS_REMOTE*local_bridge.ps1*" })

Log ("Bridge running processes: " + $running.Count)
if ($running.Count -eq 0) { throw "bridge process did not start" }

# Optional: keep Local Computer Control MCP starting on logon too, when already installed/configured.
$McpRoot = Join-Path $env:USERPROFILE "chatgpt-local-control-mcp"
$McpEnv = Join-Path $McpRoot ".env"
if ((Test-Path $McpRoot) -and (Test-Path $McpEnv)) {
  $McpTask = "KHS Local Computer Control"
  $McpLauncher = Join-Path $McpRoot "START_PHONE_MCP.cmd"
  $mcpText = @"
@echo off
cd /d "%USERPROFILE%\chatgpt-local-control-mcp"
call npm.cmd start
"@
  [IO.File]::WriteAllText($McpLauncher,$mcpText,(New-Object Text.ASCIIEncoding))
  $McpStartup = Join-Path $StartupDir "KHS_LOCAL_COMPUTER_CONTROL.cmd"
  $mcpStartupText = @"
@echo off
start "" /min "%USERPROFILE%\chatgpt-local-control-mcp\START_PHONE_MCP.cmd"
"@
  [IO.File]::WriteAllText($McpStartup,$mcpStartupText,(New-Object Text.ASCIIEncoding))
  Log ("Local Computer Control MCP startup launcher installed: " + $McpStartup)
}

Log "PHONE REMOTE READY"
Write-Host ""
Write-Host "KHS PHONE REMOTE READY" -ForegroundColor Green
Write-Host "Primary: Local Computer Control MCP"
Write-Host "Fallback: GitHub KHS_REMOTE/jobs -> local_bridge.ps1"
Write-Host "Project: $Project"
Write-Host "No ZIP packages are required for future remote tasks."

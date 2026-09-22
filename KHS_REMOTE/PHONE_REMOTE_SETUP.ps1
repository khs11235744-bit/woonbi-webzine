$ErrorActionPreference = "Stop"

$Repo = "khs11235744-bit/-"
$Bridge = Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
$Project = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$StateDir = Join-Path $env:USERPROFILE "KHS_REMOTE_STATE"
$Log = Join-Path $StateDir "phone-remote-bootstrap.log"
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

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
  Log "Cloning remote-control repo..."
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

$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($BridgeScript,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors -and $parseErrors.Count -gt 0) {
  $detail = ($parseErrors | ForEach-Object { $_.Message + " @ line " + $_.Extent.StartLineNumber }) -join " | "
  throw ("local_bridge.ps1 syntax error: " + $detail)
}
Log "Bridge syntax check: PASS"

$nl = [Environment]::NewLine
$ManualLauncher = Join-Path $Bridge "KHS_REMOTE\START_PHONE_REMOTE.cmd"
$manualText = '@echo off' + $nl + 'cd /d "%USERPROFILE%\KHS_REMOTE_BRIDGE"' + $nl + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\KHS_REMOTE_BRIDGE\KHS_REMOTE\local_bridge.ps1"' + $nl
[IO.File]::WriteAllText($ManualLauncher,$manualText,(New-Object Text.ASCIIEncoding))

$StartupDir = [Environment]::GetFolderPath("Startup")
if (-not $StartupDir) { $StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup" }
New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null
$StartupLauncher = Join-Path $StartupDir "KHS_PHONE_REMOTE.cmd"
$startupText = '@echo off' + $nl + 'start "" /min "%USERPROFILE%\KHS_REMOTE_BRIDGE\KHS_REMOTE\START_PHONE_REMOTE.cmd"' + $nl
[IO.File]::WriteAllText($StartupLauncher,$startupText,(New-Object Text.ASCIIEncoding))
Log ("Startup launcher installed: " + $StartupLauncher)

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*KHS_REMOTE*local_bridge.ps1*" } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
Start-Sleep -Milliseconds 600

$BridgeOut = Join-Path $StateDir "phone-remote-bridge.out.log"
$BridgeErr = Join-Path $StateDir "phone-remote-bridge.err.log"
Remove-Item $BridgeOut,$BridgeErr -Force -ErrorAction SilentlyContinue

$BridgeProc = Start-Process powershell.exe -PassThru -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$BridgeScript) -WorkingDirectory $Bridge -RedirectStandardOutput $BridgeOut -RedirectStandardError $BridgeErr
Start-Sleep -Seconds 5
$BridgeProc.Refresh()

if ($BridgeProc.HasExited) {
  $outText = if(Test-Path $BridgeOut){Get-Content $BridgeOut -Raw -ErrorAction SilentlyContinue}else{""}
  $errText = if(Test-Path $BridgeErr){Get-Content $BridgeErr -Raw -ErrorAction SilentlyContinue}else{""}
  Write-Host ""
  Write-Host "BRIDGE START FAILED" -ForegroundColor Red
  if($outText){ Write-Host "--- stdout ---"; Write-Host $outText }
  if($errText){ Write-Host "--- stderr ---"; Write-Host $errText }
  throw ("bridge process exited early, code=" + $BridgeProc.ExitCode)
}

$running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*KHS_REMOTE*local_bridge.ps1*" })
Log ("Bridge running processes: " + $running.Count)
Log ("Bridge PID: " + $BridgeProc.Id)

$McpRoot = Join-Path $env:USERPROFILE "chatgpt-local-control-mcp"
$McpEnv = Join-Path $McpRoot ".env"
if ((Test-Path $McpRoot) -and (Test-Path $McpEnv)) {
  $McpLauncher = Join-Path $McpRoot "START_PHONE_MCP.cmd"
  $mcpText = '@echo off' + $nl + 'cd /d "%USERPROFILE%\chatgpt-local-control-mcp"' + $nl + 'call npm.cmd start' + $nl
  [IO.File]::WriteAllText($McpLauncher,$mcpText,(New-Object Text.ASCIIEncoding))
  $McpStartup = Join-Path $StartupDir "KHS_LOCAL_COMPUTER_CONTROL.cmd"
  $mcpStartupText = '@echo off' + $nl + 'start "" /min "%USERPROFILE%\chatgpt-local-control-mcp\START_PHONE_MCP.cmd"' + $nl
  [IO.File]::WriteAllText($McpStartup,$mcpStartupText,(New-Object Text.ASCIIEncoding))
  Log "Local Computer Control startup installed."
}

Log "PHONE REMOTE READY"
Write-Host ""
Write-Host "KHS PHONE REMOTE READY" -ForegroundColor Green
Write-Host ("Bridge PID: " + $BridgeProc.Id)
Write-Host ("Bridge stdout: " + $BridgeOut)
Write-Host ("Bridge stderr: " + $BridgeErr)
Write-Host "Primary: Local Computer Control MCP"
Write-Host "Fallback: GitHub KHS_REMOTE/jobs -> local_bridge.ps1"
Write-Host "No ZIP packages are required for future remote tasks."

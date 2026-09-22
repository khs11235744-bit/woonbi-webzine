param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot 'dist')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$stage = Join-Path $OutputRoot ("khs-local-control-mcp-" + $version)
$zip = $stage + '-portable.zip'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$include = @(
  'src',
  'tests',
  'package.json',
  '.env.example',
  'README.md',
  'SECURITY.md',
  'ARCHITECTURE.md',
  'ROADMAP_100.md',
  'START_WINDOWS.cmd',
  'START_NORMAL.cmd',
  'START_ADVANCED.cmd',
  'START_RECOVERY.cmd',
  'tray.ps1',
  'bootstrap.ps1',
  'install-startup.ps1'
)

foreach ($item in $include) {
  $source = Join-Path $projectRoot $item
  if (Test-Path $source) {
    Copy-Item $source (Join-Path $stage $item) -Recurse -Force
  }
}

$firstRun = @'
@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\bootstrap.ps1"
if errorlevel 1 pause & exit /b 1
echo.
echo Bootstrap complete. Review .env, then run START_NORMAL.cmd.
pause
'@
[IO.File]::WriteAllText((Join-Path $stage 'FIRST_RUN.cmd'), $firstRun, (New-Object Text.UTF8Encoding($false)))

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($zip))" | Set-Content ($zip + '.sha256.txt')

Write-Host "Portable package: $zip"
Write-Host "SHA256: $hash"

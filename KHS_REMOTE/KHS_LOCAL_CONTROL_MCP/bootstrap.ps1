$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw 'Node.js 20+ is required.'
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 20) { throw 'Node.js 20+ is required.' }

npm.cmd install

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}

$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')

$envText = Get-Content .env -Raw
$envText = $envText -replace '(?m)^LOCAL_CONTROL_TOKEN=.*$', "LOCAL_CONTROL_TOKEN=$token"
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), $envText, (New-Object Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'KHS Local Control MCP bootstrap complete.' -ForegroundColor Green
Write-Host 'Review .env, especially WORKSPACE_ROOT and PERMISSION_PROFILE.' -ForegroundColor Yellow
Write-Host 'Start with START_WINDOWS.cmd.'

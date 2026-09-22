param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$link = Join-Path $startup 'KHS Local Control MCP.lnk'

if ($Remove) {
  Remove-Item $link -Force -ErrorAction SilentlyContinue
  Write-Host 'Windows 자동시작을 제거했습니다.'
  exit 0
}

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($link)
$s.TargetPath = 'powershell.exe'
$s.Arguments = '-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $root 'tray.ps1') + '" -Mode normal'
$s.WorkingDirectory = $root
$s.Description = 'KHS Local Control MCP'
$s.Save()
Write-Host "자동시작 등록 완료: $link"

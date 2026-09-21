param([string]$CmdPath)
$ErrorActionPreference='Stop'
$src=Join-Path $PSScriptRoot 'autodirector_dispatcher_v3.ps1'
$text=Get-Content $src -Raw -Encoding UTF8
$text=$text.Replace('function RunCapture([string]$File,[string[]]$Args) {','function RunCapture([string]$File,[string[]]$ArgList) {')
$text=$text.Replace('& $File @Args 2>&1','& $File @ArgList 2>&1')
$tmp=Join-Path $env:TEMP ('autodirector_dispatcher_fixed_'+[guid]::NewGuid().ToString('N')+'.ps1')
try {
  [IO.File]::WriteAllText($tmp,$text,(New-Object Text.UTF8Encoding($false)))
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tmp -CmdPath $CmdPath
  exit $LASTEXITCODE
} finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

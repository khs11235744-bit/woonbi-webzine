$ErrorActionPreference = "Stop"

$Bridge = Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
$RegistryPath = Join-Path $Bridge "KHS_REMOTE\project_registry.json"
$PollSeconds = 12
$Children = @{}

function Say($m){ Write-Host ("[KHS-BRIDGE SUPERVISOR v4] " + $m) }
function ReadRegistry {
  if(-not (Test-Path $RegistryPath)){ throw "project registry missing: $RegistryPath" }
  $r=Get-Content $RegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if(-not $r.projects){ throw "project registry has no projects" }
  return $r
}
function ProjectHome($entry){
  $rel=[string]$entry.home_relative
  if([string]::IsNullOrWhiteSpace($rel)){ throw "empty project home_relative" }
  if([IO.Path]::IsPathRooted($rel)){ throw "absolute project home_relative rejected" }
  return [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE $rel))
}
function WorkerPath($entry){
  $rel=[string]$entry.worker
  if([string]::IsNullOrWhiteSpace($rel)){ throw "empty worker path" }
  if([IO.Path]::IsPathRooted($rel)){ throw "absolute worker path rejected" }
  $root=[IO.Path]::GetFullPath($Bridge).TrimEnd('\')+'\'
  $full=[IO.Path]::GetFullPath((Join-Path $Bridge $rel))
  if(-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){ throw "worker escapes bridge root" }
  return $full
}
function FindPowerShellByScript([string]$needle,[int]$excludePid=0){
  try {
    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.ProcessId -ne $excludePid -and $_.Name -match '^powershell(\.exe)?$|^pwsh(\.exe)?$' -and $_.CommandLine -and $_.CommandLine.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0
    })
  } catch { return @() }
}
function StartFixedWorker([string]$id,$entry){
  $home=ProjectHome $entry
  if(-not (Test-Path $home)){ Say ("SKIP "+$id+" project missing: "+$home); return $null }
  $worker=WorkerPath $entry
  if(-not (Test-Path $worker)){ Say ("SKIP "+$id+" worker missing: "+$worker); return $null }

  if($id -eq 'INDIEPLUS'){
    $legacy=@(FindPowerShellByScript 'local_bridge_indie_legacy.ps1' $PID)
    $oldV3=@(FindPowerShellByScript 'KHS_REMOTE\local_bridge.ps1' $PID)
    if($legacy.Count -gt 0 -or $oldV3.Count -gt 0){
      Say ("INDIEPLUS already covered by existing bridge process; duplicate start suppressed")
      return $null
    }
  } elseif($id -eq 'AUTODIRECTOR'){
    $existing=@(FindPowerShellByScript 'autodirector_local_bridge.ps1' $PID)
    if($existing.Count -gt 0){
      Say ("AUTODIRECTOR worker already running; duplicate start suppressed")
      return $null
    }
  }

  $p=Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$worker) -WindowStyle Hidden -PassThru
  Say ("START "+$id+" pid="+$p.Id+" worker="+$worker)
  return $p
}
function EnsureWorkers {
  $registry=ReadRegistry
  foreach($prop in $registry.projects.PSObject.Properties){
    $id=[string]$prop.Name
    $entry=$prop.Value
    if(-not [bool]$entry.enabled){ continue }
    if($id -notin @('INDIEPLUS','AUTODIRECTOR')){ Say ("registry project not enabled by supervisor allowlist: "+$id); continue }

    $known=$null
    if($Children.ContainsKey($id)){ $known=$Children[$id] }
    if($known -and -not $known.HasExited){ continue }
    if($known -and $known.HasExited){ Say ("worker exited "+$id+" code="+$known.ExitCode); $Children.Remove($id) }

    $started=StartFixedWorker $id $entry
    if($started){ $Children[$id]=$started }
  }
}

if(-not (Get-Command gh.exe -ErrorAction SilentlyContinue)){ throw "gh.exe not found" }
gh auth status *> $null
if($LASTEXITCODE -ne 0){ throw "gh auth is not ready" }
if(-not (Test-Path (Join-Path $Bridge '.git'))){ throw "bridge clone missing: $Bridge" }

$mutex=New-Object Threading.Mutex($false,'Global\KHS_REMOTE_BRIDGE_SUPERVISOR_V4')
if(-not $mutex.WaitOne(0,$false)){ Say 'another supervisor is already running'; exit 0 }

try {
  $selfHash=(Get-FileHash $PSCommandPath -Algorithm SHA256).Hash
  Say "READY"
  Say ("registry="+$RegistryPath)
  while($true){
    try {
      EnsureWorkers
      $newHash=(Get-FileHash $PSCommandPath -Algorithm SHA256).Hash
      if($newHash -ne $selfHash){
        Say 'supervisor updated on disk; restarting'
        Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath) -WindowStyle Hidden | Out-Null
        break
      }
    } catch { Say ("ERROR: "+$_.Exception.Message) }
    Start-Sleep -Seconds $PollSeconds
  }
} finally {
  foreach($k in @($Children.Keys)){
    $p=$Children[$k]
    if($p -and -not $p.HasExited){ try{Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue}catch{} }
  }
  try{$mutex.ReleaseMutex()}catch{}
  $mutex.Dispose()
}

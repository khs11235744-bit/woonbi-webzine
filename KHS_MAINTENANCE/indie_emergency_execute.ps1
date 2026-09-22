$ErrorActionPreference="Stop"
$project=Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$state=Join-Path $env:USERPROFILE "KHS_REMOTE_STATE"
$lock=Join-Path $state "indie-emergency-bypass.lock"
New-Item -ItemType Directory -Path $state -Force | Out-Null
try {
  New-Item -ItemType Directory -Path $lock -ErrorAction Stop | Out-Null
} catch {
  Write-Host "Another emergency bypass runner already owns the lock. Exiting."
  exit 0
}

try {
  if(-not (Test-Path $project)){throw "INDIE project missing: $project"}

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ([string]$_.CommandLine -like "*KHS_REMOTE*local_bridge.ps1*") -or
      (([string]$_.CommandLine -like "*indieplus-pohang*") -and
       (([string]$_.CommandLine -like "*scripts*sync_news.py*") -or
        ([string]$_.CommandLine -like "*scripts*sync_dtryx.py*") -or
        ([string]$_.CommandLine -like "*scripts*build_news_weekly.py*")))
    } |
    ForEach-Object {
      Write-Host "Stopping stale INDIE process PID=$($_.ProcessId) $($_.Name)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

  Get-ChildItem $state -Filter "*.running" -File -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

  Push-Location $project
  try {
    $dirty=@(git status --porcelain)
    if($dirty.Count -gt 0){
      $stamp=Get-Date -Format "yyyyMMdd-HHmmss"
      git stash push -u -m "emergency-ui-preserve-$stamp"
      if($LASTEXITCODE -ne 0){throw "git stash failed"}
    }
    git pull --ff-only
    if($LASTEXITCODE -ne 0){throw "git pull --ff-only failed"}
  } finally { Pop-Location }

  $jobs=@(
    "KHS_REMOTE/jobs/20260922-1701-indie-ui-v23-patch.json",
    "KHS_REMOTE/jobs/20260922-1702-indie-ui-v23-verify.json",
    "KHS_REMOTE/jobs/20260922-1703-indie-community-mobile-v24-patch.json",
    "KHS_REMOTE/jobs/20260922-1704-indie-community-mobile-v24-verify.json",
    "KHS_REMOTE/jobs/20260922-1705-indie-community-mobile-v24-deploy.json"
  )

  foreach($job in $jobs){
    Write-Host "DIRECT RUN: $job"
    $env:KHS_JOB_PATH=$job
    & "$env:GITHUB_WORKSPACE\KHS_REMOTE\dispatcher.ps1"
    if($LASTEXITCODE -ne 0){throw "dispatcher process failed: $job"}
    $cfg=Get-Content "$env:GITHUB_WORKSPACE\$job" -Raw -Encoding UTF8 | ConvertFrom-Json
    $safe=([string]$cfg.request_id) -replace '[^A-Za-z0-9_.-]','_'
    $result="$env:GITHUB_WORKSPACE\KHS_REMOTE\results\legacy\$safe.json"
    if(-not (Test-Path $result)){throw "result missing: $result"}
    $r=Get-Content $result -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host ("RESULT "+$r.request_id+" => "+$r.status)
    if($r.status -ne "PASS"){throw ("job failed: "+$r.request_id+" :: "+$r.error)}
  }

  Write-Host "INDIE EMERGENCY UI DEPLOY PASS"
}
finally {
  Remove-Item $lock -Recurse -Force -ErrorAction SilentlyContinue
  $bridge=Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
  if(Test-Path (Join-Path $bridge ".git")){
    Push-Location $bridge
    try {
      git fetch origin main
      git reset --hard origin/main
    } catch {} finally { Pop-Location }
    $script=Join-Path $bridge "KHS_REMOTE\local_bridge.ps1"
    if(Test-Path $script){
      Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$script) -WorkingDirectory $bridge | Out-Null
    }
  }
}

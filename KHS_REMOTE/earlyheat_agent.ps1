$ErrorActionPreference = "Stop"

$Base = Join-Path $env:LOCALAPPDATA "KHS_EARLYHEAT_REMOTE"
$Control = Join-Path $Base "control"
$StatePath = Join-Path $Base "state.json"
$HeartbeatPath = Join-Path $Base "heartbeat.json"
$StopPath = Join-Path $Base "STOP"
$LogPath = Join-Path $Base "agent.log"
$Repo = "khs11235744-bit/-"

New-Item -ItemType Directory -Path $Base -Force | Out-Null

function Write-Log([string]$Message) {
  $line = "[$((Get-Date).ToString('o'))] $Message"
  Add-Content -Path $LogPath -Value $line -Encoding UTF8
  $lines = @(Get-Content $LogPath -ErrorAction SilentlyContinue)
  if ($lines.Count -gt 1000) {
    $lines | Select-Object -Last 800 | Set-Content $LogPath -Encoding UTF8
  }
}

function Write-JsonFile([string]$Path, $Object) {
  $json = $Object | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText($Path, $json, (New-Object Text.UTF8Encoding($false)))
}

function Write-Heartbeat([string]$Status,[string]$RequestId,[string]$Detail) {
  Write-JsonFile $HeartbeatPath ([ordered]@{
    timestamp = (Get-Date).ToString("o")
    status = $Status
    request_id = $RequestId
    detail = $Detail
    pid = $PID
    computer = $env:COMPUTERNAME
    paper_shadow_only = $true
  })
}

function Find-Gh {
  $g = Get-Command gh.exe -ErrorAction SilentlyContinue
  if (-not $g) { $g = Get-Command gh -ErrorAction SilentlyContinue }
  if (-not $g) { throw "gh CLI not found" }
  return $g.Source
}

function Ensure-ControlClone([string]$Gh) {
  if (-not (Test-Path (Join-Path $Control ".git"))) {
    if (Test-Path $Control) { Remove-Item $Control -Recurse -Force }
    & $Gh repo clone $Repo $Control -- --depth 30
    if ($LASTEXITCODE -ne 0) { throw "gh repo clone failed" }
  }
}

function Invoke-Git([string[]]$Args,[bool]$AllowFailure=$false) {
  $output = (& git.exe -C $Control @Args 2>&1 | Out-String).Trim()
  $code = $LASTEXITCODE
  if (-not $AllowFailure -and $code -ne 0) {
    throw ("git " + ($Args -join " ") + " failed: " + $output)
  }
  return @{ exit=$code; output=$output }
}

function Sync-Control {
  $ahead = Invoke-Git @("rev-list","--count","origin/main..HEAD") $true
  if ($ahead.exit -eq 0 -and [int]([string]$ahead.output).Trim() -gt 0) {
    $push = Invoke-Git @("push","origin","HEAD:main") $true
    if ($push.exit -ne 0) { throw "pending result push failed: $($push.output)" }
  }

  $dirty = Invoke-Git @("status","--porcelain") $true
  if ($dirty.exit -ne 0) { throw "control clone git status failed" }
  if (-not [string]::IsNullOrWhiteSpace([string]$dirty.output)) {
    throw "control clone dirty before sync; refusing destructive cleanup"
  }

  Invoke-Git @("pull","--rebase","origin","main") | Out-Null
}

function Publish-Results([string]$RequestId) {
  Invoke-Git @("add","KHS_REMOTE/results/earlyheat") | Out-Null
  $diff = Invoke-Git @("diff","--cached","--quiet") $true
  if ($diff.exit -eq 0) { return $true }
  if ($diff.exit -ne 1) { throw "git diff --cached --quiet failed" }

  Invoke-Git @("commit","-m",("KHS_EARLYHEAT_AGENT_RESULT: "+$RequestId)) | Out-Null
  for ($i=1; $i -le 5; $i++) {
    $pull = Invoke-Git @("pull","--rebase","origin","main") $true
    if ($pull.exit -eq 0) {
      $push = Invoke-Git @("push","origin","HEAD:main") $true
      if ($push.exit -eq 0) { return $true }
    } else {
      Invoke-Git @("rebase","--abort") $true | Out-Null
    }
    Start-Sleep -Seconds (2*$i)
  }
  return $false
}

function Load-Seen {
  if (-not (Test-Path $StatePath)) { return @() }
  try {
    $s = Get-Content $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    return @($s.seen)
  } catch {
    return @()
  }
}

function Save-Seen([object[]]$Seen,[string]$LastRequest,[string]$LastStatus) {
  $trimmed = @($Seen | Select-Object -Unique | Select-Object -Last 500)
  Write-JsonFile $StatePath ([ordered]@{
    updated_at = (Get-Date).ToString("o")
    seen = $trimmed
    last_request = $LastRequest
    last_status = $LastStatus
  })
}

$mutex = New-Object Threading.Mutex($false, "Local\KHS_EARLYHEAT_REMOTE_AGENT")
$hasMutex = $false

try {
  $hasMutex = $mutex.WaitOne(0, $false)
  if (-not $hasMutex) { exit 0 }

  $gh = Find-Gh
  & $gh auth status --hostname github.com 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "gh CLI is not authenticated" }
  & $gh auth setup-git 1>$null 2>$null

  Ensure-ControlClone $gh
  $seen = @(Load-Seen)
  Write-Log "EarlyHeat dedicated agent started. PID=$PID"
  Write-Heartbeat "STARTED" "" "Dedicated agent online; Paper/Shadow only."

  while ($true) {
    if (Test-Path $StopPath) {
      Write-Log "STOP file detected."
      Write-Heartbeat "STOPPED" "" "Local STOP file detected."
      break
    }

    try {
      Sync-Control

      $jobsDir = Join-Path $Control "KHS_REMOTE\earlyheat_jobs"
      $dispatcher = Join-Path $Control "KHS_REMOTE\earlyheat_dispatcher.ps1"
      if (-not (Test-Path $dispatcher)) { throw "dispatcher missing in control clone" }

      $candidate = $null
      if (Test-Path $jobsDir) {
        foreach ($job in @(Get-ChildItem $jobsDir -Filter "*.json" | Sort-Object Name)) {
          try { $cmd = Get-Content $job.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
          catch { continue }

          $id = [string]$cmd.request_id
          if ([string]::IsNullOrWhiteSpace($id)) { continue }
          if ([string]$cmd.project -ne "EARLY_HEAT_RADAR") { continue }
          if ([string]$cmd.action -ne "earlyheat_codex") { continue }
          if (-not [bool]$cmd.agent_mode) { continue }
          if ($seen -contains $id) { continue }

          $resultPath = Join-Path $Control ("KHS_REMOTE\results\earlyheat\" + (($id -replace "[^A-Za-z0-9_.-]","_")) + ".json")
          if (Test-Path $resultPath) {
            try {
              $oldResult = Get-Content $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json
              if ([string]$oldResult.status -notin @("BLOCKED_CONCURRENT_CODEX","BLOCKED_LOCK")) {
                $seen += $id
                Save-Seen $seen $id ([string]$oldResult.status)
                continue
              }
            } catch {}
          }

          $candidate = @{ file=$job; cmd=$cmd; id=$id }
          break
        }
      }

      if ($null -eq $candidate) {
        Write-Heartbeat "IDLE" "" "No pending dedicated EarlyHeat coding job."
        Start-Sleep -Seconds 20
        continue
      }

      $requestId = [string]$candidate.id
      Write-Log "Processing $requestId"
      Write-Heartbeat "RUNNING" $requestId "Executing bounded Codex task."

      $oldWorkspace = $env:GITHUB_WORKSPACE
      try {
        $env:GITHUB_WORKSPACE = $Control
        $output = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dispatcher -CmdPath $candidate.file.FullName 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
      } finally {
        $env:GITHUB_WORKSPACE = $oldWorkspace
      }

      $safeId = $requestId -replace "[^A-Za-z0-9_.-]","_"
      $resultPath = Join-Path $Control ("KHS_REMOTE\results\earlyheat\"+$safeId+".json")
      if (-not (Test-Path $resultPath)) {
        throw "dispatcher produced no result for $requestId; exit=$exitCode output=$output"
      }

      $result = Get-Content $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $published = Publish-Results $requestId
      if (-not $published) { throw "result publish failed for $requestId" }

      $status = [string]$result.status
      Write-Log "Result $requestId status=$status"
      Write-Heartbeat $status $requestId "Result published to GitHub."

      if ($status -in @("BLOCKED_CONCURRENT_CODEX","BLOCKED_LOCK")) {
        Start-Sleep -Seconds 60
        continue
      }

      $seen += $requestId
      Save-Seen $seen $requestId $status
    } catch {
      $msg = $_.Exception.Message
      Write-Log ("cycle error: " + $msg)
      Write-Heartbeat "ERROR" "" $msg
      Start-Sleep -Seconds 30
    }
  }
} catch {
  $msg = $_.Exception.Message
  Write-Log ("fatal: " + $msg)
  Write-Heartbeat "FATAL" "" $msg
} finally {
  if ($hasMutex) {
    try { $mutex.ReleaseMutex() } catch {}
  }
  $mutex.Dispose()
}

$ErrorActionPreference = "Stop"

$Base = Join-Path $env:USERPROFILE "Documents\ChatGPT"
$Mini = Join-Path $Base "KHS_MINI_JEV"
$Flow = Join-Path $Base "KHS_FLOW_OS_v0.3"
$Indie = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$DefaultCmdPath = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\command.json"
$CmdPath = $DefaultCmdPath
$JobRelPath = $null

# Unique job mailbox: determine the job file that triggered this push.
# This prevents one project's command from overwriting another project's queued job.
if ($env:GITHUB_EVENT_PATH -and (Test-Path $env:GITHUB_EVENT_PATH)) {
  try {
    $evt = Get-Content $env:GITHUB_EVENT_PATH -Raw -Encoding UTF8 | ConvertFrom-Json
    $changed = @()
    if ($evt.head_commit) {
      $changed += @($evt.head_commit.added)
      $changed += @($evt.head_commit.modified)
    }
    $JobRelPath = $changed |
      Where-Object {
        $_ -like "KHS_REMOTE/jobs/*.json" -or
        $_ -like "KHS_REMOTE/minijev_jobs/*.json" -or
        $_ -like "KHS_REMOTE/indie_jobs/*.json"
      } |
      Select-Object -First 1
    if ($JobRelPath) {
      $CmdPath = Join-Path $env:GITHUB_WORKSPACE ($JobRelPath -replace '/', '\')
    }
  } catch {}
}

$ResultRel = "KHS_REMOTE\results\legacy"
if ($JobRelPath -like "KHS_REMOTE/minijev_jobs/*.json") {
  $ResultRel = "KHS_REMOTE\results\minijev"
} elseif ($JobRelPath -like "KHS_REMOTE/indie_jobs/*.json") {
  $ResultRel = "KHS_REMOTE\results\indie"
}
$ResultDir = Join-Path $env:GITHUB_WORKSPACE $ResultRel
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null

function ReadJsonSafe([string]$p) {
  if (-not (Test-Path $p)) { return $null }
  try { return Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return @{ parse_error = $_.Exception.Message } }
}

function ReadTextBounded([string]$p, [int]$max = 200000) {
  if (-not (Test-Path $p)) { return $null }
  $f = Get-Item $p
  if ($f.Length -gt $max) { return "[OMITTED: too large]" }
  return Get-Content $p -Raw -Encoding UTF8
}

function GitInfo([string]$root) {
  if (-not (Test-Path (Join-Path $root ".git"))) { return @{ git = $false } }
  Push-Location $root
  try {
    $head = (& git rev-parse HEAD 2>$null | Out-String).Trim()
    $branch = (& git branch --show-current 2>$null | Out-String).Trim()
    $dirty = @(& git status --porcelain 2>$null)
    return @{ git=$true; head=$head; branch=$branch; dirty=($dirty.Count -gt 0); dirty_count=$dirty.Count; dirty_files=@($dirty) }
  } finally { Pop-Location }
}

function SystemSnapshot {
  $os = Get-CimInstance Win32_OperatingSystem
  $disk = Get-PSDrive C
  $gpu = $null
  if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    try {
      $line = (& nvidia-smi --query-gpu=name,utilization.gpu,memory.total,memory.used,memory.free,temperature.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
      if ($line) {
        $p = $line -split ',\s*'
        $gpu = @{name=$p[0]; utilization_pct=[int]$p[1]; memory_total_mb=[int]$p[2]; memory_used_mb=[int]$p[3]; memory_free_mb=[int]$p[4]; temperature_c=[int]$p[5]}
      }
    } catch {}
  }
  return @{
    computer=$env:COMPUTERNAME
    timestamp=(Get-Date).ToString("o")
    ram_total_gb=[math]::Round($os.TotalVisibleMemorySize/1MB,2)
    ram_free_gb=[math]::Round($os.FreePhysicalMemory/1MB,2)
    disk_c_free_gb=[math]::Round($disk.Free/1GB,2)
    gpu=$gpu
  }
}

function HarnessSnapshot {
  $hbPath = Join-Path $Mini ".harness\heartbeat.json"
  $hbAge = $null
  if (Test-Path $hbPath) {
    $hbAge = [math]::Round(((Get-Date) - (Get-Item $hbPath).LastWriteTime).TotalSeconds,1)
  }
  return @{
    latest_status = ReadJsonSafe (Join-Path $Mini "reports\latest-status.json")
    heartbeat = ReadJsonSafe $hbPath
    heartbeat_file_age_sec = $hbAge
    state = ReadJsonSafe (Join-Path $Mini ".harness\state.json")
    webchat_todo = ReadTextBounded (Join-Path $Mini "WEBCHAT_TODO.md")
    research_router_user_patterns = ReadTextBounded (Join-Path $Mini "research\ROUTER_USER_PATTERNS_20260921.md")
    stop_present = Test-Path (Join-Path $Mini ".harness\STOP")
    git = GitInfo $Mini
  }
}

$cmd = Get-Content $CmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
$result = [ordered]@{
  request_id = $cmd.request_id
  action = $cmd.action
  project = $cmd.project
  queue_job = $JobRelPath
  started_at = (Get-Date).ToString("o")
  status = "FAIL"
  retryable = $true
}

try {
  switch ([string]$cmd.action) {
    "indieplus_status" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      $result.project = $Indie
      $result.lock_present = Test-Path $lockPath
      $result.lock_content = if (Test-Path $lockPath) { ReadTextBounded $lockPath 50000 } else { $null }
      $result.git = GitInfo $Indie
      $result.required_docs = @(
        "HARNESS.md","ROADMAP_100.md","COMMUNITY_ROADMAP_100.md",
        "MAGAZINE_EDITOR_WORKSHOP_100.md","DESIGN_PANEL_100_V18.md"
      ) | ForEach-Object {
        @{ name=$_; exists=(Test-Path (Join-Path $Indie $_)) }
      }
      $result.status = "PASS"
      $result.retryable = $false
    }
    "indieplus_codex" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      if (Test-Path $lockPath) {
        $result.blocked = "HARNESS_LOCK"
        $result.lock_content = ReadTextBounded $lockPath 50000
        $result.git = GitInfo $Indie
        $result.status = "BLOCKED"
        $result.retryable = $false
        break
      }

      $beforeGit = GitInfo $Indie
      $result.before_git = $beforeGit
      if ($beforeGit.dirty) {
        $result.blocked = "DIRTY_WORKTREE"
        $result.status = "BLOCKED"
        $result.retryable = $false
        break
      }

      $prompt = [string]$cmd.prompt
      if ([string]::IsNullOrWhiteSpace($prompt)) { throw "prompt is empty" }
      if ($prompt.Length -gt 60000) { throw "prompt too long" }

      Push-Location $Indie
      try {
        $pullOutput = (& git pull --ff-only 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw "git pull --ff-only failed: $pullOutput" }

        $codexCmd = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
        if (-not $codexCmd) {
          $candidate = Join-Path $env:APPDATA "npm\codex.cmd"
          if (Test-Path $candidate) { $codexCmd = $candidate }
        }
        if (-not $codexCmd) { throw "codex.cmd not found" }

        $result.pull_output = $pullOutput
        $result.codex_cmd = $codexCmd
        $codexOutput = ($prompt | & $codexCmd exec --sandbox workspace-write - 2>&1 | Out-String).Trim()
        $codexExit = $LASTEXITCODE
        if ($codexOutput.Length -gt 120000) { $codexOutput = $codexOutput.Substring($codexOutput.Length-120000) }
        $result.codex_exit = $codexExit
        $result.codex_output = $codexOutput
      } finally { Pop-Location }

      $afterGit = GitInfo $Indie
      $result.after_git = $afterGit

      if ($result.codex_exit -ne 0) {
        $result.status = "FAIL"
        $result.retryable = $true
        break
      }

      if ([bool]$cmd.push_after -and -not $afterGit.dirty -and $afterGit.head -ne $beforeGit.head) {
        Push-Location $Indie
        try {
          $pushOutput = (& git push origin HEAD:main 2>&1 | Out-String).Trim()
          $pushExit = $LASTEXITCODE
          $result.push_output = $pushOutput
          $result.push_exit = $pushExit
          if ($pushExit -ne 0) { throw "git push failed: $pushOutput" }
        } finally { Pop-Location }
      }

      $result.final_git = GitInfo $Indie
      $result.status = "PASS"
      $result.retryable = $false
    }
    "snapshot_guard" {
      $before = HarnessSnapshot
      $restarted = $false
      $watchdogOutput = $null
      if (-not $before.stop_present -and ($null -eq $before.heartbeat_file_age_sec -or $before.heartbeat_file_age_sec -gt 300)) {
        $watchdog = Join-Path $Mini "scripts\watchdog.ps1"
        if (-not (Test-Path $watchdog)) { throw "watchdog.ps1 missing" }
        $stdoutFile = Join-Path $env:TEMP ("khs-watchdog-out-" + [guid]::NewGuid().ToString("N") + ".txt")
        $stderrFile = Join-Path $env:TEMP ("khs-watchdog-err-" + [guid]::NewGuid().ToString("N") + ".txt")
        try {
          $p = Start-Process powershell.exe -PassThru -WindowStyle Hidden `
            -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$watchdog) `
            -WorkingDirectory $Mini `
            -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
          if (-not $p.WaitForExit(30000)) {
            try { $p.Kill($true) } catch {}
            $watchdogOutput = "TIMEOUT after 30s; watchdog was terminated"
            throw $watchdogOutput
          }
          $watchdogExit = $p.ExitCode
          $outText = if (Test-Path $stdoutFile) { Get-Content $stdoutFile -Raw -ErrorAction SilentlyContinue } else { "" }
          $errText = if (Test-Path $stderrFile) { Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue } else { "" }
          $watchdogOutput = (($outText + "`n" + $errText).Trim())
          if ($watchdogExit -ne 0) { throw "watchdog failed exit=$watchdogExit" }
          Start-Sleep -Seconds 3
          $restarted = $true
        } finally {
          Remove-Item $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
        }
      }
      $result.before = $before
      $result.after = HarnessSnapshot
      $result.system = SystemSnapshot
      $result.flow_git = GitInfo $Flow
      $result.restart_occurred = $restarted
      $result.watchdog_output = $watchdogOutput
      $result.status = "PASS"
      $result.retryable = $false
    }
    default {
      throw "Unsupported bounded action: $($cmd.action)"
    }
  }
} catch {
  $result.error = $_.Exception.Message
  $result.status = "FAIL"
  $result.retryable = $true
}

$result.finished_at = (Get-Date).ToString("o")
$jsonOut = ($result | ConvertTo-Json -Depth 30)
$out = Join-Path $ResultDir ("latest.json")
[IO.File]::WriteAllText($out, $jsonOut, (New-Object Text.UTF8Encoding($false)))

$safeRequest = ([string]$cmd.request_id) -replace '[^A-Za-z0-9_.-]','_'
if ($safeRequest) {
  $perTask = Join-Path $ResultDir ($safeRequest + ".json")
  [IO.File]::WriteAllText($perTask, $jsonOut, (New-Object Text.UTF8Encoding($false)))
}
Write-Host ($result | ConvertTo-Json -Depth 8)

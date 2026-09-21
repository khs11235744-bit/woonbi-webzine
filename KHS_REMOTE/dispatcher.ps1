$ErrorActionPreference = "Stop"

$Base = Join-Path $env:USERPROFILE "Documents\ChatGPT"
$Mini = Join-Path $Base "KHS_MINI_JEV"
$Flow = Join-Path $Base "KHS_FLOW_OS_v0.3"
$CmdPath = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\command.json"
$ResultDir = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\results"
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
    return @{ git=$true; head=$head; branch=$branch; dirty=($dirty.Count -gt 0); dirty_count=$dirty.Count }
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
  started_at = (Get-Date).ToString("o")
  status = "FAIL"
  retryable = $true
}

try {
  switch ([string]$cmd.action) {
    "snapshot_guard" {
      $before = HarnessSnapshot
      $restarted = $false
      $watchdogOutput = $null
      if (-not $before.stop_present -and ($null -eq $before.heartbeat_file_age_sec -or $before.heartbeat_file_age_sec -gt 300)) {
        $watchdog = Join-Path $Mini "scripts\watchdog.ps1"
        if (-not (Test-Path $watchdog)) { throw "watchdog.ps1 missing" }
        Push-Location $Mini
        try {
          $watchdogOutput = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $watchdog 2>&1 | Out-String).Trim()
          $watchdogExit = $LASTEXITCODE
        } finally { Pop-Location }
        if ($watchdogExit -ne 0) { throw "watchdog failed exit=$watchdogExit" }
        Start-Sleep -Seconds 3
        $restarted = $true
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
$out = Join-Path $ResultDir ("latest.json")
[IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
Write-Host ($result | ConvertTo-Json -Depth 8)

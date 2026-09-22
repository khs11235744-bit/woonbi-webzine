$ErrorActionPreference = "Stop"

$Base = Join-Path $env:USERPROFILE "Documents\ChatGPT"
$Mini = Join-Path $Base "KHS_MINI_JEV"
$Flow = Join-Path $Base "KHS_FLOW_OS_v0.3"
$Indie = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$DefaultCmdPath = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\command.json"
$CmdPath = $DefaultCmdPath
$JobRelPath = $null

# workflow_dispatch may provide an explicit job path.
if (-not [string]::IsNullOrWhiteSpace($env:KHS_JOB_PATH)) {
  $candidate = [string]$env:KHS_JOB_PATH
  if ($candidate -notlike "KHS_REMOTE/minijev_jobs/*.json" -and
      $candidate -notlike "KHS_REMOTE/indie_jobs/*.json" -and
      $candidate -notlike "KHS_REMOTE/jobs/*.json") {
    throw "KHS_JOB_PATH outside allowed mailboxes: $candidate"
  }
  $JobRelPath = $candidate
  $CmdPath = Join-Path $env:GITHUB_WORKSPACE ($JobRelPath -replace '/', '\')
}
elseif ($env:GITHUB_EVENT_PATH -and (Test-Path $env:GITHUB_EVENT_PATH)) {
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

function RunNativeBounded([string]$exe,[string[]]$nativeArgs,[string]$workingDir,[int]$timeoutMs=10000) {
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $quotedArgs = @()
  foreach($a in $nativeArgs) {
    if($null -ne $a) {
      $s = [string]$a
      $quotedArgs += ('"' + ($s -replace '"', '\\"') + '"')
    }
  }
  $psi.Arguments = ($quotedArgs -join " ")
  $psi.WorkingDirectory = $workingDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdoutTask = $p.StandardOutput.ReadToEndAsync()
  $stderrTask = $p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit($timeoutMs)) {
    try { $p.Kill($true) } catch {}
    return @{exit=124;timed_out=$true;output=("timeout after "+$timeoutMs+"ms")}
  }
  $stdout = [string]$stdoutTask.Result
  $stderr = [string]$stderrTask.Result
  $combined = ([string]$stdout + [Environment]::NewLine + [string]$stderr)
  return @{exit=$p.ExitCode;timed_out=$false;output=$combined.Trim()}
}
function GitInfo([string]$root) {
  if (-not (Test-Path (Join-Path $root ".git"))) { return @{ git = $false } }
  $headR=RunNativeBounded "git.exe" @("rev-parse","HEAD") $root 8000
  $branchR=RunNativeBounded "git.exe" @("branch","--show-current") $root 8000
  $statusR=RunNativeBounded "git.exe" @("status","--porcelain") $root 12000
  $dirtyLines=@()
  if(-not $statusR.timed_out -and $statusR.output){$dirtyLines=@($statusR.output -split "`r?`n")}
  $headText = if($null -eq $headR.output){""}else{[string]$headR.output}
  $branchText = if($null -eq $branchR.output){""}else{[string]$branchR.output}
  return @{
    git=$true
    head=if($headR.exit -eq 0){$headText.Trim()}else{$null}
    branch=if($branchR.exit -eq 0){$branchText.Trim()}else{$null}
    dirty=if($statusR.timed_out){$null}else{($dirtyLines.Count -gt 0)}
    dirty_count=if($statusR.timed_out){$null}else{$dirtyLines.Count}
    dirty_files=$dirtyLines
    git_status_timeout=$statusR.timed_out
  }
}

function SystemSnapshot {
  try { Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue } catch {}
  $ci = New-Object Microsoft.VisualBasic.Devices.ComputerInfo
  $disk = Get-PSDrive C
  $gpu = $null
  if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    try {
      $nr=RunNativeBounded "nvidia-smi.exe" @("--query-gpu=name,utilization.gpu,memory.total,memory.used,memory.free,temperature.gpu","--format=csv,noheader,nounits") $env:TEMP 5000
      if ($nr.exit -eq 0 -and -not $nr.timed_out -and $nr.output) {
        $line=($nr.output -split "`r?`n")[0]
        $p = $line -split ',\s*'
        $gpu = @{name=$p[0]; utilization_pct=[int]$p[1]; memory_total_mb=[int]$p[2]; memory_used_mb=[int]$p[3]; memory_free_mb=[int]$p[4]; temperature_c=[int]$p[5]; timed_out=$false}
      } elseif ($nr.timed_out) {
        $gpu=@{timed_out=$true}
      }
    } catch {}
  }
  return @{
    computer=$env:COMPUTERNAME
    timestamp=(Get-Date).ToString("o")
    ram_total_gb=[math]::Round($ci.TotalPhysicalMemory/1GB,2)
    ram_free_gb=[math]::Round($ci.AvailablePhysicalMemory/1GB,2)
    disk_c_free_gb=[math]::Round($disk.Free/1GB,2)
    gpu=$gpu
  }
}


function InvokeIndiePython([string]$script) {
  Push-Location $Indie
  try {
    $out = (& python $script 2>&1 | Out-String).Trim()
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw ("python failed " + $script + " :: " + $out) }
    return $out
  } finally { Pop-Location }
}

function InvokeIndieSync {
  return @{
    dtryx = InvokeIndiePython "scripts/sync_dtryx.py"
    news = InvokeIndiePython "scripts/sync_news.py"
    news_weekly = InvokeIndiePython "scripts/build_news_weekly.py"
  }
}

function InvokeIndieTest {
  Push-Location $Indie
  try {
    foreach($j in Get-ChildItem (Join-Path $Indie "data") -Filter "*.json" -File){
      Get-Content $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
    }
    $js=@("app.js","features-v04.js","features-v05.js","features-v06.js","features-v07.js","features-v08.js","features-v17.js","features-v19.js","features-v20.js","features-v21.js","features-v22.js","sw.js","functions/index.js")
    foreach($x in $js){
      if(Test-Path (Join-Path $Indie $x)){ 
        & node --check $x
        if($LASTEXITCODE -ne 0){throw "node --check failed: $x"}
      }
    }
    git diff --check
    if($LASTEXITCODE -ne 0){throw "git diff --check failed"}
    return @{ok=$true;git=(GitInfo $Indie)}
  } finally { Pop-Location }
}

function InvokeIndieDeploy([bool]$includeFunctions=$true) {
  Push-Location $Indie
  try {
    $firebase=(Get-Command firebase.cmd -ErrorAction SilentlyContinue).Source
    if(-not $firebase){$firebase=Join-Path $env:APPDATA "npm\firebase.cmd"}
    if(-not (Test-Path $firebase)){throw "firebase.cmd not found"}
    $only=if($includeFunctions){"firestore:rules,functions,hosting"}else{"firestore:rules,hosting"}
    $out=(& $firebase deploy --project indieplus-pohang-khs --only $only 2>&1 | Out-String).Trim()
    if($LASTEXITCODE -ne 0){throw ("firebase deploy failed :: " + $out)}
    return $out
  } finally { Pop-Location }
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

function RunCodexBounded([string]$root,[string]$prompt,[int]$timeoutSec=1800) {
  if ([string]::IsNullOrWhiteSpace($prompt)) { throw "prompt is empty" }
  if ($prompt.Length -gt 60000) { throw "prompt too long" }
  $codexCmd = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
  if (-not $codexCmd) {
    $candidate = Join-Path $env:APPDATA "npm\codex.cmd"
    if (Test-Path $candidate) { $codexCmd = $candidate }
  }
  if (-not $codexCmd) { throw "codex.cmd not found" }
  $id = [guid]::NewGuid().ToString("N")
  $promptFile = Join-Path $env:TEMP ("khs-codex-prompt-" + $id + ".txt")
  $stdoutFile = Join-Path $env:TEMP ("khs-codex-out-" + $id + ".txt")
  $stderrFile = Join-Path $env:TEMP ("khs-codex-err-" + $id + ".txt")
  [IO.File]::WriteAllText($promptFile,$prompt,(New-Object Text.UTF8Encoding($false)))
  try {
    $cmdLine = 'type "' + $promptFile + '" | "' + $codexCmd + '" exec --sandbox workspace-write -'
    $p = Start-Process "cmd.exe" -PassThru -WindowStyle Hidden -ArgumentList @("/d","/s","/c",$cmdLine) -WorkingDirectory $root -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    if (-not $p.WaitForExit($timeoutSec*1000)) {
      try { $p.Kill($true) } catch {}
      return @{ exit=124; timed_out=$true; output=("Codex timeout after " + $timeoutSec + "s"); codex_cmd=$codexCmd }
    }
    $outText = if(Test-Path $stdoutFile){Get-Content $stdoutFile -Raw -ErrorAction SilentlyContinue}else{""}
    $errText = if(Test-Path $stderrFile){Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue}else{""}
    $combined = (($outText + "`n" + $errText).Trim())
    if($combined.Length -gt 120000){$combined=$combined.Substring($combined.Length-120000)}
    return @{ exit=$p.ExitCode; timed_out=$false; output=$combined; codex_cmd=$codexCmd }
  } finally {
    Remove-Item $promptFile,$stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
  }
}

function QueueSidecar([string]$root,[string]$worker,[string]$prompt,[string]$requestId) {
  if ($worker -notin @("antigravity","webchat")) { throw "unsupported sidecar worker: $worker" }
  if ([string]::IsNullOrWhiteSpace($prompt)) { $prompt = "Inspect current project state and assist with one bounded task. Do not claim completion without verification." }
  if ($prompt.Length -gt 30000) { throw "sidecar prompt too long" }
  $dir = Join-Path $root ".harness"
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $path = Join-Path $dir "SIDECAR_TODO.json"
  $payload = [ordered]@{ request_id=$requestId; worker=$worker; status="READY"; prompt=$prompt; created_at=(Get-Date).ToString("o"); note="Sidecar request only. READY does not mean the worker completed the task." }
  [IO.File]::WriteAllText($path,($payload|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  $verify = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($verify.request_id -ne $requestId -or $verify.status -ne "READY") { throw "sidecar queue verification failed" }
  return @{path=$path; worker=$worker; status="READY"}
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
    "indieplus_read" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      if (Test-Path $lockPath) { throw "HARNESS_LOCK" }
      $rootFull = [IO.Path]::GetFullPath($Indie).TrimEnd("\") + "\"
      $items = @()
      foreach ($req in @($cmd.files)) {
        $rel = [string]$req.path
        if ([string]::IsNullOrWhiteSpace($rel) -or [IO.Path]::IsPathRooted($rel)) { throw "invalid relative path: $rel" }
        $full = [IO.Path]::GetFullPath((Join-Path $Indie $rel))
        if (-not $full.StartsWith($rootFull,[StringComparison]::OrdinalIgnoreCase)) { throw "path escapes project: $rel" }
        if (-not (Test-Path $full)) { $items += @{path=$rel;missing=$true}; continue }
        $lines = @(Get-Content $full -Encoding UTF8)
        $start = if ($null -ne $req.start_line) { [Math]::Max(1,[int]$req.start_line) } else { 1 }
        $end = if ($null -ne $req.end_line) { [Math]::Min($lines.Count,[int]$req.end_line) } else { [Math]::Min($lines.Count,$start+399) }
        $body = if ($lines.Count -gt 0 -and $start -le $end) { $lines[($start-1)..($end-1)] -join [Environment]::NewLine } else { "" }
        if ($body.Length -gt 120000) { $body = $body.Substring(0,120000) }
        $items += @{path=$rel;start_line=$start;end_line=$end;content=$body}
      }
      $result.items = $items
      $result.git = GitInfo $Indie
      $result.status = "PASS"
      $result.retryable = $false
    }
    "indieplus_patch" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      if (Test-Path $lockPath) { throw "HARNESS_LOCK" }
      $beforeGit = GitInfo $Indie
      $result.before_git = $beforeGit
      $rootFull = [IO.Path]::GetFullPath($Indie).TrimEnd("\") + "\"
      $changes = @()
      foreach ($p in @($cmd.patches)) {
        $rel = [string]$p.path
        if ([string]::IsNullOrWhiteSpace($rel) -or [IO.Path]::IsPathRooted($rel)) { throw "invalid relative path: $rel" }
        $full = [IO.Path]::GetFullPath((Join-Path $Indie $rel))
        if (-not $full.StartsWith($rootFull,[StringComparison]::OrdinalIgnoreCase)) { throw "path escapes project: $rel" }
        $mode = [string]$p.mode
        if ([string]::IsNullOrWhiteSpace($mode)) { $mode = "replace" }
        $text = if (Test-Path $full) { [IO.File]::ReadAllText($full) } else { "" }
        if ($mode -eq "replace") {
          if (-not (Test-Path $full)) { throw "replace target missing: $rel" }
          $search = [string]$p.search
          $replacement = [string]$p.replace
          if ([string]::IsNullOrEmpty($search)) { throw "empty search: $rel" }
          $count = ([regex]::Matches($text,[regex]::Escape($search))).Count
          $expected = if ($null -ne $p.expected_count) { [int]$p.expected_count } else { 1 }
          if ($count -ne $expected) { throw "replace count mismatch $rel expected=$expected actual=$count" }
          $newText = $text.Replace($search,$replacement)
          [IO.File]::WriteAllText($full,$newText,(New-Object Text.UTF8Encoding($false)))
          $changes += @{path=$rel;mode=$mode;count=$count}
        } elseif ($mode -eq "append") {
          $marker = [string]$p.marker
          if ($marker -and $text.Contains($marker)) {
            $changes += @{path=$rel;mode=$mode;status="already-present"}
          } else {
            [IO.File]::WriteAllText($full,($text + [string]$p.content),(New-Object Text.UTF8Encoding($false)))
            $changes += @{path=$rel;mode=$mode;status="appended"}
          }
        } elseif ($mode -eq "write") {
          [IO.File]::WriteAllText($full,[string]$p.content,(New-Object Text.UTF8Encoding($false)))
          $changes += @{path=$rel;mode=$mode;status="written"}
        } else {
          throw "unsupported patch mode: $mode"
        }
      }
      $result.changes = $changes
      $result.after_git = GitInfo $Indie
      $result.status = "PASS"
      $result.retryable = $false
    }
    "indieplus_verify_commit" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      if (Test-Path $lockPath) { throw "HARNESS_LOCK" }
      $beforeGit = GitInfo $Indie
      $result.before_git = $beforeGit

      if ($cmd.expected_dirty_files) {
        $actual = @()
        foreach ($line in @($beforeGit.dirty_files)) {
          $t = [string]$line
          $clean = ($t -replace '^[ MARCUD?!]{1,2}\s+','').Trim()
          if (-not [string]::IsNullOrWhiteSpace($clean)) { $actual += $clean }
        }
        $actual = @($actual | Sort-Object -Unique)
        $expected = @($cmd.expected_dirty_files | ForEach-Object { [string]$_ } | Sort-Object -Unique)
        $delta = @(Compare-Object $expected $actual)
        if ($delta.Count -ne 0) {
          $result.blocked = "DIRTY_WORKTREE_MISMATCH"
          $result.expected_dirty = $expected
          $result.actual_dirty = $actual
          $result.status = "BLOCKED"
          $result.retryable = $false
          break
        }
      }

      $checks = @()
      foreach ($j in Get-ChildItem (Join-Path $Indie "data") -Filter "*.json" -File) {
        try { Get-Content $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
        catch { throw "JSON parse failed: $($j.Name): $($_.Exception.Message)" }
      }
      $checks += @{name="data-json";exit=0}

      $js = @("app.js","features-v04.js","features-v05.js","features-v06.js","features-v07.js","features-v08.js","features-v17.js","sw.js")
      if ($cmd.extra_js) { $js += @($cmd.extra_js) }
      foreach ($rel in ($js | Select-Object -Unique)) {
        $full = Join-Path $Indie ([string]$rel)
        if (-not (Test-Path $full)) { throw "missing JS: $rel" }
        $nr = RunNativeBounded "node.exe" @("--check",[string]$rel) $Indie 15000
        $checks += @{name=("node --check " + $rel);exit=$nr.exit;output=$nr.output}
        if ($nr.exit -ne 0 -or $nr.timed_out) { throw "node --check failed: $rel $($nr.output)" }
      }

      $dr = RunNativeBounded "git.exe" @("diff","--check") $Indie 15000
      $checks += @{name="git diff --check";exit=$dr.exit;output=$dr.output}
      if ($dr.exit -ne 0 -or $dr.timed_out) { throw "git diff --check failed: $($dr.output)" }
      $result.checks = $checks

      Push-Location $Indie
      try {
        if (-not $cmd.files) { throw "files list required for bounded commit" }
        foreach ($rel in @($cmd.files)) { git add -- ([string]$rel) }
        if ($LASTEXITCODE -ne 0) { throw "git add failed" }
        git diff --cached --quiet
        if ($LASTEXITCODE -eq 0) { throw "no staged changes" }
        if ($LASTEXITCODE -ne 1) { throw "git diff --cached --quiet failed" }
        git commit -m ([string]$cmd.commit_message)
        if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
        $result.commit_sha = ((git rev-parse HEAD | Out-String).Trim())
        if ([bool]$cmd.push) {
          git push origin HEAD:main
          if ($LASTEXITCODE -ne 0) { throw "git push failed" }
          $result.pushed = $true
        }
      } finally { Pop-Location }

      $result.after_git = GitInfo $Indie
      $result.status = "PASS"
      $result.retryable = $false
    }
    "indieplus_harness_run" {
      if (-not (Test-Path $Indie)) { throw "indieplus-pohang project missing: $Indie" }
      $lockPath = Join-Path $Indie ".harness.lock"
      if (Test-Path $lockPath) { throw "HARNESS_LOCK" }
      $mode = [string]$cmd.mode
      if ([string]::IsNullOrWhiteSpace($mode)) { $mode = "validate-only" }
      $allowed = @("validate-only","data-only","news-only","full","full-skip-images")
      if ($mode -notin $allowed) { throw "unsupported harness mode: $mode" }
      $python = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
      if (-not $python) { $python = (Get-Command python -ErrorAction SilentlyContinue).Source }
      if (-not $python) { throw "python not found" }
      $pyFiles = @("scripts/harness_common.py","scripts/run_harness.py")
      foreach ($py in $pyFiles) {
        if (-not (Test-Path (Join-Path $Indie $py))) { throw "missing harness file: $py" }
        $pc = RunNativeBounded $python @("-m","py_compile",$py) $Indie 20000
        if ($pc.exit -ne 0 -or $pc.timed_out) { throw "py_compile failed: $py $($pc.output)" }
      }
      $args = @("scripts/run_harness.py")
      switch ($mode) {
        "validate-only" { $args += "--validate-only" }
        "data-only" { $args += "--data-only" }
        "news-only" { $args += "--news-only" }
        "full-skip-images" { $args += "--skip-images" }
      }
      $timeoutMs = if ($mode -eq "validate-only") { 180000 } else { 1200000 }
      $hr = RunNativeBounded $python $args $Indie $timeoutMs
      $result.harness_mode = $mode
      $result.harness_exit = $hr.exit
      $result.harness_timeout = $hr.timed_out
      $out = [string]$hr.output
      if ($out.Length -gt 120000) { $out = $out.Substring($out.Length-120000) }
      $result.harness_output = $out
      $result.git_after = GitInfo $Indie
      if ($hr.exit -ne 0 -or $hr.timed_out) {
        $result.status = "FAIL"
        $result.retryable = $true
      } else {
        $result.status = "PASS"
        $result.retryable = $false
      }
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
        $result.pull_output = $pullOutput
      } finally { Pop-Location }

      $codexRun = RunCodexBounded $Indie $prompt 1800
      $result.codex_cmd = $codexRun.codex_cmd
      $result.codex_exit = $codexRun.exit
      $result.codex_timeout = $codexRun.timed_out
      $result.codex_output = $codexRun.output

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
      Push-Location $Indie
      try {
        $verifyText = (& git diff --check 2>&1 | Out-String).Trim()
        $verifyExit = $LASTEXITCODE
      } finally { Pop-Location }
      $result.verifier = @{ name="git diff --check"; exit=$verifyExit; output=$verifyText }
      if ($verifyExit -ne 0) {
        $result.status = "FAIL"
        $result.retryable = $true
      } else {
        $result.status = "NEEDS_VERIFICATION"
        $result.retryable = $true
      }
    }
    "indieplus_codex_continue" {
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
      $prompt = [string]$cmd.prompt
      if ([string]::IsNullOrWhiteSpace($prompt)) { throw "prompt is empty" }
      if ($prompt.Length -gt 60000) { throw "prompt too long" }

      # CONTINUE mode deliberately preserves an existing dirty overlay.
      # Do not pull/reset/clean/checkout here.
      $codexRun = RunCodexBounded $Indie $prompt 1800
      $result.codex_cmd = $codexRun.codex_cmd
      $result.codex_exit = $codexRun.exit
      $result.codex_timeout = $codexRun.timed_out
      $result.codex_output = $codexRun.output
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
      Push-Location $Indie
      try {
        $verifyText = (& git diff --check 2>&1 | Out-String).Trim()
        $verifyExit = $LASTEXITCODE
      } finally { Pop-Location }
      $result.verifier = @{ name="git diff --check"; exit=$verifyExit; output=$verifyText }
      if ($verifyExit -ne 0) {
        $result.status = "FAIL"
        $result.retryable = $true
      } else {
        $result.status = "NEEDS_VERIFICATION"
        $result.retryable = $true
      }
    }
    "minijev_codex" {
      if (-not (Test-Path $Mini)) { throw "KHS_MINI_JEV project missing: $Mini" }
      if (Test-Path (Join-Path $Mini ".harness\STOP")) { $result.status="STOPPED"; $result.retryable=$false; break }
      $beforeGit = GitInfo $Mini
      $result.before_git = $beforeGit
      $prompt = [string]$cmd.prompt
      if ([string]::IsNullOrWhiteSpace($prompt)) {
        $prompt = "Work inside current KHS_MINI_JEV local HEAD and dirty overlay. Do not reset, clean, checkout, or assume origin/main. Read reports/latest-status.json, .harness/heartbeat.json, .harness/state.json, WEBCHAT_TODO.md, and research/ROUTER_USER_PATTERNS_20260921.md if present. Preserve deterministic guard before learned routing; local model only for small bounded routing/classification/review; frontier/WebChat authority for complex implementation; worker output untrusted until actual files/tests are checked; log routing and verifier PASS/FAIL. Perform exactly one bounded task. If MJ-001..MJ-007 are DONE, follow P2-1 then P2-2 then P2-3 order. Leave failures retryable. Do not touch projects outside KHS_MINI_JEV or KHS_FLOW_OS_v0.3."
      }
      $r = RunCodexBounded $Mini $prompt 1800
      $result.worker="codex"
      $result.codex_exit=$r.exit
      $result.codex_timeout=$r.timed_out
      $result.codex_output=$r.output
      $result.after_git=GitInfo $Mini
      Push-Location $Mini
      try { $diffCheck = (& git diff --check 2>&1 | Out-String).Trim(); $diffExit = $LASTEXITCODE } finally { Pop-Location }
      $result.verifier = @{ name="git diff --check"; exit=$diffExit; output=$diffCheck }
      if ($r.exit -ne 0 -or $diffExit -ne 0) { $result.status="FAIL"; $result.retryable=$true }
      else { $result.status="NEEDS_VERIFICATION"; $result.retryable=$true }
    }
    "sidecar_request" {
      $target = switch ([string]$cmd.project) {
        "KHS_MINI_JEV" { $Mini }
        "INDIE" { $Indie }
        default { throw "sidecar project not allowed: $($cmd.project)" }
      }
      $worker = ([string]$cmd.worker).ToLowerInvariant()
      $queued = QueueSidecar $target $worker ([string]$cmd.prompt) ([string]$cmd.request_id)
      $result.sidecar=$queued
      $result.status="QUEUED"
      $result.retryable=$false
    }
    "indie_runner_guard" {
      $runnerRoot = Join-Path $env:LOCALAPPDATA "KHS_Runners\indie"
      $runCmd = Join-Path $runnerRoot "run.cmd"
      $runnerConfig = Join-Path $runnerRoot ".runner"
      $result.runner_root = $runnerRoot
      $result.run_cmd_exists = Test-Path $runCmd
      $result.runner_config_exists = Test-Path $runnerConfig
      if (-not (Test-Path $runCmd)) { throw "KHS-INDIE run.cmd missing: $runCmd" }

      function GetIndieRunnerProcess {
        $needle = [IO.Path]::GetFullPath($runnerRoot).ToLowerInvariant()
        return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
          $cmdLine = [string]$_.CommandLine
          $exePath = [string]$_.ExecutablePath
          (($cmdLine.ToLowerInvariant().Contains($needle)) -or ($exePath.ToLowerInvariant().Contains($needle))) -and
          ($_.Name -match "Runner\.Listener|Runner\.Worker|cmd\.exe|powershell\.exe")
        })
      }

      $before = @(GetIndieRunnerProcess)
      $result.before_count = $before.Count
      $result.before = @($before | Select-Object ProcessId,Name,CommandLine)
      $started = $false
      if ($before.Count -eq 0) {
        Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "`"$runCmd`"") -WorkingDirectory $runnerRoot -WindowStyle Hidden | Out-Null
        Start-Sleep -Seconds 6
        $started = $true
      }
      $after = @(GetIndieRunnerProcess)
      $result.after_count = $after.Count
      $result.after = @($after | Select-Object ProcessId,Name,CommandLine)
      $result.started = $started
      if ($after.Count -eq 0) {
        throw "KHS-INDIE runner process not detected after guard"
      }
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

    "indieplus_apply_bundle" {
      $bundle=[string]$cmd.bundle
      if($bundle -notmatch '^[A-Za-z0-9_.-]+
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.sync=InvokeIndieSync
      $result.after_git=GitInfo $Indie
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_test" {
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.test=InvokeIndieTest
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_deploy" {
      if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
      $result.deploy=InvokeIndieDeploy ([bool]$cmd.include_functions)
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_sync_deploy" {
      if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.sync=InvokeIndieSync
      $result.test=InvokeIndieTest
      $result.deploy=InvokeIndieDeploy ([bool]$cmd.include_functions)
      $result.after_git=GitInfo $Indie
      $result.status="PASS"
      $result.retryable=$false
    }
    default {
      throw "Unsupported bounded action: $($cmd.action)"
    }
  }
} catch {
  $result.error = $_.Exception.Message
  $result.error_type = $_.Exception.GetType().FullName
  $result.error_script_stack = $_.ScriptStackTrace
  $result.error_position = $_.InvocationInfo.PositionMessage
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
){throw "invalid bundle name"}
      $dirty=(GitInfo $Indie)
      if($dirty.dirty){throw "DIRTY_WORKTREE"}
      $bundleRoot=Join-Path $env:GITHUB_WORKSPACE ("KHS_REMOTE\\prepared\\"+$bundle)
      $manifestPath=Join-Path $bundleRoot "manifest.json"
      if(-not (Test-Path $manifestPath)){throw "bundle manifest missing: $bundle"}
      $manifest=Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $changes=@()
      foreach($f in @($manifest.files)){
        $src=Join-Path $bundleRoot ([string]$f.source -replace '/','\\')
        if(-not (Test-Path $src)){throw "bundle source missing: $($f.source)"}
        $targetRel=[string]$f.target
        $root=[IO.Path]::GetFullPath($Indie).TrimEnd('\\')+'\\'
        $target=[IO.Path]::GetFullPath((Join-Path $Indie $targetRel))
        if(-not $target.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw "target escapes project: $targetRel"}
        $parent=Split-Path $target -Parent
        if($parent){New-Item -ItemType Directory -Path $parent -Force | Out-Null}
        $txt=Get-Content $src -Raw -Encoding UTF8
        [IO.File]::WriteAllText($target,$txt,(New-Object Text.UTF8Encoding($false)))
        $changes += @{source=[string]$f.source;target=$targetRel;bytes=$txt.Length}
      }
      $result.bundle=$bundle
      $result.changes=$changes
      $result.after_git=GitInfo $Indie
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_sync" {
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.sync=InvokeIndieSync
      $result.after_git=GitInfo $Indie
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_test" {
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.test=InvokeIndieTest
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_deploy" {
      if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
      $result.deploy=InvokeIndieDeploy ([bool]$cmd.include_functions)
      $result.status="PASS"
      $result.retryable=$false
    }
    "indieplus_sync_deploy" {
      if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
      $lock=Join-Path $Indie ".harness.lock"
      if(Test-Path $lock){throw "HARNESS_LOCK"}
      $result.sync=InvokeIndieSync
      $result.test=InvokeIndieTest
      $result.deploy=InvokeIndieDeploy ([bool]$cmd.include_functions)
      $result.after_git=GitInfo $Indie
      $result.status="PASS"
      $result.retryable=$false
    }
    default {
      throw "Unsupported bounded action: $($cmd.action)"
    }
  }
} catch {
  $result.error = $_.Exception.Message
  $result.error_type = $_.Exception.GetType().FullName
  $result.error_script_stack = $_.ScriptStackTrace
  $result.error_position = $_.InvocationInfo.PositionMessage
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

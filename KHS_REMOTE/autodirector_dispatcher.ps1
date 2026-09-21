param([string]$CmdPath)
$ErrorActionPreference = "Stop"

$Auto = Join-Path $env:USERPROFILE "Documents\ChatGPT\동영상편집기 만들기"
$ResultDir = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\autodirector_results"
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
function RunBounded([string[]]$argv,[int]$timeoutSec=1800) {
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $argv[0]
  if($argv.Length -gt 1){ foreach($a in $argv[1..($argv.Length-1)]) { [void]$psi.ArgumentList.Add($a) } }
  $psi.WorkingDirectory = $Auto
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdoutTask = $p.StandardOutput.ReadToEndAsync()
  $stderrTask = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($timeoutSec*1000)) { try{$p.Kill($true)}catch{}; throw "timeout after ${timeoutSec}s: $($argv -join ' ')" }
  $stdout = $stdoutTask.Result; $stderr = $stderrTask.Result
  if($stdout.Length -gt 120000){$stdout=$stdout.Substring($stdout.Length-120000)}
  if($stderr.Length -gt 60000){$stderr=$stderr.Substring($stderr.Length-60000)}
  return @{ exit=$p.ExitCode; stdout=$stdout; stderr=$stderr }
}
function GitInfo {
  $head = RunBounded @("git.exe","rev-parse","HEAD") 30
  $branch = RunBounded @("git.exe","branch","--show-current") 30
  $tracked = RunBounded @("git.exe","status","--short","--untracked-files=no") 45
  $untracked = RunBounded @("git.exe","ls-files","--others","--exclude-standard") 45
  $origin = RunBounded @("git.exe","remote","-v") 30
  $untrackedLines = @($untracked.stdout -split "`r?`n" | Where-Object { $_ })
  return @{
    head=$head.stdout.Trim(); branch=$branch.stdout.Trim()
    tracked_status=@($tracked.stdout -split "`r?`n" | Where-Object { $_ })
    untracked_count=$untrackedLines.Count
    untracked_sample=@($untrackedLines | Select-Object -First 200)
    origin=@($origin.stdout -split "`r?`n" | Where-Object { $_ })
    git_exit=@{head=$head.exit;branch=$branch.exit;tracked=$tracked.exit;untracked=$untracked.exit;origin=$origin.exit}
  }
}
function ResolveSafe([string]$rel) {
  if ([string]::IsNullOrWhiteSpace($rel)) { throw "empty relative path" }
  $full = [IO.Path]::GetFullPath((Join-Path $Auto $rel))
  $root = [IO.Path]::GetFullPath($Auto) + [IO.Path]::DirectorySeparatorChar
  if (-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)) { throw "path escapes AutoDirector root" }
  return $full
}
function StopPresent { return Test-Path (Join-Path $Auto ".harness\STOP") }

if (-not (Test-Path $Auto)) { throw "AutoDirector project missing: $Auto" }
if (-not $CmdPath) { throw "CmdPath required" }
$cmd = Get-Content $CmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
$result = [ordered]@{ request_id=$cmd.request_id; action=$cmd.action; project=$Auto; started_at=(Get-Date).ToString("o"); status="FAIL"; retryable=$true }

try {
  switch ([string]$cmd.action) {
    "autodirector_probe" {
      $run = ReadJsonSafe (Join-Path $Auto ".harness\RUNNING.json")
      $pidAlive = $false
      if($run -and $run.pid){ $pidAlive = $null -ne (Get-Process -Id ([int]$run.pid) -ErrorAction SilentlyContinue) }
      $pkg = ReadJsonSafe (Join-Path $Auto "package.json")
      $result.version = if($pkg){$pkg.version}else{$null}
      $result.stop_present = StopPresent
      $result.running = $run
      $result.running_pid_alive = $pidAlive
      $result.harness_status = ReadJsonSafe (Join-Path $Auto "reports\harness\status.json")
      $result.webchat_fallback = ReadJsonSafe (Join-Path $Auto ".harness\WEBCHAT_FALLBACK.json")
      $result.codex_available = $null -ne (Get-Command codex.cmd -ErrorAction SilentlyContinue)
      $result.status = "PASS"; $result.retryable = $false
    }
    "autodirector_status" {
      $run = ReadJsonSafe (Join-Path $Auto ".harness\RUNNING.json")
      $pidAlive = $false
      if($run -and $run.pid){ $pidAlive = $null -ne (Get-Process -Id ([int]$run.pid) -ErrorAction SilentlyContinue) }
      $pkg = ReadJsonSafe (Join-Path $Auto "package.json")
      $result.version = if($pkg){$pkg.version}else{$null}
      $result.stop_present = StopPresent
      $result.running = $run
      $result.running_pid_alive = $pidAlive
      $result.harness_status = ReadJsonSafe (Join-Path $Auto "reports\harness\status.json")
      $result.webchat_fallback = ReadJsonSafe (Join-Path $Auto ".harness\WEBCHAT_FALLBACK.json")
      $result.webchat_todo = ReadTextBounded (Join-Path $Auto "WEBCHAT_TODO.md") 120000
      $result.next_task = ReadTextBounded (Join-Path $Auto "NEXT_TASK.md") 120000
      $result.current_state = ReadTextBounded (Join-Path $Auto "CURRENT_STATE.md") 120000
      $result.git = GitInfo
      $result.codex_available = $null -ne (Get-Command codex.cmd -ErrorAction SilentlyContinue)
      $result.status = "PASS"; $result.retryable = $false
    }
    "autodirector_read" {
      $files = @()
      foreach($rel in @($cmd.paths)){
        $full=ResolveSafe ([string]$rel)
        $files += @{ path=[string]$rel; content=(ReadTextBounded $full 200000) }
      }
      $result.files=$files; $result.git=GitInfo; $result.status="PASS"; $result.retryable=$false
    }
    "autodirector_patch" {
      if(StopPresent){ throw "STOP_PRESENT" }
      $full=ResolveSafe ([string]$cmd.path)
      if(-not (Test-Path $full)){ throw "file missing: $($cmd.path)" }
      $old=[string]$cmd.old_string; $new=[string]$cmd.new_string
      if([string]::IsNullOrEmpty($old)){ throw "old_string empty" }
      $text=Get-Content $full -Raw -Encoding UTF8
      $count=([regex]::Matches($text,[regex]::Escape($old))).Count
      $expected=if($cmd.expected_replacements){[int]$cmd.expected_replacements}else{1}
      if($count -ne $expected){ throw "replacement count $count != expected $expected" }
      $updated=$text.Replace($old,$new)
      [IO.File]::WriteAllText($full,$updated,(New-Object Text.UTF8Encoding($false)))
      $result.path=[string]$cmd.path; $result.replacements=$count; $result.git=GitInfo; $result.status="PASS"; $result.retryable=$false
    }
    "autodirector_write_checkpoint" {
      if(StopPresent){ throw "STOP_PRESENT" }
      $allowed=@("WEBCHAT_TODO.md","reports\harness\status.json")
      $rel=[string]$cmd.path
      if($allowed -notcontains $rel){ throw "checkpoint path not allowed" }
      $full=ResolveSafe $rel
      New-Item -ItemType Directory -Path (Split-Path $full) -Force | Out-Null
      [IO.File]::WriteAllText($full,[string]$cmd.content,(New-Object Text.UTF8Encoding($false)))
      $result.path=$rel; $result.status="PASS"; $result.retryable=$false
    }
    "autodirector_test" {
      $kind=[string]$cmd.kind
      $map=@{
        "diff-check"=@("git.exe","diff","--check")
        "typecheck"=@("npm.cmd","run","typecheck")
        "unit"=@("npm.cmd","test")
        "learning-ux"=@("npm.cmd","run","verify:learning-ux")
        "verify-editor"=@("npm.cmd","run","verify:editor")
      }
      if(-not $map.ContainsKey($kind)){ throw "unsupported test kind: $kind" }
      $r=RunBounded $map[$kind] 3600
      $result.kind=$kind; $result.exit=$r.exit; $result.stdout=$r.stdout; $result.stderr=$r.stderr; $result.git=GitInfo
      $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}; $result.retryable=$true
    }
    "autodirector_codex" {
      if(StopPresent){ throw "STOP_PRESENT" }
      $prompt=[string]$cmd.prompt
      if([string]::IsNullOrWhiteSpace($prompt)){ throw "prompt empty" }
      if($prompt.Length -gt 60000){ throw "prompt too long" }
      $codex=(Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
      if(-not $codex){$candidate=Join-Path $env:APPDATA "npm\codex.cmd";if(Test-Path $candidate){$codex=$candidate}}
      if(-not $codex){ throw "codex.cmd not found" }
      $before=GitInfo
      $r=RunBounded @($codex,"exec","--sandbox","workspace-write","-") 3000
      $result.worker="codex"; $result.codex_exit=$r.exit; $result.codex_output=($r.stdout+$r.stderr); $result.before_git=$before; $result.after_git=GitInfo
      $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}; $result.retryable=$true
    }
    default { throw "Unsupported AutoDirector action: $($cmd.action)" }
  }
} catch {
  $result.error=$_.Exception.Message
  if($result.error -eq "STOP_PRESENT"){$result.status="STOPPED";$result.retryable=$false}else{$result.status="FAIL";$result.retryable=$true}
}
$result.finished_at=(Get-Date).ToString("o")
$json=($result|ConvertTo-Json -Depth 30)
$safe=([string]$cmd.request_id)-replace '[^A-Za-z0-9_.-]','_'
$out=Join-Path $ResultDir ($safe+".json")
[IO.File]::WriteAllText($out,$json,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $ResultDir "latest.json"),$json,(New-Object Text.UTF8Encoding($false)))
Write-Host $json

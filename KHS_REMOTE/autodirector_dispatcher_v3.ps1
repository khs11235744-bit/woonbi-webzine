param([string]$CmdPath)
$ErrorActionPreference = 'Stop'
$Auto = Join-Path $env:USERPROFILE 'Documents\ChatGPT\동영상편집기 만들기'
$ResultDir = Join-Path $env:GITHUB_WORKSPACE 'KHS_REMOTE\autodirector_results'
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null

function StopPresent { Test-Path (Join-Path $Auto '.harness\STOP') }
function SafePath([string]$Rel) {
  $full = [IO.Path]::GetFullPath((Join-Path $Auto $Rel))
  $root = [IO.Path]::GetFullPath($Auto) + [IO.Path]::DirectorySeparatorChar
  if (-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)) { throw 'path escapes AutoDirector root' }
  return $full
}
function ReadSmall([string]$Rel,[int]$Max=180000) {
  $p = SafePath $Rel
  if (-not (Test-Path $p)) { return $null }
  $f = Get-Item $p
  if ($f.Length -gt $Max) { return '[OMITTED: too large]' }
  return Get-Content $p -Raw -Encoding UTF8
}
function RunCapture([string]$File,[string[]]$Args) {
  Push-Location $Auto
  try {
    $lines = @(& $File @Args 2>&1 | ForEach-Object { $_.ToString() })
    $exit = $LASTEXITCODE
    if ($null -eq $exit) { $exit = 0 }
    return @{ exit=[int]$exit; output=($lines -join "`n") }
  } finally { Pop-Location }
}
function GitHead {
  $r = RunCapture 'git.exe' @('rev-parse','HEAD')
  if ($r.exit -ne 0) { throw "git rev-parse failed: $($r.output)" }
  return $r.output.Trim()
}
function GitStatusShort {
  $r = RunCapture 'git.exe' @('status','--short')
  if ($r.exit -ne 0) { throw "git status failed: $($r.output)" }
  return $r.output
}

if (-not (Test-Path $Auto)) { throw 'AutoDirector missing' }
$cmd = Get-Content $CmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
$result = [ordered]@{ request_id=$cmd.request_id; action=$cmd.action; project=$Auto; started_at=(Get-Date).ToString('o'); status='FAIL'; retryable=$true }
try {
  if (StopPresent) { throw 'STOP_PRESENT' }
  switch ([string]$cmd.action) {
    'autodirector_probe' {
      $pkg = Get-Content (Join-Path $Auto 'package.json') -Raw | ConvertFrom-Json
      $run = $null
      if (Test-Path (Join-Path $Auto '.harness\RUNNING.json')) { $run = Get-Content (Join-Path $Auto '.harness\RUNNING.json') -Raw | ConvertFrom-Json }
      $alive = $false
      if ($run -and $run.pid) { $alive = $null -ne (Get-Process -Id ([int]$run.pid) -ErrorAction SilentlyContinue) }
      $result.version = $pkg.version
      $result.head = GitHead
      $result.git_status_short = GitStatusShort
      $result.stop_present = $false
      $result.running = $run
      $result.running_pid_alive = $alive
      $result.harness_status = if (Test-Path (Join-Path $Auto 'reports\harness\status.json')) { Get-Content (Join-Path $Auto 'reports\harness\status.json') -Raw | ConvertFrom-Json } else { $null }
      $result.codex_available = $null -ne (Get-Command codex.cmd -ErrorAction SilentlyContinue)
      $result.status = 'PASS'; $result.retryable = $false
    }
    'autodirector_read_fast' {
      $arr = @(); foreach($rel in @($cmd.paths)) { $arr += @{ path=[string]$rel; content=ReadSmall([string]$rel) } }
      $result.files=$arr; $result.head=GitHead; $result.git_status_short=GitStatusShort; $result.status='PASS'; $result.retryable=$false
    }
    'autodirector_codex' {
      $gc = Get-Command codex.cmd -ErrorAction SilentlyContinue
      $codex = if($gc){$gc.Source}else{$null}
      if(-not $codex){$cand=Join-Path $env:APPDATA 'npm\codex.cmd'; if(Test-Path $cand){$codex=$cand}}
      if(-not $codex){throw 'codex.cmd not found'}
      $r = RunCapture $codex @('exec','--sandbox','workspace-write','--color','never',[string]$cmd.prompt)
      $result.worker='codex'; $result.codex_exit=$r.exit; $result.stdout=$r.output
      $dc = RunCapture 'git.exe' @('diff','--check')
      $result.diff_check=@{exit=$dc.exit;output=$dc.output}; $result.head=GitHead; $result.git_status_short=GitStatusShort
      $result.status=if($r.exit -eq 0 -and $dc.exit -eq 0){'NEEDS_VERIFICATION'}else{'FAIL'}
    }
    'autodirector_test' {
      $map=@{
        'diff-check'=@('git.exe',@('diff','--check'))
        'typecheck'=@('npm.cmd',@('run','typecheck'))
        'unit'=@('npm.cmd',@('test'))
        'learning-ux'=@('npm.cmd',@('run','verify:learning-ux'))
        'verify-editor'=@('npm.cmd',@('run','verify:editor'))
      }
      $k=[string]$cmd.kind; if(-not $map.ContainsKey($k)){throw "unsupported test $k"}
      $spec=$map[$k]; $r=RunCapture $spec[0] $spec[1]
      $result.kind=$k; $result.exit=$r.exit; $result.output=$r.output; $result.head=GitHead; $result.status=if($r.exit -eq 0){'PASS'}else{'FAIL'}
    }
    'autodirector_write_checkpoint' {
      $rel=[string]$cmd.path
      if($rel -notin @('WEBCHAT_TODO.md','reports\harness\status.json')){throw 'checkpoint path not allowed'}
      $p=SafePath $rel; New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null
      [IO.File]::WriteAllText($p,[string]$cmd.content,(New-Object Text.UTF8Encoding($false)))
      $result.path=$rel; $result.head=GitHead; $result.status='PASS'; $result.retryable=$false
    }
    'autodirector_harness_start' {
      $run=$null; if(Test-Path(Join-Path $Auto '.harness\RUNNING.json')){$run=Get-Content(Join-Path $Auto '.harness\RUNNING.json')-Raw|ConvertFrom-Json}
      $alive=$false; if($run -and $run.pid){$alive=$null-ne(Get-Process -Id([int]$run.pid)-ErrorAction SilentlyContinue)}
      if(-not $alive){$r=RunCapture 'npm.cmd' @('run','harness:start');$result.start_exit=$r.exit;$result.output=$r.output}
      $result.was_alive=$alive; $result.status='PASS'; $result.retryable=$false
    }
    default { throw "unsupported action: $($cmd.action)" }
  }
} catch {
  $result.error=$_.Exception.Message
  if($result.error -eq 'STOP_PRESENT'){$result.status='STOPPED';$result.retryable=$false}
}
$result.finished_at=(Get-Date).ToString('o')
$json=$result|ConvertTo-Json -Depth 30
$safe=([string]$cmd.request_id)-replace'[^A-Za-z0-9_.-]','_'
[IO.File]::WriteAllText((Join-Path $ResultDir ($safe+'.json')),$json,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $ResultDir 'latest.json'),$json,(New-Object Text.UTF8Encoding($false)))
Write-Host $json

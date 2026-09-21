param([Parameter(Mandatory=$true)][string]$CmdPath)
$ErrorActionPreference = "Stop"

$Project = Join-Path $env:USERPROFILE "Documents\time drafe\early-heat-radar"
$ResultDir = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\results\earlyheat"
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null

function ReadTextBounded([string]$Path,[int]$Max=120000) {
  if (-not (Test-Path $Path)) { return $null }
  $f = Get-Item $Path
  if ($f.Length -gt $Max) { return "[OMITTED: too large]" }
  return Get-Content $Path -Raw -Encoding UTF8
}

function RunNative([string]$Exe,[string[]]$Args,[string]$WorkingDir,[int]$TimeoutMs=15000) {
  $id=[guid]::NewGuid().ToString("N")
  $out=Join-Path $env:TEMP ("ehr-out-"+$id+".txt")
  $err=Join-Path $env:TEMP ("ehr-err-"+$id+".txt")
  try {
    $quoted=@()
    foreach($a in $Args){
      if($null -ne $a){
        $s=[string]$a
        $quoted += ('"' + ($s -replace '"','\"') + '"')
      }
    }
    $p=Start-Process -FilePath $Exe -ArgumentList ($quoted -join " ") -WorkingDirectory $WorkingDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
    if(-not $p.WaitForExit($TimeoutMs)){
      try{$p.Kill($true)}catch{}
      return @{exit=124;timed_out=$true;output="timeout"}
    }
    $o=if(Test-Path $out){Get-Content $out -Raw -ErrorAction SilentlyContinue}else{""}
    $e=if(Test-Path $err){Get-Content $err -Raw -ErrorAction SilentlyContinue}else{""}
    return @{exit=$p.ExitCode;timed_out=$false;output=(($o+[Environment]::NewLine+$e).Trim())}
  } finally {
    Remove-Item $out,$err -Force -ErrorAction SilentlyContinue
  }
}

function GitInfo {
  $head=RunNative "git.exe" @("rev-parse","HEAD") $Project 8000
  $branch=RunNative "git.exe" @("branch","--show-current") $Project 8000
  $status=RunNative "git.exe" @("status","--porcelain") $Project 12000
  $lines=@()
  if($status.output){$lines=@($status.output -split '\r?\n' | Where-Object { $_ })}
  return @{
    head=([string]$head.output).Trim()
    branch=([string]$branch.output).Trim()
    dirty=($lines.Count -gt 0)
    dirty_count=$lines.Count
    dirty_files=$lines
    status_exit=$status.exit
  }
}

function LockSnapshot {
  $locks=@(
    (Join-Path $Project ".harness.lock"),
    (Join-Path $Project ".runtime\harness.lock"),
    (Join-Path $Project ".git\index.lock")
  )
  return @($locks | Where-Object { Test-Path $_ })
}

function OtherCodexRunning {
  $items=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ([string]$_.Name) -match "(?i)^(codex|codex\.exe|node|node\.exe|cmd|cmd\.exe|powershell|powershell\.exe)$" -and
    ([string]$_.CommandLine) -match "(?i)codex"
  })
  return @($items | Select-Object ProcessId,Name,CommandLine)
}

function SafetySnapshot {
  $flagsPath=Join-Path $Project "src\config\featureFlags.ts"
  $text=ReadTextBounded $flagsPath 80000
  $unsafe=$false
  $reasons=@()
  if($text){
    if($text -match '(?is)LIVE_ORDER_EXECUTION\s*[:=]\s*(true|["'']ENABLED["''])'){
      $unsafe=$true
      $reasons+="LIVE_ORDER_EXECUTION appears enabled"
    }
    if($text -match '(?is)EXPERIMENTAL_ENTRY_RULES\s*[:=]\s*["'']LIVE["'']'){
      $unsafe=$true
      $reasons+="EXPERIMENTAL_ENTRY_RULES appears LIVE"
    }
  }
  return @{
    path=$flagsPath
    exists=(Test-Path $flagsPath)
    unsafe=$unsafe
    reasons=$reasons
    text=$text
  }
}

function Snapshot {
  return @{
    project=$Project
    exists=(Test-Path $Project)
    git=if(Test-Path $Project){GitInfo}else{$null}
    locks=if(Test-Path $Project){LockSnapshot}else{@()}
    other_codex=if(Test-Path $Project){OtherCodexRunning}else{@()}
    handoff=ReadTextBounded (Join-Path $Project ".runtime\automation-handoff-latest.json") 120000
    harness=ReadTextBounded (Join-Path $Project ".runtime\harness-state.json") 120000
    safety=if(Test-Path $Project){SafetySnapshot}else{$null}
  }
}

function RunCodex([string]$Prompt,[int]$TimeoutSec=2100) {
  if([string]::IsNullOrWhiteSpace($Prompt)){ throw "prompt empty" }
  if($Prompt.Length -gt 50000){ throw "prompt too long" }

  $codex=(Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
  if(-not $codex){
    $candidate=Join-Path $env:APPDATA "npm\codex.cmd"
    if(Test-Path $candidate){$codex=$candidate}
  }
  if(-not $codex){ throw "codex.cmd not found" }

  $guardLines=@(
    "EARLY HEAT RADAR REMOTE SAFETY CONTRACT:",
    "- Work only in the current Early Heat Radar project.",
    "- Perform exactly one bounded next-priority task.",
    "- Read .runtime/automation-handoff-latest.json and .runtime/harness-state.json first when present.",
    "- Preserve the current local HEAD and dirty overlay. Never git reset, clean, checkout, stash, rebase, or overwrite unrelated changes.",
    "- Real/live order execution must remain disabled. Paper/Shadow only. Never weaken this rule.",
    "- Do not reveal or copy secrets, tokens, .env contents, credentials, or account identifiers.",
    "- Verify actual files and run the smallest relevant tests/build checks. Do not claim PASS without evidence."
  )
  $nl=[Environment]::NewLine
  $full=($guardLines -join $nl)+$nl+"USER TASK:"+$nl+$Prompt

  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName="cmd.exe"
  $psi.Arguments=('/d /s /c ""' + $codex + '" exec --sandbox workspace-write -"')
  $psi.WorkingDirectory=$Project
  $psi.UseShellExecute=$false
  $psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true

  $p=New-Object Diagnostics.Process
  $p.StartInfo=$psi
  [void]$p.Start()
  $p.StandardInput.Write($full)
  $p.StandardInput.Close()
  $ot=$p.StandardOutput.ReadToEndAsync()
  $et=$p.StandardError.ReadToEndAsync()

  if(-not $p.WaitForExit($TimeoutSec*1000)){
    try{$p.Kill($true)}catch{}
    return @{exit=124;timed_out=$true;output=("Codex timeout after "+$TimeoutSec+"s")}
  }

  $combined=(($ot.Result+[Environment]::NewLine+$et.Result).Trim())
  if($combined.Length -gt 120000){$combined=$combined.Substring($combined.Length-120000)}
  return @{exit=$p.ExitCode;timed_out=$false;output=$combined}
}

if(-not(Test-Path $Project)){ throw "Early Heat Radar project missing: $Project" }
if(-not(Test-Path $CmdPath)){ throw "CmdPath missing: $CmdPath" }

$cmd=Get-Content $CmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
if([string]$cmd.project -ne "EARLY_HEAT_RADAR"){ throw "project not allowed" }

$result=[ordered]@{
  request_id=[string]$cmd.request_id
  action=[string]$cmd.action
  project="EARLY_HEAT_RADAR"
  started_at=(Get-Date).ToString("o")
  status="FAIL"
  retryable=$true
}

try {
  switch([string]$cmd.action) {
    "status" {
      $result.snapshot=Snapshot
      if($result.snapshot.safety.unsafe){
        $result.status="BLOCKED_UNSAFE"
        $result.retryable=$false
      } else {
        $result.status="PASS"
        $result.retryable=$false
      }
    }
    "earlyheat_codex" {
      $before=Snapshot
      $result.before=$before

      if($before.locks.Count -gt 0){
        $result.status="BLOCKED_LOCK"
        $result.retryable=$true
        break
      }
      if($before.other_codex.Count -gt 0){
        $result.status="BLOCKED_CONCURRENT_CODEX"
        $result.retryable=$true
        break
      }
      if($before.safety.unsafe){
        $result.status="BLOCKED_UNSAFE"
        $result.retryable=$false
        break
      }

      $run=RunCodex ([string]$cmd.prompt) 2100
      $result.codex_exit=$run.exit
      $result.codex_timeout=$run.timed_out
      $result.codex_output=$run.output
      $result.after=Snapshot

      $verify=RunNative "git.exe" @("diff","--check") $Project 20000
      $result.verifier=@{
        name="git diff --check"
        exit=$verify.exit
        timed_out=$verify.timed_out
        output=$verify.output
      }

      if($result.after.safety.unsafe){
        $result.status="FAIL_SAFETY"
        $result.retryable=$false
      } elseif($run.exit -ne 0 -or $verify.exit -ne 0){
        $result.status="FAIL"
        $result.retryable=$true
      } else {
        $result.status="NEEDS_VERIFICATION"
        $result.retryable=$true
      }
    }
    default {
      throw ("unsupported action: "+[string]$cmd.action)
    }
  }
} catch {
  $result.error=$_.Exception.Message
  $result.status="FAIL"
  $result.retryable=$true
}

$result.finished_at=(Get-Date).ToString("o")
$json=$result | ConvertTo-Json -Depth 30
$safe=([string]$cmd.request_id)-replace "[^A-Za-z0-9_.-]","_"
if([string]::IsNullOrWhiteSpace($safe)){$safe="unknown"}

[IO.File]::WriteAllText((Join-Path $ResultDir ($safe+".json")),$json,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $ResultDir "latest.json"),$json,(New-Object Text.UTF8Encoding($false)))
Write-Host $json

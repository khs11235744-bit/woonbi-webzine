param([string]$CmdPath)
$ErrorActionPreference = "Stop"

$Base = Join-Path $env:USERPROFILE "Documents\ChatGPT"
$Mini = Join-Path $Base "KHS_MINI_JEV"
$Flow = Join-Path $Base "KHS_FLOW_OS_v0.3"
$ResultDir = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\results\minijev"
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null

function ReadJsonSafe([string]$p) {
  if (-not (Test-Path $p)) { return $null }
  try { return Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return @{ parse_error=$_.Exception.Message } }
}

function ReadTextBounded([string]$p,[int]$max=200000) {
  if (-not (Test-Path $p)) { return $null }
  $f=Get-Item $p
  if($f.Length -gt $max){ return "[OMITTED: too large]" }
  return Get-Content $p -Raw -Encoding UTF8
}

function RunNativeBounded([string]$exe,[string[]]$nativeArgs,[string]$workingDir,[int]$timeoutMs=10000) {
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName=$exe
  $quoted=@()
  foreach($a in $nativeArgs){
    if($null -ne $a){
      $s=[string]$a
      $quoted += ('"' + ($s -replace '"', '\\"') + '"')
    }
  }
  $psi.Arguments=($quoted -join " ")
  $psi.WorkingDirectory=$workingDir
  $psi.UseShellExecute=$false
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true
  $p=New-Object Diagnostics.Process
  $p.StartInfo=$psi
  [void]$p.Start()
  $stdoutTask=$p.StandardOutput.ReadToEndAsync()
  $stderrTask=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit($timeoutMs)){
    try{$p.Kill()}catch{}
    return @{exit=124;timed_out=$true;output=("timeout after "+$timeoutMs+"ms")}
  }
  $stdout=$stdoutTask.Result
  $stderr=$stderrTask.Result
  return @{exit=$p.ExitCode;timed_out=$false;output=(($stdout+"`n"+$stderr).Trim())}
}

function GitInfo([string]$root) {
  $gitPath=Join-Path $root ".git"
  if(-not(Test-Path $gitPath)){ return @{git=$false} }

  $headValue=$null
  $branchValue=$null
  try {
    if(Test-Path $gitPath -PathType Container) {
      $headText=(Get-Content (Join-Path $gitPath "HEAD") -Raw -ErrorAction Stop).Trim()
      if($headText.StartsWith("ref: ")) {
        $ref=$headText.Substring(5).Trim()
        if($ref.StartsWith("refs/heads/")){$branchValue=$ref.Substring(11)}
        $refFile=Join-Path $gitPath ($ref -replace "/","\")
        if(Test-Path $refFile){$headValue=(Get-Content $refFile -Raw).Trim()}
        elseif(Test-Path (Join-Path $gitPath "packed-refs")) {
          $packed=Get-Content (Join-Path $gitPath "packed-refs") | Where-Object { $_ -match ("^[0-9a-fA-F]+\s+"+[regex]::Escape($ref)+"$") } | Select-Object -First 1
          if($packed){$headValue=($packed -split "\s+")[0]}
        }
      } else {
        $headValue=$headText
      }
    }
  } catch {}

  if(-not $headValue) {
    $head=RunNativeBounded "git.exe" @("rev-parse","HEAD") $root 4000
    if($head.exit -eq 0){$headValue=$head.output.Trim()}
  }

  $status=RunNativeBounded "git.exe" @("status","--porcelain") $root 5000
  $dirtyLines=@()
  if(-not $status.timed_out -and $status.output){$dirtyLines=@($status.output -split "`r?`n")}

  return @{
    git=$true
    head=$headValue
    branch=$branchValue
    dirty=if($status.timed_out){$null}else{($dirtyLines.Count -gt 0)}
    dirty_count=if($status.timed_out){$null}else{$dirtyLines.Count}
    dirty_files=$dirtyLines
    git_status_timeout=$status.timed_out
  }
}

function SystemSnapshot {
  try { Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue } catch {}
  $ci=New-Object Microsoft.VisualBasic.Devices.ComputerInfo
  $disk=Get-PSDrive C
  $gpu=$null
  if(Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue){
    $nr=RunNativeBounded "nvidia-smi.exe" @("--query-gpu=name,utilization.gpu,memory.total,memory.used,memory.free,temperature.gpu","--format=csv,noheader,nounits") $env:TEMP 5000
    if($nr.exit -eq 0 -and -not $nr.timed_out -and $nr.output){
      $line=($nr.output -split "`r?`n")[0]
      $p=$line -split ",\s*"
      $gpu=@{name=$p[0];utilization_pct=[int]$p[1];memory_total_mb=[int]$p[2];memory_used_mb=[int]$p[3];memory_free_mb=[int]$p[4];temperature_c=[int]$p[5];timed_out=$false}
    } elseif($nr.timed_out){ $gpu=@{timed_out=$true} }
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

function HarnessSnapshot([bool]$includeGit=$true) {
  $hbPath=Join-Path $Mini ".harness\heartbeat.json"
  $hbAge=$null
  if(Test-Path $hbPath){$hbAge=[math]::Round(((Get-Date)-(Get-Item $hbPath).LastWriteTime).TotalSeconds,1)}
  return @{
    latest_status=ReadJsonSafe (Join-Path $Mini "reports\latest-status.json")
    heartbeat=ReadJsonSafe $hbPath
    heartbeat_file_age_sec=$hbAge
    state=ReadJsonSafe (Join-Path $Mini ".harness\state.json")
    webchat_todo=ReadTextBounded (Join-Path $Mini "WEBCHAT_TODO.md") 160000
    research_router_user_patterns=ReadTextBounded (Join-Path $Mini "research\ROUTER_USER_PATTERNS_20260921.md") 200000
    stop_present=Test-Path (Join-Path $Mini ".harness\STOP")
    git=if($includeGit){GitInfo $Mini}else{$null}
  }
}

function RestartWatchdogBounded {
  $watchdog=Join-Path $Mini "scripts\watchdog.ps1"
  if(-not(Test-Path $watchdog)){throw "watchdog.ps1 missing"}
  return RunNativeBounded "powershell.exe" @("-NoProfile","-ExecutionPolicy","Bypass","-File",$watchdog) $Mini 30000
}

function RunCodexBounded([string]$prompt,[int]$timeoutSec=1800) {
  if([string]::IsNullOrWhiteSpace($prompt)){throw "prompt empty"}
  if($prompt.Length -gt 60000){throw "prompt too long"}
  $codex=(Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
  if(-not $codex){$candidate=Join-Path $env:APPDATA "npm\codex.cmd";if(Test-Path $candidate){$codex=$candidate}}
  if(-not $codex){throw "codex.cmd not found"}
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName="cmd.exe"
  $psi.Arguments=('/d /s /c ""' + $codex + '" exec --sandbox workspace-write -"' )
  $psi.WorkingDirectory=$Mini
  $psi.UseShellExecute=$false
  $psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true
  $p=New-Object Diagnostics.Process
  $p.StartInfo=$psi
  [void]$p.Start()
  $p.StandardInput.Write($prompt)
  $p.StandardInput.Close()
  $outTask=$p.StandardOutput.ReadToEndAsync()
  $errTask=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit($timeoutSec*1000)){
    try{$p.Kill()}catch{}
    return @{exit=124;timed_out=$true;output=("Codex timeout after "+$timeoutSec+"s")}
  }
  $combined=(($outTask.Result+"`n"+$errTask.Result).Trim())
  if($combined.Length -gt 120000){$combined=$combined.Substring($combined.Length-120000)}
  return @{exit=$p.ExitCode;timed_out=$false;output=$combined}
}

function ProbeSidecars {
  $names=@("antigravity.exe","antigravity.cmd","antigravity","gemini.cmd","gemini.exe","gemini","code.cmd","code.exe")
  $found=@()
  foreach($n in $names){
    $g=Get-Command $n -ErrorAction SilentlyContinue
    if($g){$found+=@{name=$n;source=$g.Source;command_type=[string]$g.CommandType}}
  }
  $known=@(
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Google\Antigravity\Antigravity.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe")
  )
  foreach($p in $known){if(Test-Path $p){$found+=@{name=[IO.Path]::GetFileName($p);source=$p;command_type="KnownPath"}}}
  return $found
}

function WriteSidecarTodo([string]$worker,[string]$prompt,[string]$requestId) {
  if($worker -notin @("antigravity","webchat")){throw "unsupported sidecar worker: $worker"}
  $dir=Join-Path $Mini ".harness"
  New-Item -ItemType Directory -Path $dir -Force|Out-Null
  $path=Join-Path $dir "SIDECAR_TODO.json"
  $payload=[ordered]@{request_id=$requestId;worker=$worker;status="READY";prompt=$prompt;created_at=(Get-Date).ToString("o");note="READY is a request state, not completion."}
  [IO.File]::WriteAllText($path,($payload|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  return $path
}

function ConsumeSidecar([string]$requestId) {
  $todoPath=Join-Path $Mini ".harness\SIDECAR_TODO.json"
  $resultPath=Join-Path $Mini ".harness\SIDECAR_RESULT.json"
  if(-not(Test-Path $todoPath)){return @{status="IDLE";retryable=$false;reason="NO_TODO"}}
  $todo=Get-Content $todoPath -Raw -Encoding UTF8|ConvertFrom-Json
  if($todo.status -ne "READY"){return @{status="IDLE";retryable=$false;reason=("TODO_"+$todo.status)}}
  $configPath=Join-Path $Mini ".harness\SIDECAR_EXECUTOR.json"
  if(-not(Test-Path $configPath)){
    $todo.status="BLOCKED_NO_EXECUTOR"
    $todo.blocked_at=(Get-Date).ToString("o")
    [IO.File]::WriteAllText($todoPath,($todo|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
    $r=@{request_id=$todo.request_id;worker=$todo.worker;status="BLOCKED_NO_EXECUTOR";retryable=$true;probed=(ProbeSidecars);finished_at=(Get-Date).ToString("o")}
    [IO.File]::WriteAllText($resultPath,($r|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
    return $r
  }
  $cfg=Get-Content $configPath -Raw -Encoding UTF8|ConvertFrom-Json
  $exe=[string]$cfg.exe
  if([string]::IsNullOrWhiteSpace($exe) -or -not(Test-Path $exe)){throw "configured sidecar executable missing"}
  $leaf=[IO.Path]::GetFileName($exe).ToLowerInvariant()
  if($leaf -notin @("antigravity.exe","antigravity.cmd","gemini.exe","gemini.cmd")){throw "sidecar executable not allowed: $leaf"}
  $promptFile=Join-Path $env:TEMP ("khs-sidecar-"+[guid]::NewGuid().ToString("N")+".txt")
  [IO.File]::WriteAllText($promptFile,[string]$todo.prompt,(New-Object Text.UTF8Encoding($false)))
  try{
    $args=@()
    foreach($a in @($cfg.args)){
      $s=[string]$a
      $args+=($s.Replace("{promptFile}",$promptFile).Replace("{projectRoot}",$Mini))
    }
    $run=RunNativeBounded $exe $args $Mini 1200000
    $finalStatus=if($run.exit -eq 0){"NEEDS_VERIFICATION"}else{"FAIL"}
    $todo.status=$finalStatus
    $todo.consumed_at=(Get-Date).ToString("o")
    [IO.File]::WriteAllText($todoPath,($todo|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
    $r=@{request_id=$todo.request_id;worker=$todo.worker;status=$finalStatus;retryable=$true;exit=$run.exit;timed_out=$run.timed_out;output=$run.output;finished_at=(Get-Date).ToString("o")}
    [IO.File]::WriteAllText($resultPath,($r|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
    return $r
  } finally {Remove-Item $promptFile -Force -ErrorAction SilentlyContinue}
}

if(-not(Test-Path $Mini)){throw "KHS_MINI_JEV project missing: $Mini"}
if(-not $CmdPath){throw "CmdPath required"}
$cmd=Get-Content $CmdPath -Raw -Encoding UTF8|ConvertFrom-Json
$result=[ordered]@{request_id=$cmd.request_id;action=$cmd.action;project="KHS_MINI_JEV";started_at=(Get-Date).ToString("o");status="FAIL";retryable=$true}

try{
  switch([string]$cmd.action){
    "snapshot_guard" {
      $before=HarnessSnapshot $false
      $restarted=$false
      $watchdogOutput=$null
      if(-not $before.stop_present -and ($null -eq $before.heartbeat_file_age_sec -or $before.heartbeat_file_age_sec -gt 300)){
        $wr=RestartWatchdogBounded
        $watchdogOutput=$wr.output
        if($wr.exit -ne 0){throw ("watchdog restart failed exit="+$wr.exit+" timeout="+$wr.timed_out)}
        Start-Sleep -Seconds 3
        $restarted=$true
      }
      $result.before=$before
      $result.after=HarnessSnapshot $true
      $result.system=SystemSnapshot
      $result.flow_git=GitInfo $Flow
      $result.restart_occurred=$restarted
      $result.watchdog_output=$watchdogOutput
      $result.status="PASS";$result.retryable=$false
    }
    "minijev_codex" {
      if(Test-Path (Join-Path $Mini ".harness\STOP")){$result.status="STOPPED";$result.retryable=$false;break}
      $result.before_git=GitInfo $Mini
      $prompt=[string]$cmd.prompt
      if([string]::IsNullOrWhiteSpace($prompt)){
        $prompt="Read real KHS_MINI_JEV state and perform exactly one bounded next task. Preserve current local HEAD and dirty overlay. Deterministic guard before learned routing. Local model only for small bounded routing/classification/review. Frontier/WebChat remain authority for complex implementation. Do not claim PASS until actual files and tests are verified. If MJ-001..MJ-007 are DONE, follow P2-1 then P2-2 then P2-3."
      }
      $r=RunCodexBounded $prompt 1800
      $result.worker="codex";$result.codex_exit=$r.exit;$result.codex_timeout=$r.timed_out;$result.codex_output=$r.output
      $result.after_git=GitInfo $Mini
      $v=RunNativeBounded "git.exe" @("diff","--check") $Mini 12000
      $result.verifier=@{name="git diff --check";exit=$v.exit;timed_out=$v.timed_out;output=$v.output}
      if($r.exit -ne 0 -or $v.exit -ne 0){$result.status="FAIL";$result.retryable=$true}else{$result.status="NEEDS_VERIFICATION";$result.retryable=$true}
    }
    "sidecar_probe" {
      $result.executors=ProbeSidecars
      $result.status="PASS";$result.retryable=$false
    }
    "sidecar_request" {
      $worker=([string]$cmd.worker).ToLowerInvariant()
      $prompt=[string]$cmd.prompt
      if([string]::IsNullOrWhiteSpace($prompt)){$prompt="Inspect current Mini-Jev state and assist with one bounded task. Do not claim completion without verification."}
      $result.todo_path=WriteSidecarTodo $worker $prompt ([string]$cmd.request_id)
      $consume=ConsumeSidecar ([string]$cmd.request_id)
      $result.sidecar=$consume
      $result.status=$consume.status
      $result.retryable=$consume.retryable
    }
    "sidecar_consume" {
      $consume=ConsumeSidecar ([string]$cmd.request_id)
      $result.sidecar=$consume
      $result.status=$consume.status
      $result.retryable=$consume.retryable
    }
    default {throw ("unsupported Mini-Jev action: "+$cmd.action)}
  }
} catch {
  $result.error=$_.Exception.Message
  $result.status="FAIL";$result.retryable=$true
}
$result.finished_at=(Get-Date).ToString("o")
$json=$result|ConvertTo-Json -Depth 30
$safe=([string]$cmd.request_id)-replace "[^A-Za-z0-9_.-]","_"
$out=Join-Path $ResultDir ($safe+".json")
[IO.File]::WriteAllText($out,$json,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $ResultDir "latest.json"),$json,(New-Object Text.UTF8Encoding($false)))
Write-Host $json
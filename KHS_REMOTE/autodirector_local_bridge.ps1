$ErrorActionPreference = "Stop"

$Repo = "khs11235744-bit/-"
$Bridge = Join-Path $env:USERPROFILE "KHS_AUTODIRECTOR_BRIDGE"
$Project = Join-Path $env:USERPROFILE "Documents\ChatGPT\동영상편집기 만들기"
$StateDir = Join-Path $env:USERPROFILE "KHS_REMOTE_STATE\AUTODIRECTOR"
$JobsRelDir = "KHS_REMOTE\autodirector_bridge_jobs"
$ResultRelDir = "KHS_REMOTE\autodirector_results"
$AllowedTextExtensions = @(".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".md",".css",".scss",".html",".yml",".yaml",".txt",".ps1",".cmd")

function Say($m){ Write-Host ("[AUTODIRECTOR-BRIDGE v1] " + $m) }
function SafeId([string]$s){ return ($s -replace '[^A-Za-z0-9_.-]','_') }
function WriteUtf8NoBom([string]$path,[string]$text){
  $parent=Split-Path $path -Parent
  if($parent){ New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [IO.File]::WriteAllText($path,$text,(New-Object Text.UTF8Encoding($false)))
}
function ReadJsonSafe([string]$path){
  if(-not (Test-Path $path)){ return $null }
  try { return Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return @{ parse_error=$_.Exception.Message } }
}
function ReadTextBounded([string]$path,[int]$maxBytes=200000){
  if(-not (Test-Path $path)){ return $null }
  $f=Get-Item $path
  if($f.Length -gt $maxBytes){ return "[OMITTED: too large]" }
  return Get-Content $path -Raw -Encoding UTF8
}
function GitInfo([string]$root){
  Push-Location $root
  try {
    $head=((& git rev-parse HEAD 2>$null | Out-String).Trim())
    $branch=((& git branch --show-current 2>$null | Out-String).Trim())
    $status=@(& git status --porcelain 2>$null)
    return @{ head=$head; branch=$branch; dirty=($status.Count -gt 0); status=$status }
  } finally { Pop-Location }
}
function ProjectPath([string]$rel){
  if([string]::IsNullOrWhiteSpace($rel)){ throw "empty relative path" }
  if([IO.Path]::IsPathRooted($rel)){ throw "absolute path rejected: $rel" }
  $root=[IO.Path]::GetFullPath($Project).TrimEnd('\') + '\'
  $full=[IO.Path]::GetFullPath((Join-Path $Project $rel))
  if(-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){ throw "path escapes AutoDirector root: $rel" }
  return $full
}
function AssertTextPath([string]$rel){
  $full=ProjectPath $rel
  $ext=[IO.Path]::GetExtension($full).ToLowerInvariant()
  if($AllowedTextExtensions -notcontains $ext){ throw "file extension not allowed for bounded patch: $ext" }
  return $full
}
function HarnessInfo {
  $run=ReadJsonSafe (Join-Path $Project ".harness\RUNNING.json")
  $alive=$false
  if($run -and $run.pid){ $alive=$null -ne (Get-Process -Id ([int]$run.pid) -ErrorAction SilentlyContinue) }
  return @{ running=$run; pid_alive=$alive; stop_present=(Test-Path (Join-Path $Project ".harness\STOP")); status=(ReadJsonSafe (Join-Path $Project "reports\harness\status.json")) }
}
function AssertNoLiveHarness {
  $h=HarnessInfo
  if($h.pid_alive){ throw ("HARNESS_ACTIVE pid=" + [string]$h.running.pid) }
}
function RunBounded([string]$file,[string[]]$args,[int]$timeoutSec=3600){
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName=$file
  $psi.Arguments=($args -join " ")
  $psi.WorkingDirectory=$Project
  $psi.UseShellExecute=$false
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true
  $p=New-Object Diagnostics.Process
  $p.StartInfo=$psi
  [void]$p.Start()
  $stdoutTask=$p.StandardOutput.ReadToEndAsync()
  $stderrTask=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit($timeoutSec*1000)){
    try{$p.Kill($true)}catch{}
    throw "timeout after ${timeoutSec}s: $file $($args -join ' ')"
  }
  $stdout=$stdoutTask.Result; $stderr=$stderrTask.Result
  if($stdout.Length -gt 120000){$stdout=$stdout.Substring($stdout.Length-120000)}
  if($stderr.Length -gt 60000){$stderr=$stderr.Substring($stderr.Length-60000)}
  return @{ exit=$p.ExitCode; stdout=$stdout; stderr=$stderr }
}
function RefreshBridge {
  Push-Location $Bridge
  try {
    git fetch origin main --quiet
    if($LASTEXITCODE -ne 0){ throw "bridge fetch failed" }
    git reset --hard origin/main --quiet
    if($LASTEXITCODE -ne 0){ throw "bridge reset failed" }
  } finally { Pop-Location }
}
function PublishResult($obj){
  $rid=SafeId([string]$obj.request_id)
  if(-not $rid){ return }
  $json=$obj | ConvertTo-Json -Depth 40
  for($attempt=1;$attempt -le 5;$attempt++){
    try{
      RefreshBridge
      Push-Location $Bridge
      try {
        $dir=Join-Path $Bridge $ResultRelDir
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $per=Join-Path $dir ($rid + ".json")
        $latest=Join-Path $dir "latest-bridge.json"
        WriteUtf8NoBom $per $json
        WriteUtf8NoBom $latest $json
        git config user.name "KHS AutoDirector Local Bridge"
        git config user.email "khs-autodirector-bridge@users.noreply.github.com"
        git add -- $per $latest
        if(git diff --cached --quiet){ return }
        git commit -m ("AUTODIRECTOR_BRIDGE_RESULT: " + $rid + " [" + [string]$obj.status + "]") | Out-Null
        if($LASTEXITCODE -ne 0){ throw "result commit failed" }
        git pull --rebase origin main --quiet
        if($LASTEXITCODE -ne 0){ throw "result rebase failed" }
        git push origin HEAD:main --quiet
        if($LASTEXITCODE -eq 0){ return }
        throw "result push failed"
      } finally { Pop-Location }
    } catch {
      try { Push-Location $Bridge; git rebase --abort 2>$null; Pop-Location } catch {}
      Start-Sleep -Seconds (2*$attempt)
    }
  }
  Say ("WARN result publish failed for " + $rid)
}
function ReadJob([string]$path){
  try {
    $c=Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $c.request_id -or -not $c.action){ return $null }
    if(([string]$c.action) -notlike "autodirector_*"){ return $null }
    return $c
  } catch { return $null }
}
function ResultExists([string]$rid){
  return Test-Path (Join-Path (Join-Path $Bridge $ResultRelDir) ((SafeId $rid)+".json"))
}
function NextJob {
  $jobs=Join-Path $Bridge $JobsRelDir
  if(-not (Test-Path $jobs)){ return $null }
  foreach($j in (Get-ChildItem $jobs -Filter "*.json" -File -ErrorAction SilentlyContinue | Sort-Object Name)){
    $c=ReadJob $j.FullName
    if(-not $c){ continue }
    $rid=SafeId([string]$c.request_id)
    if(ResultExists $rid){ continue }
    if(Test-Path (Join-Path $StateDir ($rid+".done"))){ continue }
    if(Test-Path (Join-Path $StateDir ($rid+".running"))){ continue }
    return $c
  }
  return $null
}
function ReadStatusPayload {
  $pkg=ReadJsonSafe (Join-Path $Project "package.json")
  $h=HarnessInfo
  return [ordered]@{
    version=if($pkg){$pkg.version}else{$null}
    git=GitInfo $Project
    harness=$h
    webchat_fallback=ReadJsonSafe (Join-Path $Project ".harness\WEBCHAT_FALLBACK.json")
    webchat_todo=ReadTextBounded (Join-Path $Project "WEBCHAT_TODO.md") 120000
    next_task=ReadTextBounded (Join-Path $Project "NEXT_TASK.md") 120000
    current_state=ReadTextBounded (Join-Path $Project "CURRENT_STATE.md") 120000
  }
}
function InvokeFixedCheck([string]$kind){
  switch($kind){
    "diff-check" { return RunBounded "git.exe" @("diff","--check") 600 }
    "typecheck" { return RunBounded "npm.cmd" @("run","typecheck") 3600 }
    "unit" { return RunBounded "npm.cmd" @("test") 3600 }
    "learning-ux" { return RunBounded "npm.cmd" @("run","verify:learning-ux") 3600 }
    "build" { return RunBounded "npm.cmd" @("run","build") 3600 }
    "package" { return RunBounded "npm.cmd" @("run","pack:editor") 5400 }
    "packaged-ui" { return RunBounded "npm.cmd" @("run","verify:packaged-ui") 5400 }
    default { throw "unsupported check kind: $kind" }
  }
}

if(-not (Get-Command gh.exe -ErrorAction SilentlyContinue)){ throw "gh.exe not found" }
gh auth status *> $null
if($LASTEXITCODE -ne 0){ throw "gh auth is not ready" }
if(-not (Test-Path $Project)){ throw "AutoDirector project missing: $Project" }
if(-not (Test-Path (Join-Path $Project ".git"))){ throw "AutoDirector git repo missing: $Project" }
if(-not (Test-Path (Join-Path $Bridge ".git"))){
  if(Test-Path $Bridge){ Remove-Item $Bridge -Recurse -Force }
  gh repo clone $Repo $Bridge
  if($LASTEXITCODE -ne 0){ throw "AutoDirector bridge clone failed" }
}
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
Get-ChildItem $StateDir -Filter "*.running" -File -ErrorAction SilentlyContinue | Where-Object { ((Get-Date)-$_.LastWriteTime).TotalMinutes -gt 120 } | Remove-Item -Force -ErrorAction SilentlyContinue
Say "READY"
Say ("project="+$Project)
Say ("jobs="+$JobsRelDir)

while($true){
  try {
    RefreshBridge
    $cmd=NextJob
    if(-not $cmd){ Start-Sleep -Seconds 8; continue }
    $rid=SafeId([string]$cmd.request_id)
    $running=Join-Path $StateDir ($rid+".running")
    $done=Join-Path $StateDir ($rid+".done")
    $projectLock=Join-Path $StateDir "project.running"
    if(Test-Path $projectLock){ Start-Sleep -Seconds 8; continue }
    Set-Content $running "1" -Encoding ASCII
    Set-Content $projectLock $rid -Encoding UTF8

    $result=[ordered]@{ request_id=[string]$cmd.request_id; action=[string]$cmd.action; project_id="AUTODIRECTOR"; project=$Project; started_at=(Get-Date).ToString("o"); status="RUNNING" }
    PublishResult $result
    Say ("running "+$rid+" action="+[string]$cmd.action)

    try {
      switch([string]$cmd.action){
        "autodirector_probe" {
          $payload=ReadStatusPayload
          $result.version=$payload.version; $result.git=$payload.git; $result.harness=$payload.harness; $result.status="PASS"
        }
        "autodirector_status" {
          $payload=ReadStatusPayload
          foreach($k in $payload.Keys){ $result[$k]=$payload[$k] }
          $result.status="PASS"
        }
        "autodirector_read" {
          $items=@()
          foreach($req in @($cmd.files)){
            $rel=if($req -is [string]){[string]$req}else{[string]$req.path}
            $full=ProjectPath $rel
            if(-not (Test-Path $full)){ $items += @{path=$rel;missing=$true}; continue }
            $items += @{path=$rel;content=(ReadTextBounded $full 200000)}
          }
          $result.items=$items; $result.git=GitInfo $Project; $result.status="PASS"
        }
        "autodirector_find" {
          $rel=[string]$cmd.path; $needle=[string]$cmd.needle
          if([string]::IsNullOrWhiteSpace($needle)){ throw "empty needle" }
          $full=ProjectPath $rel
          if(-not (Test-Path $full)){ throw "missing file: $rel" }
          $lines=Get-Content $full -Encoding UTF8; $hits=@()
          for($i=0;$i -lt $lines.Count;$i++){
            if($lines[$i].IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0){
              $lo=[Math]::Max(0,$i-2); $hi=[Math]::Min($lines.Count-1,$i+2)
              $hits += @{line=$i+1;context=($lines[$lo..$hi]-join [Environment]::NewLine)}
              if($hits.Count -ge 50){ break }
            }
          }
          $result.hits=$hits; $result.status="PASS"
        }
        "autodirector_patch" {
          AssertNoLiveHarness
          $before=GitInfo $Project; $changes=@()
          foreach($p in @($cmd.patches)){
            $rel=[string]$p.path; $full=AssertTextPath $rel; $mode=[string]$p.mode
            if([string]::IsNullOrWhiteSpace($mode)){ $mode="replace" }
            $text=if(Test-Path $full){[IO.File]::ReadAllText($full)}else{""}
            if($mode -eq "replace"){
              if(-not (Test-Path $full)){ throw "replace target missing: $rel" }
              $search=[string]$p.search; $replace=[string]$p.replace
              if([string]::IsNullOrEmpty($search)){ throw "empty search: $rel" }
              $count=([regex]::Matches($text,[regex]::Escape($search))).Count
              $expected=if($null -ne $p.expected_count){[int]$p.expected_count}else{1}
              if($count -ne $expected){ throw "replace count mismatch $rel expected=$expected actual=$count" }
              WriteUtf8NoBom $full ($text.Replace($search,$replace))
              $changes += @{path=$rel;mode=$mode;count=$count}
            } elseif($mode -eq "append"){
              $add=[string]$p.content
              if($add.Length -gt 200000){ throw "append content too large: $rel" }
              $marker=[string]$p.marker
              if($marker -and $text.Contains($marker)){ $changes += @{path=$rel;mode=$mode;status="already-present"} }
              else { WriteUtf8NoBom $full ($text+$add); $changes += @{path=$rel;mode=$mode;status="appended"} }
            } elseif($mode -eq "write"){
              if(-not [bool]$p.allow_create -and -not (Test-Path $full)){ throw "write target missing and allow_create not set: $rel" }
              $content=[string]$p.content
              if($content.Length -gt 200000){ throw "write content too large: $rel" }
              WriteUtf8NoBom $full $content
              $changes += @{path=$rel;mode=$mode;status="written"}
            } else { throw "unsupported patch mode: $mode" }
          }
          $result.before_git=$before; $result.changes=$changes; $result.after_git=GitInfo $Project; $result.status="PASS"
        }
        "autodirector_verify" {
          $checks=if($cmd.checks){@($cmd.checks)}else{@("diff-check","typecheck")}
          $verify=[ordered]@{}; $ok=$true
          foreach($kindObj in $checks){
            $kind=[string]$kindObj; $r=InvokeFixedCheck $kind
            $verify[$kind]=$r
            if($r.exit -ne 0){$ok=$false}
          }
          $result.verify=$verify; $result.git=GitInfo $Project; $result.status=if($ok){"PASS"}else{"FAIL"}
        }
        "autodirector_test" {
          $kind=[string]$cmd.kind
          if($kind -notin @("diff-check","typecheck","unit","learning-ux")){ throw "unsupported test kind: $kind" }
          $r=InvokeFixedCheck $kind; $result.kind=$kind; $result.run=$r; $result.git=GitInfo $Project; $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}
        }
        "autodirector_build" {
          $r=InvokeFixedCheck "build"; $result.run=$r; $result.git=GitInfo $Project; $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}
        }
        "autodirector_package" {
          $r=InvokeFixedCheck "package"; $result.run=$r; $result.git=GitInfo $Project; $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}
        }
        "autodirector_packaged_ui" {
          $r=InvokeFixedCheck "packaged-ui"; $result.run=$r; $result.git=GitInfo $Project; $result.status=if($r.exit -eq 0){"PASS"}else{"FAIL"}
        }
        "autodirector_harness_stop" {
          $dir=Join-Path $Project ".harness"; New-Item -ItemType Directory -Path $dir -Force | Out-Null
          $stop=Join-Path $dir "STOP"
          WriteUtf8NoBom $stop ("requested_by=KHS_REMOTE`nrequest_id="+[string]$cmd.request_id+"`ncreated_at="+(Get-Date).ToString("o")+"`n")
          $result.harness=HarnessInfo; $result.status="PASS"
        }
        "autodirector_harness_resume" {
          $stop=Join-Path $Project ".harness\STOP"
          if(Test-Path $stop){ Remove-Item $stop -Force }
          $result.note="STOP sentinel cleared. Existing watchdog/start mechanism may resume the harness; no arbitrary shell command was executed."
          $result.harness=HarnessInfo; $result.status="PASS"
        }
        default { throw "unsupported AutoDirector bridge action: $($cmd.action)" }
      }
    } catch {
      $result.status="FAIL"; $result.error=$_.Exception.Message
      try{$result.git_after=GitInfo $Project}catch{}
    }

    $result.finished_at=(Get-Date).ToString("o")
    PublishResult $result
    Remove-Item $running -Force -ErrorAction SilentlyContinue
    Remove-Item $projectLock -Force -ErrorAction SilentlyContinue
    Set-Content $done "1" -Encoding ASCII
    Say ("finished "+$rid+" => "+$result.status)
  } catch {
    Say ("ERROR: "+$_.Exception.Message)
    try{ Remove-Item (Join-Path $StateDir "project.running") -Force -ErrorAction SilentlyContinue }catch{}
  }
  Start-Sleep -Seconds 8
}

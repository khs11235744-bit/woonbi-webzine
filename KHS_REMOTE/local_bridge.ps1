$ErrorActionPreference = "Stop"

$Repo = "khs11235744-bit/-"
$Bridge = Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
$Project = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$StateDir = Join-Path $env:USERPROFILE "KHS_REMOTE_STATE"
$ResultRelDir = "KHS_REMOTE/results"

function Say($m){ Write-Host ("[KHS-BRIDGE v3] " + $m) }
function SafeId([string]$s){ return ($s -replace '[^A-Za-z0-9_.-]','_') }

function GitInfo([string]$root){
  Push-Location $root
  try {
    return @{
      head=((& git rev-parse HEAD 2>$null | Out-String).Trim())
      branch=((& git branch --show-current 2>$null | Out-String).Trim())
      status=@(& git status --porcelain 2>$null)
      stash=@(& git stash list 2>$null)
    }
  } finally { Pop-Location }
}

function ProjectPath([string]$rel){
  if([string]::IsNullOrWhiteSpace($rel)){ throw "empty relative path" }
  if([IO.Path]::IsPathRooted($rel)){ throw "absolute path rejected: $rel" }
  $root=[IO.Path]::GetFullPath($Project).TrimEnd('\') + '\'
  $full=[IO.Path]::GetFullPath((Join-Path $Project $rel))
  if(-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){ throw "path escapes project: $rel" }
  return $full
}

function WriteUtf8NoBom([string]$path,[string]$text){
  $parent=Split-Path $path -Parent
  if($parent){ New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  [IO.File]::WriteAllText($path,$text,(New-Object Text.UTF8Encoding($false)))
}

function PublishResult($obj){
  $rid=SafeId([string]$obj.request_id)
  if(-not $rid){ return }
  $json=($obj | ConvertTo-Json -Depth 30)
  for($attempt=1;$attempt -le 4;$attempt++){
    try{
      Push-Location $Bridge
      try{
        git fetch origin main --quiet
        git reset --hard origin/main --quiet
        $dir=Join-Path $Bridge $ResultRelDir
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $per=Join-Path $dir ($rid + ".json")
        $latest=Join-Path $dir "latest-indieplus.json"
        WriteUtf8NoBom $per $json
        WriteUtf8NoBom $latest $json
        git config user.name "KHS Local Bridge"
        git config user.email "khs-local-bridge@users.noreply.github.com"
        git add $per $latest
        if(git diff --cached --quiet){ return }
        git commit -m ("KHS_RESULT: " + $rid + " [" + [string]$obj.status + "]") | Out-Null
        git pull --rebase origin main
        if($LASTEXITCODE -ne 0){ throw "result rebase failed" }
        git push origin HEAD:main
        if($LASTEXITCODE -eq 0){ return }
      } finally { Pop-Location }
    } catch {
      try{
        Push-Location $Bridge
        git rebase --abort 2>$null
        Pop-Location
      }catch{}
      Start-Sleep -Seconds (2*$attempt)
    }
  }
  Say ("WARN result publish failed for " + $rid)
}

function ReadCommandFile([string]$path){
  try{
    $c=Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $c.request_id -or -not $c.action){ return $null }
    if(([string]$c.action) -notlike "indieplus_*"){ return $null }
    return $c
  }catch{ return $null }
}

function NextCommand(){
  $all=@()
  $cmdPath=Join-Path $Bridge "KHS_REMOTE\command.json"
  if(Test-Path $cmdPath){
    $c=ReadCommandFile $cmdPath
    if($c){ $all += [pscustomobject]@{ cmd=$c; source=$cmdPath; order="000-command" } }
  }
  $jobs=Join-Path $Bridge "KHS_REMOTE\jobs"
  if(Test-Path $jobs){
    foreach($j in Get-ChildItem $jobs -Filter "*.json" -File -ErrorAction SilentlyContinue){
      $c=ReadCommandFile $j.FullName
      if($c){ $all += [pscustomobject]@{ cmd=$c; source=$j.FullName; order=$j.Name } }
    }
  }
  foreach($x in ($all | Sort-Object order)){
    $rid=SafeId([string]$x.cmd.request_id)
    if(-not (Test-Path (Join-Path $StateDir ($rid + ".done"))) -and
       -not (Test-Path (Join-Path $StateDir ($rid + ".running")))){
      return $x.cmd
    }
  }
  return $null
}

function RequireCleanProject($cmd){
  $lock=Join-Path $Project ".harness.lock"
  if(Test-Path $lock){ throw "HARNESS_LOCK" }
  Push-Location $Project
  try{
    $dirty=@(git status --porcelain)
    if($dirty.Count -gt 0){
      if([bool]$cmd.allow_known_stash){
        $known=@("sw.js","editorial-v19.css","features-v19.js") | Sort-Object
        $paths=@($dirty | ForEach-Object {
          $line=[string]$_
          if($line.Length -ge 4){$line.Substring(3).Trim()}else{$line.Trim()}
        } | Sort-Object)
        $ok=($paths.Count -eq $known.Count -and (Compare-Object $known $paths).Count -eq 0)
        if($ok){
          git stash push -u -m "assistant-v19-incomplete-before-bridge-v3" | Out-Null
          if($LASTEXITCODE -ne 0){ throw "known stash failed" }
          $dirty=@(git status --porcelain)
        }
      }
    }
    if($dirty.Count -gt 0){ throw ("DIRTY_WORKTREE: " + ($dirty -join " | ")) }
    git pull --ff-only
    if($LASTEXITCODE -ne 0){ throw "git pull --ff-only failed" }
  } finally { Pop-Location }
}

function RunNodeCheck([string]$rel){
  $full=ProjectPath $rel
  if(-not (Test-Path $full)){ throw "missing JS: $rel" }
  Push-Location $Project
  try{
    & node --check $rel
    if($LASTEXITCODE -ne 0){ throw "node --check failed: $rel" }
  } finally { Pop-Location }
}

function RunProbe(){
  $server=$null;$browser=$null
  try{
    $python=(Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if(-not $python){ $python=(Get-Command python -ErrorAction SilentlyContinue).Source }
    if(-not $python){ throw "python not found for probe server" }

    $pf86=[Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    $chromeCandidates=@(
      (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
      $(if($pf86){Join-Path $pf86 "Google\Chrome\Application\chrome.exe"}else{$null}),
      (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
      $(if($pf86){Join-Path $pf86 "Microsoft\Edge\Application\msedge.exe"}else{$null})
    )
    $chrome=$chromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if(-not $chrome){ throw "Chrome/Edge not found" }

    $server=Start-Process -FilePath $python -ArgumentList "-m","http.server","8910","--bind","127.0.0.1" -WorkingDirectory $Project -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 2

    $profile=Join-Path $env:TEMP ("khs-chrome-" + [guid]::NewGuid().ToString("N"))
    $browser=Start-Process -FilePath $chrome -ArgumentList "--headless=new","--remote-debugging-port=9233","--user-data-dir=$profile","http://127.0.0.1:8910/" -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 4

    Push-Location $Project
    try{
      $probeOut=(& node scripts/probe_v18.mjs 2>&1 | Out-String).Trim()
      if($LASTEXITCODE -ne 0){ throw ("probe_v18 failed: " + $probeOut) }
    } finally { Pop-Location }
    return $probeOut
  } finally {
    if($browser -and -not $browser.HasExited){ Stop-Process -Id $browser.Id -Force -ErrorAction SilentlyContinue }
    if($server -and -not $server.HasExited){ Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  }
}


function Invoke-IndiePython([string]$script){
  Push-Location $Project
  try {
    $out = (& python $script 2>&1 | Out-String).Trim()
    $code = $LASTEXITCODE
    if($code -ne 0){ throw ("python failed " + $script + " :: " + $out) }
    return $out
  } finally { Pop-Location }
}

function Invoke-IndieSync {
  $oldSkip=$env:INDIP_SKIP_FUNCTIONS_BOOTSTRAP
  $env:INDIP_SKIP_FUNCTIONS_BOOTSTRAP="1"
  try {
    $sync=[ordered]@{}
    $sync.dtryx = Invoke-IndiePython "scripts/sync_dtryx.py"
    $sync.news = Invoke-IndiePython "scripts/sync_news.py"
    $sync.news_weekly = Invoke-IndiePython "scripts/build_news_weekly.py"
    return $sync
  } finally {
    $env:INDIP_SKIP_FUNCTIONS_BOOTSTRAP=$oldSkip
  }
}

function Invoke-IndieTest {
  Push-Location $Project
  try {
    foreach($j in Get-ChildItem (Join-Path $Project "data") -Filter "*.json" -File){
      Get-Content $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
    }
    $js=@("app.js","features-v04.js","features-v05.js","features-v06.js","features-v07.js","features-v08.js","features-v17.js","features-v19.js","features-v20.js","features-v21.js","features-v22.js","sw.js")
    foreach($x in $js){
      if(Test-Path (Join-Path $Project $x)){ RunNodeCheck $x }
    }
    git diff --check
    if($LASTEXITCODE -ne 0){ throw "git diff --check failed" }
    return @{ ok=$true; git=(GitInfo $Project) }
  } finally { Pop-Location }
}

function Invoke-IndieDeploy([bool]$includeFunctions=$true){
  Push-Location $Project
  try {
    if($includeFunctions){
      $python=(Get-Command python.exe -ErrorAction SilentlyContinue).Source
      if(-not $python){$python=(Get-Command python -ErrorAction SilentlyContinue).Source}
      if(-not $python){throw "python not found"}
      $venvPy=Join-Path $Project "functions\venv\Scripts\python.exe"
      if(-not (Test-Path $venvPy)){
        & $python -m venv "functions\venv"
        if($LASTEXITCODE -ne 0){throw "functions venv create failed"}
      }
      & $venvPy -m pip install -r "functions\requirements.txt"
      if($LASTEXITCODE -ne 0){throw "functions requirements install failed"}
      & $venvPy -c "import firebase_functions, firebase_admin; print('PYTHON_FUNCTIONS_READY')"
      if($LASTEXITCODE -ne 0){throw "functions import check failed"}
    }
    $firebase=(Get-Command firebase.cmd -ErrorAction SilentlyContinue).Source
    if(-not $firebase){ $firebase=(Join-Path $env:APPDATA "npm\firebase.cmd") }
    if(-not (Test-Path $firebase)){ throw "firebase.cmd not found" }
    $oldNodeOptions=$env:NODE_OPTIONS
    $oldDiscovery=$env:FUNCTIONS_DISCOVERY_TIMEOUT
    $env:NODE_OPTIONS="--no-deprecation"
    $env:FUNCTIONS_DISCOVERY_TIMEOUT="90"
    try{
      $only = if($includeFunctions){"functions"}else{"firestore:rules,hosting"}
      $out = (& $firebase deploy --project indieplus-pohang-khs --only $only --non-interactive 2>&1 | Out-String).Trim()
      $code=$LASTEXITCODE
      if($code -ne 0){ throw ("firebase deploy failed :: " + $out) }
      return $out
    } finally {
      $env:NODE_OPTIONS=$oldNodeOptions
      $env:FUNCTIONS_DISCOVERY_TIMEOUT=$oldDiscovery
    }
  } finally { Pop-Location }
}

if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) { throw "gh.exe not found" }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "gh auth is not ready" }
if (-not (Test-Path $Project)) { throw "project missing: $Project" }

$codex=(Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
if(-not $codex){
  $candidate=Join-Path $env:APPDATA "npm\codex.cmd"
  if(Test-Path $candidate){$codex=$candidate}
}

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
Get-ChildItem $StateDir -Filter "*.running" -File -ErrorAction SilentlyContinue | Where-Object {
  ((Get-Date) - $_.LastWriteTime).TotalMinutes -gt 30
} | Remove-Item -Force -ErrorAction SilentlyContinue
Say "READY v3"
Say "project=$Project"
Say ("codex=" + $(if($codex){$codex}else{"NOT_FOUND"}))
Say "polling command.json + KHS_REMOTE/jobs every 6 seconds"

while($true){
  try{
    Push-Location $Bridge
    try{
      git fetch origin main --quiet
      git reset --hard origin/main --quiet
    } finally { Pop-Location }

    $cmd=NextCommand
    if(-not $cmd){ Start-Sleep 6; continue }

    $rid=SafeId([string]$cmd.request_id)
    $running=Join-Path $StateDir ($rid+".running")
    $done=Join-Path $StateDir ($rid+".done")
    Set-Content $running "1" -Encoding ASCII

    $result=[ordered]@{
      request_id=[string]$cmd.request_id
      action=[string]$cmd.action
      started_at=(Get-Date).ToString("o")
      status="RUNNING"
      project=$Project
    }
    PublishResult $result
    Say ("running " + $rid + " action=" + [string]$cmd.action)

    try{
      switch([string]$cmd.action){
        "indieplus_status" {
          $result.git=GitInfo $Project
          $lock=Join-Path $Project ".harness.lock"
          $result.lock_present=Test-Path $lock
          $result.lock_content=if(Test-Path $lock){Get-Content $lock -Raw}else{$null}
          $result.status="PASS"
        }
        "indieplus_read" {
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          $items=@()
          foreach($req in @($cmd.files)){
            $rel=[string]$req.path
            $full=ProjectPath $rel
            if(-not (Test-Path $full)){ $items += @{path=$rel;missing=$true}; continue }
            $lines=Get-Content $full -Encoding UTF8
            $start=if($null -ne $req.start_line){[Math]::Max(1,[int]$req.start_line)}else{1}
            $end=if($null -ne $req.end_line){[Math]::Min($lines.Count,[int]$req.end_line)}else{[Math]::Min($lines.Count,$start+399)}
            $slice=if($lines.Count -gt 0 -and $start -le $end){$lines[($start-1)..($end-1)] -join [Environment]::NewLine}else{""}
            if($slice.Length -gt 120000){$slice=$slice.Substring(0,120000)}
            $items += @{path=$rel;start_line=$start;end_line=$end;content=$slice}
          }
          $result.items=$items
          $result.status="PASS"
        }
        "indieplus_find" {
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          $rel=[string]$cmd.path
          $needle=[string]$cmd.needle
          if([string]::IsNullOrWhiteSpace($needle)){throw "empty needle"}
          $full=ProjectPath $rel
          if(-not (Test-Path $full)){throw "missing file: $rel"}
          $lines=Get-Content $full -Encoding UTF8
          $hits=@()
          for($i=0;$i -lt $lines.Count;$i++){
            if($lines[$i].IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0){
              $lo=[Math]::Max(0,$i-2);$hi=[Math]::Min($lines.Count-1,$i+2)
              $hits += @{line=$i+1;context=($lines[$lo..$hi] -join [Environment]::NewLine)}
              if($hits.Count -ge 50){break}
            }
          }
          $result.hits=$hits
          $result.status="PASS"
        }
        "indieplus_patch" {
          RequireCleanProject $cmd
          $changes=@()
          foreach($p in @($cmd.patches)){
            $rel=[string]$p.path
            $full=ProjectPath $rel
            $mode=[string]$p.mode
            if(-not $mode){$mode="replace"}
            $text=if(Test-Path $full){[IO.File]::ReadAllText($full)}else{""}
            if($mode -eq "append"){
              $marker=[string]$p.marker
              if($marker -and $text.Contains($marker)){
                $changes += @{path=$rel;status="already-present"}
              }else{
                $add=[string]$p.content
                WriteUtf8NoBom $full ($text + $add)
                $changes += @{path=$rel;status="appended"}
              }
            } elseif($mode -eq "write"){
              WriteUtf8NoBom $full ([string]$p.content)
              $changes += @{path=$rel;status="written"}
            } else {
              if(-not (Test-Path $full)){throw "replace target missing: $rel"}
              $search=[string]$p.search
              $replace=[string]$p.replace
              if([string]::IsNullOrEmpty($search)){throw "empty search: $rel"}
              $count=([regex]::Matches($text,[regex]::Escape($search))).Count
              $expected=if($null -ne $p.expected_count){[int]$p.expected_count}else{1}
              if($count -ne $expected){throw "replace count mismatch $rel expected=$expected actual=$count"}
              WriteUtf8NoBom $full ($text.Replace($search,$replace))
              $changes += @{path=$rel;status="replaced";count=$count}
            }
          }
          $result.changes=$changes
          $result.git_after=GitInfo $Project
          $result.status="PASS"
        }
        "indieplus_verify_commit" {
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          Push-Location $Project
          try{
            foreach($j in Get-ChildItem (Join-Path $Project "data") -Filter "*.json" -File){
              try{ Get-Content $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
              catch{ throw "JSON parse failed: $($j.Name)" }
            }
            $js=@("app.js","features-v04.js","features-v05.js","features-v06.js","features-v07.js","features-v08.js","features-v17.js","sw.js")
            if($cmd.extra_js){$js += @($cmd.extra_js)}
            foreach($x in ($js | Select-Object -Unique)){ RunNodeCheck ([string]$x) }
            git diff --check
            if($LASTEXITCODE -ne 0){throw "git diff --check failed"}
            if([bool]$cmd.run_probe){$result.probe=RunProbe}
            $result.before_commit=GitInfo $Project
            if($cmd.files){
              git add -- @($cmd.files)
            }else{
              git add -u
            }
            if(git diff --cached --quiet){throw "no staged changes"}
            git commit -m ([string]$cmd.commit_message)
            if($LASTEXITCODE -ne 0){throw "git commit failed"}
            $result.commit_sha=((& git rev-parse HEAD | Out-String).Trim())
            if([bool]$cmd.push){
              git push origin HEAD:main
              if($LASTEXITCODE -ne 0){throw "git push failed"}
              $result.pushed=$true
            }
            $result.after_commit=GitInfo $Project
            $result.status="PASS"
          } finally { Pop-Location }
        }
        "indieplus_codex" {
          RequireCleanProject $cmd
          if(-not $codex){throw "codex.cmd not found"}
          $p=[string]$cmd.prompt
          if([string]::IsNullOrWhiteSpace($p)){throw "empty prompt"}
          Push-Location $Project
          try{
            $out=($p | & $codex exec --sandbox workspace-write - 2>&1 | Out-String).Trim()
            $result.codex_exit=$LASTEXITCODE
            if($out.Length -gt 120000){$out=$out.Substring($out.Length-120000)}
            $result.codex_output=$out
            $result.git_after=GitInfo $Project
            if($result.codex_exit -ne 0){
              $lower=$out.ToLowerInvariant()
              if($lower -match "quota|usage limit|rate limit|token|credits|model unavailable|too many requests"){
                $result.fallback_recommended="WEBCHAT_DIRECT"
                throw "CODEX_LIMIT_OR_QUOTA"
              }
              throw "codex exit=$($result.codex_exit)"
            }
            $result.status="PASS"
          } finally { Pop-Location }
        }

        "indieplus_sync" {
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          $result.sync=Invoke-IndieSync
          $result.git_after=GitInfo $Project
          $result.status="PASS"
        }
        "indieplus_test" {
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          $result.test=Invoke-IndieTest
          $result.status="PASS"
        }
        "indieplus_deploy" {
          if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
          $result.deploy=Invoke-IndieDeploy ([bool]$cmd.include_functions)
          $result.status="PASS"
        }
        "indieplus_sync_deploy" {
          if(-not [bool]$cmd.confirm_deploy){throw "confirm_deploy=true required"}
          $lock=Join-Path $Project ".harness.lock"
          if(Test-Path $lock){throw "HARNESS_LOCK"}
          $result.sync=Invoke-IndieSync
          $result.test=Invoke-IndieTest
          $result.deploy=Invoke-IndieDeploy ([bool]$cmd.include_functions)
          $result.git_after=GitInfo $Project
          $result.status="PASS"
        }
        default { throw "unsupported action" }
      }
    } catch {
      $result.status="FAIL"
      $result.error=$_.Exception.Message
      try{$result.git_after=GitInfo $Project}catch{}
    }

    $result.finished_at=(Get-Date).ToString("o")
    PublishResult $result
    Remove-Item $running -Force -ErrorAction SilentlyContinue
    Set-Content $done "1" -Encoding ASCII
    Say ("finished " + $rid + " => " + $result.status)
  } catch {
    Say ("ERROR: " + $_.Exception.Message)
  }
  Start-Sleep 6
}

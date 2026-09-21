$ErrorActionPreference = "Stop"

$Repo = "khs11235744-bit/-"
$Bridge = Join-Path $env:USERPROFILE "KHS_REMOTE_BRIDGE"
$Project = Join-Path $env:USERPROFILE "Documents\indieplus-pohang"
$LastFile = Join-Path $Bridge ".last_request"
$ResultDir = Join-Path $Bridge "KHS_REMOTE\results"

function Say($m){ Write-Host ("[KHS-BRIDGE] " + $m) }

if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) { throw "gh.exe not found" }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "gh auth is not ready" }

$codex = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
if (-not $codex) {
  $c = Join-Path $env:APPDATA "npm\codex.cmd"
  if (Test-Path $c) { $codex = $c }
}
if (-not $codex) { throw "codex.cmd not found" }
if (-not (Test-Path $Project)) { throw "project missing: $Project" }

if (-not (Test-Path (Join-Path $Bridge ".git"))) {
  if (Test-Path $Bridge) { Remove-Item $Bridge -Recurse -Force }
  gh repo clone $Repo $Bridge
  if ($LASTEXITCODE -ne 0) { throw "bridge clone failed" }
}
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null

Say "READY"
Say "project=$Project"
Say "codex=$codex"
Say "polling GitHub every 8 seconds; keep this window open"

while ($true) {
  try {
    Push-Location $Bridge
    try {
      git fetch origin main --quiet
      git reset --hard origin/main --quiet
    } finally { Pop-Location }

    $cmdPath = Join-Path $Bridge "KHS_REMOTE\command.json"
    if (-not (Test-Path $cmdPath)) { Start-Sleep 8; continue }
    $cmd = Get-Content $cmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $rid = [string]$cmd.request_id
    if ([string]::IsNullOrWhiteSpace($rid)) { Start-Sleep 8; continue }

    $last = if (Test-Path $LastFile) { (Get-Content $LastFile -Raw).Trim() } else { "" }
    if ($rid -eq $last) { Start-Sleep 8; continue }

    $result = [ordered]@{
      request_id=$rid; action=[string]$cmd.action; started_at=(Get-Date).ToString("o"); status="FAIL"
    }

    if ([string]$cmd.action -eq "indieplus_status") {
      $lock=Join-Path $Project ".harness.lock"
      Push-Location $Project
      try {
        $result.lock_present=Test-Path $lock
        $result.lock_content=if(Test-Path $lock){Get-Content $lock -Raw}else{$null}
        $result.head=(git rev-parse HEAD | Out-String).Trim()
        $result.branch=(git branch --show-current | Out-String).Trim()
        $result.status_porcelain=@(git status --porcelain)
        $result.status="PASS"
      } finally { Pop-Location }
    }
    elseif ([string]$cmd.action -eq "indieplus_codex") {
      $lock=Join-Path $Project ".harness.lock"
      if(Test-Path $lock){ $result.status="BLOCKED"; $result.reason="HARNESS_LOCK" }
      else {
        Push-Location $Project
        try {
          $dirty=@(git status --porcelain)
          if($dirty.Count -gt 0){
            $knownPaths=@("sw.js","editorial-v19.css","features-v19.js") | Sort-Object
            $dirtyPaths=@($dirty | ForEach-Object {
              $line=[string]$_
              if($line.Length -ge 4){ $line.Substring(3).Trim() } else { $line.Trim() }
            } | Sort-Object)
            $onlyKnown=($dirtyPaths.Count -eq $knownPaths.Count -and (Compare-Object $knownPaths $dirtyPaths).Count -eq 0)
            if($onlyKnown -and [bool]$cmd.allow_known_stash){
              $stashOut=(& git stash push -u -m "assistant-v19-incomplete-before-codex" 2>&1 | Out-String).Trim()
              if($LASTEXITCODE -ne 0){ throw "known assistant stash failed: $stashOut" }
              $result.stashed_known_assistant_changes=$true
              $result.stash_output=$stashOut
              $dirty=@(git status --porcelain)
            }
          }
          if($dirty.Count -gt 0){ $result.status="BLOCKED"; $result.reason="DIRTY_WORKTREE"; $result.dirty=$dirty }
          else {
            git pull --ff-only
            if($LASTEXITCODE -ne 0){ throw "git pull failed" }
            $p=[string]$cmd.prompt
            if([string]::IsNullOrWhiteSpace($p)){ throw "empty prompt" }
            $out=($p | & $codex exec --sandbox workspace-write - 2>&1 | Out-String)
            $exit=$LASTEXITCODE
            if($out.Length -gt 120000){$out=$out.Substring($out.Length-120000)}
            $result.codex_exit=$exit
            $result.codex_output=$out
            $result.head_after=(git rev-parse HEAD | Out-String).Trim()
            $result.status_after=@(git status --porcelain)
            $result.status=if($exit -eq 0){"PASS"}else{"FAIL"}
            if($exit -eq 0 -and [bool]$cmd.push_after){
              git push origin HEAD:main
              $result.push_exit=$LASTEXITCODE
            }
          }
        } finally { Pop-Location }
      }
    }
    else {
      $result.status="BLOCKED"; $result.reason="UNSUPPORTED_ACTION"
    }

    $result.finished_at=(Get-Date).ToString("o")
    $resultFile=Join-Path $ResultDir "latest.json"
    [IO.File]::WriteAllText($resultFile,($result|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
    Set-Content -Path $LastFile -Value $rid -Encoding ASCII

    Push-Location $Bridge
    try {
      git add KHS_REMOTE/results/latest.json
      if(-not (git diff --cached --quiet)){
        git config user.name "KHS Local Bridge"
        git config user.email "khs-local-bridge@users.noreply.github.com"
        git commit -m "KHS_RESULT: $rid" | Out-Null
        git pull --rebase origin main
        git push origin HEAD:main
      }
    } finally { Pop-Location }
    Say ("finished " + $rid + " => " + $result.status)
  }
  catch {
    Say ("ERROR: " + $_.Exception.Message)
  }
  Start-Sleep 8
}

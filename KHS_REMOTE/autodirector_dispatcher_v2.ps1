param([string]$CmdPath)
$ErrorActionPreference = "Stop"
$Auto = Join-Path $env:USERPROFILE "Documents\ChatGPT\동영상편집기 만들기"
$ResultDir = Join-Path $env:GITHUB_WORKSPACE "KHS_REMOTE\autodirector_results"
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null
function StopPresent { Test-Path (Join-Path $Auto ".harness\STOP") }
function RunProc([string]$File,[string[]]$Args,[string]$InputText="",[int]$TimeoutSec=3600){
  $psi=New-Object Diagnostics.ProcessStartInfo; $psi.FileName=$File; $psi.WorkingDirectory=$Auto; $psi.UseShellExecute=$false; $psi.RedirectStandardOutput=$true; $psi.RedirectStandardError=$true; $psi.RedirectStandardInput=$true
  foreach($a in $Args){[void]$psi.ArgumentList.Add($a)}
  $p=New-Object Diagnostics.Process; $p.StartInfo=$psi; [void]$p.Start(); if($InputText){$p.StandardInput.Write($InputText)}; $p.StandardInput.Close(); $o=$p.StandardOutput.ReadToEndAsync(); $e=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit($TimeoutSec*1000)){try{$p.Kill($true)}catch{}; throw "timeout: $File"}; return @{exit=$p.ExitCode;stdout=$o.Result;stderr=$e.Result}
}
function GitHead { (RunProc "git.exe" @("rev-parse","HEAD") "" 30).stdout.Trim() }
if(-not(Test-Path $Auto)){throw "AutoDirector missing"}; $cmd=Get-Content $CmdPath -Raw -Encoding UTF8|ConvertFrom-Json
$result=[ordered]@{request_id=$cmd.request_id;action=$cmd.action;project=$Auto;started_at=(Get-Date).ToString('o');status='FAIL';retryable=$true}
try{
  if(StopPresent){throw 'STOP_PRESENT'}
  switch([string]$cmd.action){
    'autodirector_probe' {$pkg=Get-Content (Join-Path $Auto 'package.json') -Raw|ConvertFrom-Json;$run=$null; if(Test-Path (Join-Path $Auto '.harness\RUNNING.json')){$run=Get-Content (Join-Path $Auto '.harness\RUNNING.json') -Raw|ConvertFrom-Json};$alive=$false;if($run -and $run.pid){$alive=$null-ne(Get-Process -Id ([int]$run.pid) -ErrorAction SilentlyContinue)};$result.version=$pkg.version;$result.head=GitHead;$result.stop_present=$false;$result.running=$run;$result.running_pid_alive=$alive;$result.codex_available=$null-ne(Get-Command codex.cmd -ErrorAction SilentlyContinue);$result.status='PASS';$result.retryable=$false}
    'autodirector_codex' {$gc=Get-Command codex.cmd -ErrorAction SilentlyContinue;$codex=if($gc){$gc.Source}else{$null};if(-not $codex){$cand=Join-Path $env:APPDATA 'npm\codex.cmd';if(Test-Path $cand){$codex=$cand}};if(-not $codex){throw 'codex.cmd not found'};$r=RunProc $codex @('exec','--sandbox','workspace-write','-') ([string]$cmd.prompt) 3600;$result.worker='codex';$result.codex_exit=$r.exit;$result.stdout=$r.stdout;$result.stderr=$r.stderr;$dc=RunProc 'git.exe' @('diff','--check') '' 120;$result.diff_check=@{exit=$dc.exit;output=$dc.stdout+$dc.stderr};$result.head=GitHead;$result.status=if($r.exit-eq 0 -and $dc.exit-eq 0){'NEEDS_VERIFICATION'}else{'FAIL'}}
    'autodirector_test' {$map=@{'diff-check'=@('git.exe',@('diff','--check'));'typecheck'=@('npm.cmd',@('run','typecheck'));'unit'=@('npm.cmd',@('test'));'learning-ux'=@('npm.cmd',@('run','verify:learning-ux'));'verify-editor'=@('npm.cmd',@('run','verify:editor'))};$k=[string]$cmd.kind;if(-not$map.ContainsKey($k)){throw "unsupported test $k"};$spec=$map[$k];$r=RunProc $spec[0] $spec[1] '' 3600;$result.kind=$k;$result.exit=$r.exit;$result.stdout=$r.stdout;$result.stderr=$r.stderr;$result.head=GitHead;$result.status=if($r.exit-eq 0){'PASS'}else{'FAIL'}}
    default {throw "unsupported action: $($cmd.action)"}
  }
}catch{$result.error=$_.Exception.Message;if($result.error-eq'STOP_PRESENT'){$result.status='STOPPED';$result.retryable=$false}}
$result.finished_at=(Get-Date).ToString('o');$json=$result|ConvertTo-Json -Depth 20;$safe=([string]$cmd.request_id)-replace'[^A-Za-z0-9_.-]','_';[IO.File]::WriteAllText((Join-Path $ResultDir ($safe+'.json')),$json,(New-Object Text.UTF8Encoding($false)));[IO.File]::WriteAllText((Join-Path $ResultDir 'latest.json'),$json,(New-Object Text.UTF8Encoding($false)));Write-Host $json

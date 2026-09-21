param([string]$CmdPath)
$ErrorActionPreference='Stop'
$cmd=Get-Content $CmdPath -Raw -Encoding UTF8 | ConvertFrom-Json
if(([string]$cmd.action) -ne 'autodirector_read_nogit'){
  & (Join-Path $PSScriptRoot 'autodirector_dispatcher_v4.ps1') -CmdPath $CmdPath
  exit $LASTEXITCODE
}
$Auto=Join-Path $env:USERPROFILE 'Documents\ChatGPT\동영상편집기 만들기'
$ResultDir=Join-Path $env:GITHUB_WORKSPACE 'KHS_REMOTE\autodirector_results'
New-Item -ItemType Directory -Path $ResultDir -Force | Out-Null
function SafePath([string]$Rel){
  $full=[IO.Path]::GetFullPath((Join-Path $Auto $Rel)); $root=[IO.Path]::GetFullPath($Auto)+[IO.Path]::DirectorySeparatorChar
  if(-not $full.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'path escapes AutoDirector root'}
  $full
}
$result=[ordered]@{request_id=$cmd.request_id;action=$cmd.action;project=$Auto;started_at=(Get-Date).ToString('o');status='FAIL';retryable=$true}
try{
  if(Test-Path(Join-Path $Auto '.harness\STOP')){throw 'STOP_PRESENT'}
  $files=@()
  foreach($rel in @($cmd.paths)){
    $p=SafePath([string]$rel); $content=$null
    if(Test-Path $p){$fi=Get-Item $p;if($fi.Length -le 250000){$content=Get-Content $p -Raw -Encoding UTF8}else{$content='[OMITTED: too large]'}}
    $files+=@{path=[string]$rel;content=$content}
  }
  $run=$null;if(Test-Path(Join-Path $Auto '.harness\RUNNING.json')){$run=Get-Content(Join-Path $Auto '.harness\RUNNING.json')-Raw|ConvertFrom-Json}
  $alive=$false;if($run -and $run.pid){$alive=$null-ne(Get-Process -Id([int]$run.pid)-ErrorAction SilentlyContinue)}
  $result.files=$files;$result.running=$run;$result.running_pid_alive=$alive;$result.status='PASS';$result.retryable=$false
}catch{$result.error=$_.Exception.Message;if($result.error -eq 'STOP_PRESENT'){$result.status='STOPPED';$result.retryable=$false}}
$result.finished_at=(Get-Date).ToString('o')
$json=$result|ConvertTo-Json -Depth 30
$safe=([string]$cmd.request_id)-replace'[^A-Za-z0-9_.-]','_'
[IO.File]::WriteAllText((Join-Path $ResultDir($safe+'.json')),$json,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $ResultDir 'latest.json'),$json,(New-Object Text.UTF8Encoding($false)))
Write-Host $json

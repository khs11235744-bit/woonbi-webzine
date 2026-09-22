param(
  [ValidateSet('normal','advanced','recovery')]
  [string]$Mode = 'normal'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$StateDir = Join-Path $Root '.khs-mcp'
$LogDir = Join-Path $StateDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$ServerPidFile = Join-Path $StateDir 'server.pid'
$TunnelPidFile = Join-Path $StateDir 'tunnel.pid'
$TunnelUrlFile = Join-Path $StateDir 'tunnel-url.txt'
$ServerLog = Join-Path $LogDir 'server.log'
$TunnelLog = Join-Path $LogDir 'tunnel.log'

function Read-PidFile([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  $raw = (Get-Content $Path -Raw).Trim()
  $pidValue = 0
  if ([int]::TryParse($raw, [ref]$pidValue)) { return $pidValue }
  return $null
}

function Test-PidAlive([int]$Id) {
  if (-not $Id) { return $false }
  return $null -ne (Get-Process -Id $Id -ErrorAction SilentlyContinue)
}

function Stop-TrackedProcess([string]$PidFile) {
  $id = Read-PidFile $PidFile
  if ($id -and (Test-PidAlive $id)) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Get-Cloudflared {
  $cmd = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  foreach ($candidate in @(
    (Join-Path $env:ProgramFiles 'cloudflared\cloudflared.exe'),
    $(if ($pf86) { Join-Path $pf86 'cloudflared\cloudflared.exe' } else { $null })
  )) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Ensure-Env {
  if (-not (Test-Path (Join-Path $Root '.env'))) {
    Copy-Item (Join-Path $Root '.env.example') (Join-Path $Root '.env')
  }
}

function Start-Server {
  Ensure-Env
  $existing = Read-PidFile $ServerPidFile
  if ($existing -and (Test-PidAlive $existing)) { return }

  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = '"src\server.mjs"'
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $p.Id | Set-Content $ServerPidFile
  Start-Job -ScriptBlock {
    param($proc,$log)
    while (-not $proc.HasExited) {
      $line = $proc.StandardOutput.ReadLine()
      if ($null -ne $line) { Add-Content -Path $log -Value $line }
    }
  } -ArgumentList $p,$ServerLog | Out-Null
  Start-Job -ScriptBlock {
    param($proc,$log)
    while (-not $proc.HasExited) {
      $line = $proc.StandardError.ReadLine()
      if ($null -ne $line) { Add-Content -Path $log -Value $line }
    }
  } -ArgumentList $p,$ServerLog | Out-Null
}

function Start-Tunnel {
  $existing = Read-PidFile $TunnelPidFile
  if ($existing -and (Test-PidAlive $existing)) { return }

  $cloudflared = Get-Cloudflared
  if (-not $cloudflared) {
    throw 'cloudflared가 없습니다. winget install --id Cloudflare.cloudflared --exact 로 설치하세요.'
  }

  Remove-Item $TunnelUrlFile -Force -ErrorAction SilentlyContinue
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $cloudflared
  $psi.Arguments = 'tunnel --no-autoupdate --url http://127.0.0.1:8787'
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $p.Id | Set-Content $TunnelPidFile

  Start-Job -ScriptBlock {
    param($proc,$log,$urlFile)
    while (-not $proc.HasExited) {
      $line = $proc.StandardError.ReadLine()
      if ($null -ne $line) {
        Add-Content -Path $log -Value $line
        if ($line -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
          ($Matches[0] + '/mcp') | Set-Content $urlFile
        }
      }
    }
  } -ArgumentList $p,$TunnelLog,$TunnelUrlFile | Out-Null
}

function Stop-All {
  Stop-TrackedProcess $TunnelPidFile
  Stop-TrackedProcess $ServerPidFile
}

function Test-LocalHealth {
  try {
    $r = Invoke-RestMethod -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:8787/health'
    return [bool]$r.ok
  } catch {
    return $false
  }
}

function Get-StateText {
  $server = if (Test-LocalHealth) { '정상' } else { '중지' }
  $tunnelPid = Read-PidFile $TunnelPidFile
  $tunnel = if ($tunnelPid -and (Test-PidAlive $tunnelPid)) { '연결 중' } else { '중지' }
  if (Test-Path $TunnelUrlFile) {
    $url = (Get-Content $TunnelUrlFile -Raw).Trim()
    if ($url) { $tunnel = '정상' }
  }
  return "서버: $server   |   원격 연결: $tunnel   |   모드: $Mode"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'KHS Local Control MCP'
$form.Size = New-Object System.Drawing.Size(610,410)
$form.StartPosition = 'CenterScreen'
$form.MaximizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = 'KHS Local Control MCP'
$title.Font = New-Object System.Drawing.Font('Segoe UI',16,[System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(22,20)
$form.Controls.Add($title)

$status = New-Object System.Windows.Forms.Label
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(24,62)
$form.Controls.Add($status)

$urlBox = New-Object System.Windows.Forms.TextBox
$urlBox.Location = New-Object System.Drawing.Point(24,100)
$urlBox.Size = New-Object System.Drawing.Size(445,25)
$urlBox.ReadOnly = $true
$form.Controls.Add($urlBox)

$copyButton = New-Object System.Windows.Forms.Button
$copyButton.Text = 'URL 복사'
$copyButton.Location = New-Object System.Drawing.Point(480,98)
$copyButton.Size = New-Object System.Drawing.Size(90,28)
$copyButton.Add_Click({
  if ($urlBox.Text) { [System.Windows.Forms.Clipboard]::SetText($urlBox.Text) }
})
$form.Controls.Add($copyButton)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = '모두 시작'
$startButton.Location = New-Object System.Drawing.Point(24,150)
$startButton.Size = New-Object System.Drawing.Size(120,40)
$startButton.Add_Click({
  try {
    Start-Server
    Start-Sleep -Milliseconds 900
    Start-Tunnel
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'시작 실패') | Out-Null
  }
})
$form.Controls.Add($startButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = '모두 중지'
$stopButton.Location = New-Object System.Drawing.Point(154,150)
$stopButton.Size = New-Object System.Drawing.Size(120,40)
$stopButton.Add_Click({ Stop-All })
$form.Controls.Add($stopButton)

$restartButton = New-Object System.Windows.Forms.Button
$restartButton.Text = '복구 재시작'
$restartButton.Location = New-Object System.Drawing.Point(284,150)
$restartButton.Size = New-Object System.Drawing.Size(120,40)
$restartButton.Add_Click({
  Stop-All
  Start-Sleep -Seconds 1
  try { Start-Server; Start-Sleep -Milliseconds 900; Start-Tunnel } catch {}
})
$form.Controls.Add($restartButton)

$settingsButton = New-Object System.Windows.Forms.Button
$settingsButton.Text = '설정 열기'
$settingsButton.Location = New-Object System.Drawing.Point(414,150)
$settingsButton.Size = New-Object System.Drawing.Size(120,40)
$settingsButton.Add_Click({ Ensure-Env; Start-Process notepad.exe (Join-Path $Root '.env') })
$form.Controls.Add($settingsButton)

if ($Mode -ne 'normal') {
  $logsButton = New-Object System.Windows.Forms.Button
  $logsButton.Text = '로그 폴더'
  $logsButton.Location = New-Object System.Drawing.Point(24,210)
  $logsButton.Size = New-Object System.Drawing.Size(120,36)
  $logsButton.Add_Click({ Start-Process explorer.exe $LogDir })
  $form.Controls.Add($logsButton)

  $testButton = New-Object System.Windows.Forms.Button
  $testButton.Text = '연결 진단'
  $testButton.Location = New-Object System.Drawing.Point(154,210)
  $testButton.Size = New-Object System.Drawing.Size(120,36)
  $testButton.Add_Click({
    $local = Test-LocalHealth
    $cf = Get-Cloudflared
    $nl = [Environment]::NewLine
    $msg = "Node: $([bool](Get-Command node.exe -ErrorAction SilentlyContinue))" + $nl +
           "Cloudflared: $([bool]$cf)" + $nl +
           "Local MCP: $local" + $nl
    if (Test-Path $TunnelUrlFile) { $msg += "Tunnel URL: $((Get-Content $TunnelUrlFile -Raw).Trim())" }
    [System.Windows.Forms.MessageBox]::Show($msg,'진단 결과') | Out-Null
  })
  $form.Controls.Add($testButton)
}

if ($Mode -eq 'recovery') {
  $repairButton = New-Object System.Windows.Forms.Button
  $repairButton.Text = 'PID/상태 초기화'
  $repairButton.Location = New-Object System.Drawing.Point(284,210)
  $repairButton.Size = New-Object System.Drawing.Size(140,36)
  $repairButton.Add_Click({
    Stop-All
    Remove-Item $TunnelUrlFile -Force -ErrorAction SilentlyContinue
    [System.Windows.Forms.MessageBox]::Show('복구 상태를 초기화했습니다. 이제 모두 시작을 눌러주세요.','복구') | Out-Null
  })
  $form.Controls.Add($repairButton)
}

$help = New-Object System.Windows.Forms.Label
$help.Location = New-Object System.Drawing.Point(24,280)
$help.Size = New-Object System.Drawing.Size(540,70)
$nl = [Environment]::NewLine
$help.Text = '일반 모드: 시작/중지만 사용합니다.' + $nl +
             '고급 모드: 설정과 진단을 사용할 수 있습니다.' + $nl +
             '복구 모드: 연결 꼬임이나 PID 오류를 초기화합니다.'
$form.Controls.Add($help)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
  $status.Text = Get-StateText
  $urlBox.Text = if (Test-Path $TunnelUrlFile) { (Get-Content $TunnelUrlFile -Raw).Trim() } else { '' }
})
$timer.Start()

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Text = 'KHS Local Control MCP'
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Visible = $true
$tray.Add_DoubleClick({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add('열기')
$openItem.Add_Click({ $form.Show(); $form.Activate() })
$startItem = $menu.Items.Add('모두 시작')
$startItem.Add_Click({ try { Start-Server; Start-Sleep -Milliseconds 900; Start-Tunnel } catch {} })
$stopItem = $menu.Items.Add('모두 중지')
$stopItem.Add_Click({ Stop-All })
$menu.Items.Add('-') | Out-Null
$exitItem = $menu.Items.Add('종료')
$exitItem.Add_Click({ $tray.Visible = $false; $timer.Stop(); $form.Close() })
$tray.ContextMenuStrip = $menu

$form.Add_FormClosing({
  param($sender,$e)
  if ($tray.Visible) {
    $e.Cancel = $true
    $form.Hide()
  }
})

[void]$form.ShowDialog()

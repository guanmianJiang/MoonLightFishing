Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:root = Split-Path -Parent $PSScriptRoot
$script:node = (Get-Command node -ErrorAction Stop).Source
$script:process = $null
$script:installer = $null
$script:phase = 'stopped'
$script:url = $null
$script:outFile = $null
$script:errFile = $null
$script:afterInstall = $false

$form = New-Object System.Windows.Forms.Form
$form.Text = '月隐湾 · 游戏启动器'
$form.ClientSize = New-Object System.Drawing.Size(620, 430)
$form.MinimumSize = New-Object System.Drawing.Size(640, 470)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(20, 43, 49)
$form.ForeColor = [System.Drawing.Color]::FromArgb(236, 248, 245)
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 10)

function Add-Label($text, $x, $y, $w, $h, $size, $color) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $text
  $label.Location = New-Object System.Drawing.Point($x, $y)
  $label.Size = New-Object System.Drawing.Size($w, $h)
  $label.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', $size)
  $label.ForeColor = $color
  $form.Controls.Add($label)
  return $label
}
function Add-Button($text, $x, $width, $handler) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $text
  $button.Location = New-Object System.Drawing.Point($x, 184)
  $button.Size = New-Object System.Drawing.Size($width, 42)
  $button.FlatStyle = 'Flat'
  $button.FlatAppearance.BorderSize = 0
  $button.BackColor = [System.Drawing.Color]::FromArgb(48, 94, 98)
  $button.ForeColor = [System.Drawing.Color]::White
  $button.Add_Click($handler)
  $form.Controls.Add($button)
  return $button
}

$title = Add-Label '月隐湾' 30 22 550 58 26 ([System.Drawing.Color]::White)
$subtitle = Add-Label '本地游戏启动器' 32 78 550 26 10 ([System.Drawing.Color]::FromArgb(166, 210, 204))
$status = Add-Label '●  已停止' 32 124 550 35 16 ([System.Drawing.Color]::FromArgb(180, 204, 201))
$address = Add-Label '游戏尚未启动' 32 156 550 25 9 ([System.Drawing.Color]::FromArgb(180, 204, 201))
$start = Add-Button '启动游戏' 30 110 { Start-Game }
$restart = Add-Button '重启' 150 84 { Stop-Game; Start-Game }
$stop = Add-Button '停止' 244 84 { Stop-Game }
$open = Add-Button '打开游戏' 338 110 { if ($script:url) { Start-Process $script:url } }
$exit = Add-Button '退出' 458 132 { $form.Close() }
$logLabel = Add-Label '运行记录' 32 244 550 25 10 ([System.Drawing.Color]::FromArgb(166, 210, 204))
$logs = New-Object System.Windows.Forms.TextBox
$logs.Location = New-Object System.Drawing.Point(30, 274)
$logs.Size = New-Object System.Drawing.Size(560, 130)
$logs.Multiline = $true
$logs.ReadOnly = $true
$logs.ScrollBars = 'Vertical'
$logs.BackColor = [System.Drawing.Color]::FromArgb(10, 30, 35)
$logs.ForeColor = [System.Drawing.Color]::FromArgb(190, 224, 217)
$logs.Font = New-Object System.Drawing.Font('Consolas', 9)
$logs.Anchor = 'Top,Bottom,Left,Right'
$form.Controls.Add($logs)

function Set-State($phase, $message) {
  $script:phase = $phase
  $status.Text = '●  ' + $message
  $status.ForeColor = switch ($phase) {
    'running' { [System.Drawing.Color]::FromArgb(115, 224, 174) }
    'error' { [System.Drawing.Color]::FromArgb(248, 153, 139) }
    'stopped' { [System.Drawing.Color]::FromArgb(180, 204, 201) }
    default { [System.Drawing.Color]::FromArgb(245, 205, 128) }
  }
  $busy = $phase -in @('starting', 'installing', 'stopping')
  $start.Enabled = -not $busy -and $phase -ne 'running'
  $restart.Enabled = -not $busy -and $phase -eq 'running'
  $stop.Enabled = -not $busy -and $phase -eq 'running'
  $open.Enabled = $phase -eq 'running' -and $null -ne $script:url
  $address.Text = if ($script:url) { $script:url } else { '游戏尚未启动' }
}

function New-LogFiles {
  $script:outFile = [System.IO.Path]::GetTempFileName()
  $script:errFile = [System.IO.Path]::GetTempFileName()
}
function Refresh-Logs {
  $lines = @()
  foreach ($file in @($script:outFile, $script:errFile)) {
    if ($file -and (Test-Path -LiteralPath $file)) {
      try { $lines += @(Get-Content -LiteralPath $file -Tail 35 -Encoding UTF8 -ErrorAction Stop) } catch {}
    }
  }
  $text = ($lines | Select-Object -Last 50) -join [Environment]::NewLine
  if ($logs.Text -ne $text) {
    $logs.Text = $text
    $logs.SelectionStart = $logs.Text.Length
    $logs.ScrollToCaret()
  }
}
function Start-Vite {
  New-LogFiles
  $script:url = $null
  try {
    $script:process = Start-Process -FilePath $script:node -ArgumentList @('node_modules/vite/bin/vite.js', '--config', 'vite.config.js', '--host', '127.0.0.1') -WorkingDirectory $script:root -WindowStyle Hidden -RedirectStandardOutput $script:outFile -RedirectStandardError $script:errFile -PassThru -ErrorAction Stop
    Set-State 'starting' '正在启动游戏…'
  } catch { Set-State 'error' ('启动失败：' + $_.Exception.Message) }
}
function Start-Game {
  if ($script:phase -in @('running', 'starting', 'installing')) { return }
  if (-not (Test-Path -LiteralPath (Join-Path $script:root 'node_modules/vite/bin/vite.js'))) {
    New-LogFiles
    try {
      $script:installer = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/s', '/c', 'npm ci --no-audit --no-fund') -WorkingDirectory $script:root -WindowStyle Hidden -RedirectStandardOutput $script:outFile -RedirectStandardError $script:errFile -PassThru -ErrorAction Stop
      Set-State 'installing' '正在安装游戏依赖…'
    } catch { Set-State 'error' ('安装失败：' + $_.Exception.Message) }
    return
  }
  Start-Vite
}
function Stop-Game {
  if ($script:process) {
    try {
      $script:process.Refresh()
      if (-not $script:process.HasExited) { Stop-Process -Id $script:process.Id -Force -ErrorAction Stop }
    } catch {}
    $script:process = $null
  }
  if ($script:installer) {
    try {
      $script:installer.Refresh()
      if (-not $script:installer.HasExited) { & taskkill.exe /PID $script:installer.Id /T /F 2>$null | Out-Null }
    } catch {}
    $script:installer = $null
  }
  $script:url = $null
  Set-State 'stopped' '已停止'
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500
$timer.Add_Tick({
  Refresh-Logs
  if ($script:installer) {
    $script:installer.Refresh()
    if ($script:installer.HasExited) {
      $code = $script:installer.ExitCode
      $script:installer = $null
      if ($code -eq 0) { Start-Vite } else { Set-State 'error' ("依赖安装失败（代码 $code）") }
    }
  }
  if ($script:process) {
    $script:process.Refresh()
    if ($script:process.HasExited) {
      $code = $script:process.ExitCode
      $script:process = $null
      $script:url = $null
      Set-State 'error' ("游戏服务已退出（代码 $code）")
    } elseif (-not $script:url -and $script:outFile) {
      try {
        $output = (Get-Content -LiteralPath $script:outFile -Raw -Encoding UTF8 -ErrorAction Stop) -replace '\x1b\[[0-9;]*m', ''
        if ($output -match 'Local:\s*(http://(?:127\.0\.0\.1|localhost):\d+/)') {
          $script:url = $matches[1]
          Set-State 'running' '游戏运行中'
        }
      } catch {}
    }
  }
})
$form.Add_FormClosing({ $timer.Stop(); Stop-Game })
$form.Add_Shown({ Start-Game; $timer.Start() })
[void]$form.ShowDialog()

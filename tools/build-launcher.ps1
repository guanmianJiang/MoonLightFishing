$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $PSScriptRoot 'launcher.cs'
$tmp = Join-Path $root 'MoonFishingLauncher.exe'
$out = Join-Path $root '月隐湾启动器.exe'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw '未找到 .NET Framework 编译器 csc.exe' }

# 先编译到 ASCII 临时名，避免 csc.exe 中文参数在控制台代码页下被转成乱码
& $csc /nologo /target:winexe /optimize+ /out:$tmp $src
if ($LASTEXITCODE -ne 0) { throw ('csc 编译失败，退出码 ' + $LASTEXITCODE) }
Start-Sleep -Milliseconds 300
if (-not (Test-Path -LiteralPath $tmp)) { throw ('编译产物未生成：' + $tmp) }

# 用 PowerShell 原生重命名（Unicode 文件名安全）
if (Test-Path -LiteralPath $out) {
  try { Remove-Item -LiteralPath $out -Force -ErrorAction Stop }
  catch { throw '旧启动器仍在运行，请先关闭窗口后重新编译。' }
}
Move-Item -LiteralPath $tmp -Destination $out

Write-Output ("已生成：" + $out)

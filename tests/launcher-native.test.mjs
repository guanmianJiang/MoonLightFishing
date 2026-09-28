import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cs = readFileSync(new URL('../tools/launcher.cs', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../启动游戏.cmd', import.meta.url), 'utf8');

test('double-click entry is a native non-web launcher, no cmd chain', () => {
  // 双击入口直接指向编译产物 exe，不再经过 cmd/ps1 启动链
  assert.ok(entry.includes('月隐湾启动器.exe'));
  assert.ok(!entry.includes('tools/launcher.ps1'));
  assert.ok(!/powershell/i.test(entry));
  // 源码是 WinForms 原生窗口
  assert.ok(cs.includes('System.Windows.Forms'));
  assert.ok(cs.includes('Application.Run'));
});

test('simplified controls: toggle start/stop, open game, exit', () => {
  // 主按钮为「启动游戏/停止游戏」切换，去掉重复的「重启」
  assert.ok(cs.includes('启动游戏'));
  assert.ok(cs.includes('停止游戏'));
  assert.ok(cs.includes('打开游戏'));
  assert.ok(cs.includes('退出'));
  assert.ok(!cs.includes('重启'));
  // 生命周期绑定：关闭窗口时停服
  assert.ok(cs.includes('FormClosing += OnFormClosing'));
  // 整棵进程树清理，避免子进程残留
  assert.ok(cs.includes('taskkill.exe'));
  assert.ok(cs.includes('/T /F'));
});

test('native launcher uses Vite local URL and shows failed/error states', () => {
  // Vite Local 行解析（源码为 C# 逐字字符串）
  assert.ok(cs.includes('Local:'));
  assert.ok(cs.includes('127'));
  assert.ok(cs.includes('localhost'));
  assert.ok(cs.includes('游戏服务已退出'));
  assert.ok(cs.includes('未找到 Node.js，请先安装'));
  // 打开游戏走系统默认浏览器
  assert.ok(cs.includes('psi.UseShellExecute = true'));
  assert.ok(cs.includes('Process.Start(psi)'));
  // 启动器只持有自己创建的进程（重复启动不叠加）
  assert.ok(cs.includes('phase == "running" || phase == "starting" || phase == "installing"'));
});

test('startup state is set before asynchronous output can announce readiness', () => {
  const start = cs.slice(cs.indexOf('private void StartGame()'), cs.indexOf('private void StartInstall('));
  assert.ok(start.indexOf('SetState("starting"') < start.indexOf('gameProcess.BeginOutputReadLine()'));
  assert.ok(start.includes('已收到启动指令'));
  assert.ok(cs.includes('object.ReferenceEquals(sender, gameProcess)'));
});

test('Node fallback also puts npm on PATH when Explorer has an old environment', () => {
  assert.ok(cs.includes('Environment.SpecialFolder.ProgramFiles'));
  assert.ok(cs.includes('Environment.SpecialFolder.LocalApplicationData'));
  assert.ok(cs.includes('psi.EnvironmentVariables["PATH"] = Path.GetDirectoryName(node)'));
});

test('compiled launcher parses split ANSI Vite output and ignores network addresses', {skip: process.platform !== 'win32'}, () => {
  const exe = fileURLToPath(new URL('../月隐湾启动器.exe', import.meta.url)).replaceAll("'", "''");
  const invoke = output => {
    const encoded = Buffer.from(output).toString('base64');
    const command = `$a=[Reflection.Assembly]::LoadFrom('${exe}'); $m=$a.GetType('MoonLauncher.LauncherForm').GetMethod('ParseGameUrl'); $s=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); $v=$m.Invoke($null,@($s)); if($v){Write-Output $v}`;
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {encoding: 'utf8'}).trim();
  };
  assert.equal(invoke('\u001b[32mLocal:\u001b[39m\nhttp://127.0.0.1:5176/'), 'http://127.0.0.1:5176/');
  assert.equal(invoke('Network: http://192.168.1.2:5173/'), '');
});

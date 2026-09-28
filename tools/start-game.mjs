import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function localGameUrl(output) {
  const clean = output.replace(/\u001b\[[\d;]*m/g, '');
  return clean.match(/Local:\s*(http:\/\/(?:127\.0\.0\.1|localhost):\d+\/)/)?.[1] ?? null;
}

export function startGame() {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js');
  const server = spawn(process.execPath, [vite, '--config', 'vite.config.js', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  let output = '';
  let opened = false;
  server.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    output = (output + chunk.toString()).slice(-2048);
    const url = localGameUrl(output);
    if (!opened && url) {
      opened = true;
      console.log(`游戏地址：${url}`);
      const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      browser.on('error', error => console.error(`无法自动打开浏览器，请手动访问 ${url}\n${error.message}`));
      browser.unref();
    }
  });
  server.stderr.on('data', chunk => process.stderr.write(chunk));
  server.on('error', error => {
    console.error(`游戏服务启动失败：${error.message}`);
    process.exitCode = 1;
  });
  server.on('exit', code => {
    if (!opened) console.error('游戏服务未能启动。请查看上方的错误信息。');
    if (code) process.exitCode = code;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startGame();

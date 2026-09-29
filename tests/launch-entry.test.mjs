import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {localGameUrl} from '../tools/start-game.mjs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const guard = html.match(/<script id="launchGuard">([\s\S]*?)<\/script>/)?.[1];
const bootGuard = html.match(/<script id="bootGuard">([\s\S]*?)<\/script>/)?.[1];

test('file URL shows a usable startup instruction before the game module loads', () => {
  assert.ok(guard);
  const title = {textContent: ''};
  const detail = {textContent: ''};
  const button = {hidden: false};
  const panel = {
    hidden: true,
    querySelector(selector) { return {'strong': title, 'p': detail, 'button': button}[selector]; },
  };
  const loading = {hidden: false};
  const document = {querySelector(selector) { return {'#renderError': panel, '#bootStatus': loading}[selector]; }};
  runInNewContext(guard, {location: {protocol: 'file:'}, document});
  assert.equal(panel.hidden, false);
  assert.match(detail.textContent, /月隐湾启动器\.exe/);
  assert.equal(button.hidden, true);
  assert.equal(loading.hidden, true);
});

function bootHarness() {
  assert.ok(bootGuard);
  const title = {textContent: ''}, detail = {textContent: ''}, loading = {hidden: false};
  const panel = {hidden: true, querySelector(selector) { return {strong: title, p: detail}[selector]; }};
  const classes = {removed: null, remove(value) { this.removed = value; }};
  const game = {classList: classes};
  const listeners = {};
  const window = {addEventListener(type, callback) { listeners[type] = callback; }};
  let timeout, cleared = false;
  const document = {querySelector(selector) { return {'#game': game, '#bootStatus': loading, '#renderError': panel}[selector]; }};
  runInNewContext(bootGuard, {location: {protocol: 'http:'}, document, window, setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() { cleared = true; }});
  return {window, panel, title, detail, loading, classes, listeners, get timeout() { return timeout; }, get cleared() { return cleared; }};
}

test('module load failure reports why the blank scene did not start', () => {
  const boot = bootHarness();
  boot.listeners.error({target: {tagName: 'SCRIPT'}});
  assert.equal(boot.panel.hidden, false);
  assert.equal(boot.loading.hidden, true);
  assert.match(boot.detail.textContent, /脚本加载失败/);
});

test('successful game initialization clears loading and timeout', () => {
  const boot = bootHarness();
  boot.window.__moonGameBootComplete();
  boot.timeout();
  assert.equal(boot.classes.removed, 'boot-loading');
  assert.equal(boot.loading.hidden, true);
  assert.equal(boot.panel.hidden, true);
  assert.equal(boot.cleared, true);
});

test('stalled game initialization shows a retryable error', () => {
  const boot = bootHarness();
  boot.timeout();
  assert.equal(boot.panel.hidden, false);
  assert.match(boot.detail.textContent, /15 秒/);
});

test('HTTP launch keeps the normal scene and error state untouched', () => {
  assert.ok(guard);
  runInNewContext(guard, {
    location: {protocol: 'http:'},
    document: {querySelector() { throw Error('HTTP launch must not touch the error panel'); }},
  });
});

test('launcher opens the actual local port chosen by Vite', () => {
  assert.equal(localGameUrl('\u001b[32m  ➜  Local:   http://127.0.0.1:5173/\u001b[0m'), 'http://127.0.0.1:5173/');
  assert.equal(localGameUrl('Port 5173 is in use\n  ➜  Local:   http://127.0.0.1:5174/'), 'http://127.0.0.1:5174/');
  assert.equal(localGameUrl('  ➜  Network: http://192.168.1.2:5173/'), null);
});

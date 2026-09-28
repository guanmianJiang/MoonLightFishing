import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {localGameUrl} from '../tools/start-game.mjs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const guard = html.match(/<script id="launchGuard">([\s\S]*?)<\/script>/)?.[1];

test('file URL shows a usable startup instruction before the game module loads', () => {
  assert.ok(guard);
  const title = {textContent: ''};
  const detail = {textContent: ''};
  const button = {hidden: false};
  const panel = {
    hidden: true,
    querySelector(selector) { return {'strong': title, 'p': detail, 'button': button}[selector]; },
  };
  const document = {querySelector(selector) { assert.equal(selector, '#renderError'); return panel; }};
  runInNewContext(guard, {location: {protocol: 'file:'}, document});
  assert.equal(panel.hidden, false);
  assert.match(detail.textContent, /启动游戏\.cmd/);
  assert.equal(button.hidden, true);
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

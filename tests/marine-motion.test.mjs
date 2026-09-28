import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainY} from '../src/coast.js';
import {sharkPatrol,sharkSwimHeight} from '../src/marine-motion.mjs';

test('shark patrol remains in a fixed offshore world area across aim changes', () => {
  const out = [0, 0, 0, 0];
  const samples = [];
  for (const seconds of [0, 4, 12, 30, 60]) {
    assert.equal(sharkPatrol(seconds, out), out);
    const [x, z, dx, dz] = out;
    assert.ok(x > .7 && x < 7.3);
    assert.ok(z > 24 && z < 28);
    assert.ok(Number.isFinite(dx) && Number.isFinite(dz));
    const y = sharkSwimHeight(terrainY(x, z), seconds);
    assert.ok(y < -.9, {seconds, y});
    assert.ok(y > terrainY(x, z) + .5, {seconds, y});
    samples.push([x, z]);
  }
  assert.notDeepEqual(samples[0], samples[2]);
  const sameTime = sharkPatrol(12);
  assert.deepEqual(sameTime.slice(0, 2), samples[2]);
});

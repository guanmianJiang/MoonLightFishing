import test from 'node:test';
import assert from 'node:assert/strict';
import {fishingUILayout,selectedBaitCopy} from '../src/ui/fishing-ui-state.mjs';
import {BAITS} from '../src/data/catalog.mjs';

test('preparation alone permits expanding a route; aiming stays a separate confirmation', () => {
  assert.deepEqual(fishingUILayout(), {mode:'prepare',canExpandRoute:true});
  assert.deepEqual(fishingUILayout({phase:'idle',aiming:true}), {mode:'aim',canExpandRoute:false});
});

test('every active water stage hides preparation controls, including unknown restored phases', () => {
  for (const phase of ['casting','waiting','approach','reading','responding','nibble','spooked','empty','legacy','idle',undefined]) {
    const result = fishingUILayout({phase,pending:{phase:'cast'},aiming:true});
    assert.deepEqual(result, {mode:'watch',canExpandRoute:false}, `stage ${phase}`);
  }
  assert.deepEqual(fishingUILayout({phase:'hooked',pending:{phase:'cast'}}), {mode:'strike',canExpandRoute:false});
});

test('fighting, landing and result take priority over stale aiming/phase flags', () => {
  assert.equal(fishingUILayout({phase:'hooked',aiming:true,pending:{fight:{status:'active'}}}).mode,'fight');
  assert.equal(fishingUILayout({phase:'fighting',pending:{},revealing:true}).mode,'landing');
  assert.equal(fishingUILayout({phase:'hooked',pending:{phase:'result',fight:{status:'active'}},revealing:true}).mode,'result');
  assert.equal(fishingUILayout({phase:'result',revealing:true}).mode,'result');
});

test('missing state, settled fights and invalid bait IDs fail safely without mutating inputs', () => {
  assert.deepEqual(fishingUILayout(null),fishingUILayout());
  assert.equal(fishingUILayout({phase:'idle',pending:null}).mode,'prepare');
  const pending = Object.freeze({phase:'cast',fight:Object.freeze({status:'won'})});
  assert.equal(fishingUILayout({phase:'hooked',pending}).mode,'strike');
  for (const id of [null,undefined,'','old-bait']) assert.equal(selectedBaitCopy(id).name,BAITS[0].name);
});

test('each selected bait exposes its actual effect instead of a generic decorative label', () => {
  for (const bait of BAITS) {
    assert.deepEqual(selectedBaitCopy(bait.id), {name:bait.name,description:bait.desc,effect:bait.effect});
  }
});

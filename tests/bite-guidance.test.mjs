import test from 'node:test';
import assert from 'node:assert/strict';
import {biteGuidance,biteReadRemaining,BITE_READ_MS} from '../dist/bite-guidance.mjs';
import {signalFor} from '../dist/engine.mjs';

test('each fish signal has a learnable response',()=>{
 for(const [fish,action] of [['perch','tease'],['catfish','shorten'],['oldgold','wait'],['minnow','tease'],['carp','wait']]){
  const signal=signalFor(fish),guide=biteGuidance(signal.id);
  assert.equal(guide.tactic,action);
  assert.ok(guide.seen.length>5);
  assert.ok(guide.action.length>3);
 }
});

test('the reading window gives a short decision and resolves when it runs out',()=>{
 const pending={decisionAt:10_000};
 assert.equal(biteReadRemaining(pending,10_000),BITE_READ_MS);
 assert.equal(biteReadRemaining(pending,10_000+BITE_READ_MS-1),1);
 assert.equal(biteReadRemaining(pending,10_000+BITE_READ_MS),0);
});

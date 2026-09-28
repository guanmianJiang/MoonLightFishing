import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,finishCast,settleEmptyCast} from '../src/engine.mjs';
import {GAME_RULES} from '../src/config/game-rules.mjs';
import {phaseOf} from '../src/fishing-motion.js';

test('new casts reach fish activity within a compact but varied wait',()=>{
 const t=1000,early=makeCast(newSave(),t,()=>0),late=makeCast(newSave(),t,()=>.999);
 assert.equal(early.readyAt-t,GAME_RULES.castWaitBaseMs);
 assert.ok(late.readyAt-t<GAME_RULES.castWaitBaseMs+GAME_RULES.castWaitRandomMs);
 assert.ok(late.readyAt-early.readyAt>3000);
 assert.equal(early.decisionAt,early.readyAt-GAME_RULES.decisionLeadMs);
});

test('an empty cast settles once without a reward or duplicate catch',()=>{
 const save=newSave();save.pending=makeCast(save,1000,()=>.5);save.pending.catch=null;
 const result=settleEmptyCast(save);
 assert.equal(result.text,'本竿为空钩，没有获得样本。');
 assert.equal(save.pending,null);
 assert.equal(save.casts,1);
 assert.equal(save.trip.castsLeft,3);
 assert.equal(save.knowledge,0);
 assert.equal(save.log.length,0);
 assert.equal(settleEmptyCast(save),null);
 assert.equal(save.trip.castsLeft,3);
});

test('restored empty result settles without recording the cast twice',()=>{
 const save=newSave();save.pending=makeCast(save,1000,()=>.5);save.pending.catch=null;
 finishCast(save);
 assert.equal(save.casts,1);
 settleEmptyCast(save);
 assert.equal(save.casts,1);
 assert.equal(save.trip.castsLeft,3);
});

test('caught and already processed casts are not settled again',()=>{
 const save=newSave();save.pending=makeCast(save,1000,()=>.5);
 assert.equal(settleEmptyCast(save),null);
 assert.ok(save.pending.catch);
 save.pending.catch=null;finishCast(save);save.pending.processed='study';save.trip.castsLeft=3;
 const resumed=settleEmptyCast(save);
 assert.equal(resumed.alreadyProcessed,true);
 assert.equal(save.pending,null);
 assert.equal(save.trip.castsLeft,3);
});

test('a restored legacy empty bite cannot remain in the reading phase',()=>{
 const save=newSave();const p=makeCast(save,1000,()=>.5);
 delete p.biteMode;p.catch=null;p.tactic=null;
 assert.equal(phaseOf(p,p.decisionAt),'reading');
 assert.equal(phaseOf(p,p.readyAt),'empty');
});

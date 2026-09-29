import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,migrateSave,expireHookWindow,finishCast} from '../src/engine.mjs';
import {phaseOf} from '../src/fishing-motion.js';
import {fightControlMode} from '../src/fight-control.mjs';
import {isObjectCatch} from '../src/catch-kind.mjs';

function castWith(id){
 const save=newSave(),pending=save.pending=makeCast(save,1000,()=>.5);
 pending.catch.id=id;
 return {save,pending};
}

test('catalog object catches wait quietly, then offer a direct retrieval',()=>{
 for(const id of ['bottle','bell']){
  const {save,pending}=castWith(id);
  assert.equal(isObjectCatch(pending.catch),true);
  assert.equal(phaseOf(pending,pending.readyAt-1),'waiting');
  assert.equal(phaseOf(pending,pending.readyAt),'hooked');
  assert.equal(fightControlMode(pending,pending.readyAt),'retrieve');
  assert.equal(expireHookWindow(save,pending.readyAt+60_000),false);
  assert.equal(pending.catch.id,id);
  assert.equal(fightControlMode(pending,pending.readyAt+60_000),'retrieve');
  assert.equal(fightControlMode(pending,pending.readyAt,true),'hidden');
 }
});

test('a fish still has bite cues, a timed hook, and a fight control',()=>{
 const {save,pending}=castWith('carp');
 assert.equal(isObjectCatch(pending.catch),false);
 assert.equal(phaseOf(pending,pending.decisionAt),'reading');
 assert.equal(fightControlMode(pending,pending.readyAt),'strike');
 assert.equal(expireHookWindow(save,pending.readyAt+pending.biteWindowMs),true);
 assert.equal(fightControlMode(pending,pending.readyAt+pending.biteWindowMs),'hidden');
 assert.equal(isObjectCatch({id:'unknown'}),false);
 assert.equal(isObjectCatch(null),false);
});

test('old object fight state is discarded without losing or duplicating the catch',()=>{
 const {save,pending}=castWith('bottle');
 pending.fight={status:'active',distance:4};
 pending.landedFromFight=true;
 pending.catch.fightReport={grade:'A'};
 migrateSave(save);
 assert.equal(pending.fight,null);
 assert.equal(pending.landedFromFight,false);
 assert.equal(pending.catch.fightReport,undefined);
 assert.equal(pending.catch.id,'bottle');
 assert.equal(fightControlMode(pending,pending.readyAt),'retrieve');
 assert.equal(finishCast(save),true);
 assert.equal(finishCast(save),false);
 assert.equal(save.log.length,1);
});

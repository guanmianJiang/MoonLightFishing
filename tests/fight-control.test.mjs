import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,expireHookWindow} from '../src/engine.mjs';
import {fightControlMode} from '../src/fight-control.mjs';

test('the same control changes from strike to reel without another bite action',()=>{
 const save=newSave(),pending=save.pending=makeCast(save,1000,()=>.5);
 assert.equal(fightControlMode(pending,pending.readyAt-1),'hidden');
 assert.equal(fightControlMode(pending,pending.readyAt),'strike');
 pending.fight={status:'active'};
 assert.equal(fightControlMode(pending,pending.readyAt+500),'reel');
 assert.equal(fightControlMode(pending,pending.readyAt+500,true),'hidden');
});

test('empty, expired and settled casts cannot show the strike surface',()=>{
 const save=newSave(),pending=save.pending=makeCast(save,1000,()=>.5);
 assert.equal(fightControlMode(null,pending.readyAt),'hidden');
 assert.equal(expireHookWindow(save,pending.readyAt+pending.biteWindowMs),true);
 assert.equal(fightControlMode(pending,pending.readyAt+pending.biteWindowMs),'hidden');
 pending.fight={status:'won'};
 assert.equal(fightControlMode(pending,pending.readyAt+pending.biteWindowMs),'hidden');
 pending.phase='result';
 assert.equal(fightControlMode(pending,pending.readyAt),'hidden');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,expireHookWindow} from '../src/engine.mjs';
import {canTeaseBait,teaseBait,lureTeaseMotion,LURE_TEASE} from '../src/lure-tease.mjs';
import {fishMouthApproach} from '../src/bait-engagement.mjs';

test('one optional touch gives the live cast a little more hook time',()=>{
 const save=newSave(),pending=save.pending=makeCast(save,1000,()=>.5);
 const original=pending.biteWindowMs,now=pending.decisionAt;
 assert.equal(canTeaseBait(pending,'approach',now-1000),true);
 assert.equal(canTeaseBait(pending,'reading',now),true);
 const early={...pending};
 assert.equal(teaseBait(early,'approach',now-1000),true);
 assert.equal(early.readyAt,pending.readyAt);
 assert.equal(teaseBait(early,'reading',now),false);
 assert.equal(teaseBait(pending,'reading',now),true);
 assert.equal(pending.teaseAt,now);
 assert.equal(pending.teaseCount,1);
 assert.equal(pending.biteWindowMs,original+LURE_TEASE.biteBonusMs);
 assert.equal(teaseBait(pending,'reading',now+100),false);
 assert.equal(pending.biteWindowMs,original+LURE_TEASE.biteBonusMs);
 assert.equal(expireHookWindow(save,pending.readyAt+original),false);
 assert.equal(expireHookWindow(save,pending.readyAt+pending.biteWindowMs),true);
});

test('only a live natural approach or reading phase accepts a lure lift',()=>{
 const pending={phase:'cast',biteMode:'natural',catch:{id:'carp'},readyAt:5000,biteWindowMs:9500};
 for(const phase of ['waiting','nibble','hooked','idle'])assert.equal(teaseBait({...pending},phase,3000),false);
 assert.equal(teaseBait({...pending,catch:null},'reading',3000),false);
 assert.equal(teaseBait({...pending,catch:{id:'bell'}},'reading',3000),false);
 assert.equal(teaseBait({...pending,biteMode:undefined},'reading',3000),false);
 assert.equal(teaseBait({...pending,liftedAt:2000},'reading',3000),false);
 assert.equal(teaseBait({...pending,phase:'result'},'reading',3000),false);
 assert.equal(teaseBait({...pending},'reading',5000),false);
 assert.equal(teaseBait({...pending},'reading',NaN),false);
 const old={...pending};delete old.biteWindowMs;
 assert.equal(teaseBait(old,'reading',3000),true);
 assert.equal(old.biteWindowMs,10500);
});

test('the player lift starts at rest and draws the fish nearer without a contact jump',()=>{
 assert.deepEqual(lureTeaseMotion(-1),{lift:0,follow:0});
 assert.deepEqual(lureTeaseMotion(NaN),{lift:0,follow:0});
 assert.deepEqual(lureTeaseMotion(0),{lift:0,follow:0});
 assert.ok(lureTeaseMotion(300).lift>0);
 assert.equal(lureTeaseMotion(700).lift,0);
 assert.equal(lureTeaseMotion(700).follow,LURE_TEASE.followStrength);
 const hook={x:2,y:-.22,z:3};
 const before=fishMouthApproach(hook,-3.3,1,'peck','reading');
 const after=fishMouthApproach(hook,-3.3,1,'peck','reading',0,hook.y,lureTeaseMotion(400).follow);
 assert.ok(Math.hypot(after.x-hook.x,after.z-hook.z)<Math.hypot(before.x-hook.x,before.z-hook.z));
 assert.equal(after.y,before.y);
 const first=fishMouthApproach(hook,-3.3,1,'peck','reading',0,hook.y,lureTeaseMotion(1).follow);
 assert.ok(Math.hypot(first.x-before.x,first.z-before.z)<.001);
 const contact=fishMouthApproach(hook,0,1,'peck','hooked',0,hook.y,LURE_TEASE.followStrength);
 assert.ok(Math.hypot(contact.x-hook.x,contact.y-hook.y,contact.z-hook.z)<1e-9);
});

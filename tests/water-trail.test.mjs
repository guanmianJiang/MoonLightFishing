import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,migrateSave,makeCast,expireHookWindow,markNearMiss,settleEmptyCast} from '../src/engine.mjs';
import {WATER_TRAIL_BITE_BONUS_MS,WATER_TRAIL_WAIT_REDUCTION_MS} from '../src/water-trail.mjs';

function missedFish(){
 const save=newSave();save.trip.number=5;
 const cast=save.pending=makeCast(save,1000,()=>0);cast.catch.id='perch';
 assert.equal(expireHookWindow(save,cast.readyAt+cast.biteWindowMs),true);
 assert.equal(expireHookWindow(save,cast.readyAt+cast.biteWindowMs+1),false);
 settleEmptyCast(save);
 return save;
}

test('a missed live fish leaves one actionable trail without awarding progress',()=>{
 const save=missedFish();
 assert.deepEqual(save.waterTrail,{fishId:'perch',spot:'reed',bait:'grain',reason:'missed'});
 assert.equal(save.knowledge,0);
 assert.equal(save.trip.castsLeft,3);
 assert.equal(settleEmptyCast(save),null);
 assert.equal(save.trip.castsLeft,3);
});

test('a fish that escapes during the fight leaves an escaped trail',()=>{
 const save=newSave(),cast=save.pending=makeCast(save,1000,()=>0);
 assert.equal(markNearMiss(cast,'escaped'),true);
 const escapedId=cast.catch.id;
 cast.catch=null;
 const result=settleEmptyCast(save);
 assert.equal(result.error,undefined);
 assert.deepEqual(save.waterTrail,{fishId:escapedId,spot:'reed',bait:'grain',reason:'escaped'});
 assert.equal(save.pending,null);
});

test('casting at the same water with the same bait can bring the fish back',()=>{
 const save=missedFish(),next=makeCast(save,30000,()=>0);
 assert.equal(next.followedTrail,true);
 assert.equal(next.trailReturned,true);
 assert.equal(next.catch.id,'perch');
 assert.equal(next.readyAt-30000,9000-WATER_TRAIL_WAIT_REDUCTION_MS);
 assert.equal(next.biteWindowMs,9500+WATER_TRAIL_BITE_BONUS_MS);
 assert.equal(save.waterTrail,null);
});

test('following a trail improves the chance but never guarantees a return',()=>{
 const save=missedFish(),next=makeCast(save,30000,()=>.9);
 assert.equal(next.followedTrail,true);
 assert.equal(next.trailReturned,false);
 assert.notEqual(next.catch.id,'perch');
 assert.equal(next.biteWindowMs,9500);
});

test('a different bait spends the opportunity without a hidden bonus',()=>{
 const save=missedFish();save.bait='worm';
 const next=makeCast(save,30000,()=>0);
 assert.equal(next.followedTrail,false);
 assert.equal(next.trailReturned,false);
 assert.equal(next.readyAt-30000,9000);
 assert.equal(save.waterTrail,null);
});

test('weather gated rare fish cannot be conjured by a trail',()=>{
 const save=newSave();save.spot='bridge';save.waterTrail={fishId:'oldgold',spot:'bridge',bait:'grain',reason:'escaped'};
 const next=makeCast(save,1000,()=>0);
 assert.equal(next.followedTrail,false);
 assert.notEqual(next.catch.id,'oldgold');
 assert.equal(save.waterTrail,null);
});

test('old or malformed saves and non-fish objects do not create trails',()=>{
 const save=newSave();delete save.waterTrail;assert.equal(migrateSave(save).waterTrail,null);
 save.waterTrail={fishId:'bottle',spot:'reed',bait:'grain',reason:'missed'};
 assert.equal(migrateSave(save).waterTrail,null);
 const cast=save.pending=makeCast(save,1000,()=>0);cast.catch.id='bottle';
 assert.equal(markNearMiss(cast,'escaped'),false);
 cast.catch=null;settleEmptyCast(save);
 assert.equal(save.waterTrail,null);
});

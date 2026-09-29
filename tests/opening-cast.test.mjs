import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,finishCast,processCatch} from '../src/engine.mjs';
import {castPreset,castZone,openingCastPoint} from '../src/cast-target.mjs';
import {isOpeningCast,openingCastWeights} from '../src/opening-cast.mjs';
import {progressionGuide} from '../src/progression-guide.mjs';

test('a fresh first cast starts with water curiosity and common shallow fish',()=>{
 const save=newSave();
 assert.equal(isOpeningCast(save),true);
 const guide=progressionGuide(save);
 assert.equal(guide.opening,true);
 assert.equal(guide.action.kind,'aim');
 assert.deepEqual(guide.action.point,openingCastPoint());
 assert.equal(castZone('reed',guide.action.point),'near');
 assert.ok(guide.action.point[0]<castPreset('reed','near')[0]);
 assert.match(guide.title,/浅滩/);
 for(let roll=0;roll<=1;roll+=.05){
  const cast=makeCast(save,1000,()=>roll,castPreset('reed','near'));
  assert.equal(cast.openingCast,true);
  assert.ok(['carp','minnow'].includes(cast.catch.id));
  assert.ok(cast.catch.id!=='carp'||cast.catch.weight<=.38);
  assert.ok(cast.readyAt-1000>=7000&&cast.readyAt-1000<=8800);
  assert.equal(cast.biteWindowMs,18000);
 }
});

test('a different bait preserves its fish pool while keeping the gentle first timing',()=>{
 const save=newSave();save.bait='glow';
 const weights=openingCastWeights(save,{carp:1,minnow:1,shrimp:4,perch:2});
 assert.equal(weights.shrimp,4);
 assert.match(progressionGuide(save).detail,/鱼饵已经备好/);
 const cast=makeCast(save,1000,()=>.99);
 assert.equal(cast.openingCast,true);
 assert.ok(cast.readyAt-1000<9500);
 assert.equal(cast.biteWindowMs,16000);
});

test('after the first result, normal timing and progression return without rewriting a pending cast',()=>{
 const save=newSave();
 save.pending=makeCast(save,1000,()=>.5);
 const firstReadyAt=save.pending.readyAt;
 finishCast(save);processCatch(save,'study');
 assert.equal(save.pending.readyAt,firstReadyAt);
 save.pending=null;
 assert.equal(isOpeningCast(save),false);
 assert.equal(progressionGuide(save).opening,undefined);
 const next=makeCast(save,30000,()=>.5);
 assert.equal(next.openingCast,false);
 assert.equal(next.readyAt-30000,11000);
 assert.equal(next.biteWindowMs,9500);
});

test('old or inconsistent progress cannot restart the opening',()=>{
 const save=newSave();save.log=[{id:'carp',spot:'reed',weight:.2,length:20,time:1}];
 assert.equal(isOpeningCast(save),false);
 save.log=[];save.waterTrail={fishId:'carp',spot:'reed',bait:'grain',reason:'missed'};
 assert.equal(isOpeningCast(save),false);
 save.waterTrail=null;save.trip.number=2;
 assert.equal(isOpeningCast(save),false);
 save.trip.number=1;save.spot='bridge';
 assert.equal(isOpeningCast(save),false);
 assert.equal(isOpeningCast(null),false);
});

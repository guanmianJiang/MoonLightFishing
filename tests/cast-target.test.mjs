import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST_AREAS,castZone,castPreset,castPointFromDrag} from '../src/cast-target.mjs';
import {shore} from '../src/coast.js';
import {newSave,makeCast} from '../src/engine.mjs';

test('each fishing location has reachable near, middle and far presets',()=>{
 for(const spot of Object.keys(CAST_AREAS))for(const zone of ['near','middle','far'])assert.equal(castZone(spot,castPreset(spot,zone)),zone);
 assert.equal(castZone('reed',[100,100]),null);
 assert.equal(castZone('reed',[NaN,5]),null);
});

test('landing distance changes the cast with a modest, visible tradeoff',()=>{
 const save=newSave(),t=1000,rng=()=>{let i=0;return()=>[0,.7,.5,.5,.5][i++]??.5};
 const near=makeCast(save,t,rng(),castPreset('reed','near'));
 const far=makeCast(save,t,rng(),castPreset('reed','far'));
 assert.equal(near.castZone,'near');assert.equal(far.castZone,'far');
 assert.equal(near.catch.id,far.catch.id);
 assert.ok(far.catch.weight>near.catch.weight);
 assert.equal(far.readyAt-near.readyAt,1400);
 assert.deepEqual(makeCast(save,t,rng()).castPoint,castPreset('reed','middle'));
});

test('cast button drag stays in reachable water across phone sizes',()=>{
 for(const spot of Object.keys(CAST_AREAS))for(const [width,height] of [[320,568],[390,844],[768,1024]]){
  assert.deepEqual(castPointFromDrag(spot,0,0,width,height),CAST_AREAS[spot]);
  assert.equal(castZone(spot,castPointFromDrag(spot,0,-120,width,height)),'far');
  assert.equal(castZone(spot,castPointFromDrag(spot,0,60,width,height)),'near');
  for(const [dx,dy] of [[-300,-300],[300,-300],[-300,100],[300,100]]){
   const point=castPointFromDrag(spot,dx,dy,width,height);
   assert.ok(castZone(spot,point));
   assert.ok(point[1]>shore(point[0])+.2);
  }
 }
});

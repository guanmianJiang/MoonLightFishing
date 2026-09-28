import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST_AREAS,CAST_RADIUS,castZone,castPreset,castFootprint,castPointFromWorld,castPointFromWaterTouch,readyWaterTarget,confirmedCastPoint} from '../src/cast-target.mjs';
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

test('touching water previews only reachable cast points',()=>{
 for(const spot of Object.keys(CAST_AREAS)){
  const [x,z]=castPreset(spot,'middle');
  assert.deepEqual(castPointFromWorld(spot,x,z),[x,z]);
  assert.equal(castPointFromWorld(spot,x+100,z),null);
  assert.equal(castPointFromWorld(spot,NaN,z),null);
 }
 assert.equal(castPointFromWorld('reed',-2,shore(-2)),null);
 assert.equal(castPointFromWorld('unknown',0,10),null);
});

test('a cast requires an active aim and keeps its selected water point',()=>{
 const middle=castPreset('reed');
 const far=castPreset('reed','far');
 assert.equal(confirmedCastPoint('reed',false,middle),null);
 assert.deepEqual(confirmedCastPoint('reed',true,far),far);
 assert.deepEqual(confirmedCastPoint('reed',true,[100,100]),middle);
 assert.deepEqual(confirmedCastPoint('reed',true,null),middle);
 assert.equal(confirmedCastPoint('unknown',true,null),null);
});

test('water touches beyond the cast circle settle on its edge while dry touches keep the point',()=>{
 for(const spot of Object.keys(CAST_AREAS)){
  const [x,z]=CAST_AREAS[spot];
  assert.deepEqual(castPointFromWaterTouch(spot,x,z),[x,z]);
  const far=castPointFromWaterTouch(spot,x,z+100);
  assert.ok(far&&castZone(spot,far));
  assert.ok(Math.hypot(far[0]-x,far[1]-z)<=CAST_RADIUS);
  assert.ok(Math.hypot(far[0]-x,far[1]-z)>CAST_RADIUS-.3);
  assert.equal(castPointFromWaterTouch(spot,x,shore(x)),null);
 }
 assert.equal(castPointFromWaterTouch('reed',NaN,10),null);
 assert.equal(castPointFromWaterTouch('reed',0,Infinity),null);
 assert.equal(castPointFromWaterTouch('unknown',0,10),null);
});

test('visible cast footprints follow the same water and reach constraints as touch selection',()=>{
 for(const spot of Object.keys(CAST_AREAS)){
  const points=castFootprint(spot);
  assert.equal(points.length,64);
  assert.ok(points.every(([x,z])=>castPointFromWorld(spot,x,z)));
  assert.ok(points.every(([x,z])=>Math.hypot(x-CAST_AREAS[spot][0],z-CAST_AREAS[spot][1])<=CAST_RADIUS+.001));
  assert.ok(points.some(([x,z])=>Math.hypot(x-CAST_AREAS[spot][0],z-CAST_AREAS[spot][1])>CAST_RADIUS-.05));
 }
 assert.equal(castFootprint('unknown'),null);
 assert.equal(castFootprint('reed',8),null);
 assert.equal(castFootprint('reed',300),null);
});

test('a near ready water tap selects a point without stealing overview or active casts',()=>{
 const point=castPreset('reed');
 const ready={spot:'reed',keepFishingView:true,overview:false,aiming:false,pending:null};
 assert.deepEqual(readyWaterTarget(ready,...point),point);
 assert.equal(readyWaterTarget({...ready,overview:true},...point),null);
 assert.equal(readyWaterTarget({...ready,aiming:true},...point),null);
 assert.equal(readyWaterTarget({...ready,pending:{phase:'cast'}},...point),null);
 assert.equal(readyWaterTarget({...ready,keepFishingView:false},...point),null);
 assert.equal(readyWaterTarget(ready,point[0]+100,point[1]),null);
 assert.equal(readyWaterTarget(ready,point[0],shore(point[0])),null);
});

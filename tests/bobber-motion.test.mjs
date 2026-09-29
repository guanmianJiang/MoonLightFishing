import test from 'node:test';
import assert from 'node:assert/strict';
import {readingBobberMotion,nibbleBobberMotion,hookedBobberMotion} from '../src/bobber-motion.mjs';

test('fish approach cannot tug the float before mouth contact',()=>{
 for(const kind of ['dart','peck','deep','broad','unknown'])for(const age of [0,.2,2,10,NaN])
  assert.deepEqual(readingBobberMotion(kind,age),{x:0,y:0,z:0,tilt:0});
});

test('pre-contact nibble is quiet and hooked load begins continuously at contact',()=>{
 for(const remaining of [2200,300,1,0,NaN]){
  const motion=nibbleBobberMotion(remaining,1300-remaining,1300,4);
  assert.equal(motion.y,0);
  assert.equal(motion.tilt,0);
  assert.equal(motion.pulse,-1);
 }
 const atBite=hookedBobberMotion(true,0,0,0,0);
 assert.ok(atBite.y===0&&atBite.tilt===0);
 const liveAtBite=hookedBobberMotion(false,0,3,0,0);
 assert.ok(liveAtBite.y===0);
 assert.ok(liveAtBite.tilt===0);
 assert.equal(hookedBobberMotion(true,1,0,0,0).y,-.10);
 assert.ok(Number.isFinite(hookedBobberMotion(false,.3,5,.8,.6).tilt));
});

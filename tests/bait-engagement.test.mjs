import test from 'node:test';
import assert from 'node:assert/strict';
import {baitEngagement,fishApproachOffset,fishMouthApproach} from '../src/bait-engagement.mjs';

test('the fish tests the bait before committing its mouth to the hook',()=>{
 const early=baitEngagement('reading',0),probe=baitEngagement('reading',.3);
 assert.ok(early>0&&probe>early&&probe<1);
 assert.ok(baitEngagement('responding')>early);
 assert.ok(baitEngagement('nibble')>baitEngagement('responding'));
 assert.equal(baitEngagement('hooked'),1);
 assert.equal(baitEngagement('spooked'),0);
});

test('the mouth reaches the hook continuously before the bite changes phase',()=>{
 const early=baitEngagement('nibble',0,-.8);
 const midway=baitEngagement('nibble',0,-.25);
 const edge=baitEngagement('nibble',0,0);
 assert.equal(early,.88);
 assert.ok(midway>early&&midway<1);
 assert.equal(edge,baitEngagement('hooked'));
 assert.equal(baitEngagement('reading',1,-2.2),baitEngagement('nibble',0,-2.2));
 assert.equal(baitEngagement('responding',0,0),baitEngagement('hooked'));
});

test('fish swimming stays continuous when reading, nibble and bite phases change',()=>{
 for(const signal of ['broad','dart','deep'])for(const boundary of [-4.3,-2.2,0]){
  const before=fishApproachOffset(boundary-1e-4,12.5,signal);
  const after=fishApproachOffset(boundary+1e-4,12.5,signal);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.005,`${signal} at ${boundary}`);
 }
 assert.deepEqual(fishApproachOffset(0,0,'deep'),{x:0,z:0});
 assert.ok(Object.values(fishApproachOffset(NaN,NaN,'deep')).every(Number.isFinite));
});

test('the mouth swims diagonally into the hook without a final vertical lift',()=>{
 const hook={x:4,y:-.25,z:2};
 const far=fishMouthApproach(hook,-5.5,0,'deep','approach');
 const middle=fishMouthApproach(hook,-4.3,0,'deep','reading');
 const late=fishMouthApproach(hook,-.5,0,'deep','nibble');
 const bite=fishMouthApproach(hook,0,0,'deep','hooked');
 const distance=p=>Math.hypot(p.x-hook.x,p.z-hook.z);
 assert.ok(distance(far)>distance(middle)&&distance(middle)>distance(late));
 assert.ok(far.y<middle.y&&middle.y<late.y&&late.y<hook.y);
 assert.ok(late.y-far.y>.3,'the fish rises during its horizontal swim');
 assert.ok(hook.y-late.y<.02,'the final approach does not become a vertical elevator');
 assert.deepEqual(bite,hook);
 assert.ok(Object.values(fishMouthApproach(null,NaN,NaN,'deep','approach')).every(Number.isFinite));
});

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

test('an unhooked fish keeps its own depth while the float bobs above it',()=>{
 const restY=-.22,rest={x:4,y:restY,z:2};
 for(const [phase,age] of [['approach',-4.8],['reading',-3.1],['nibble',-.7],['nibble',-.001]]){
  const high=fishMouthApproach({...rest,y:-.12},age,1,'dart',phase,0,restY);
  const low=fishMouthApproach({...rest,y:-.42},age,1,'dart',phase,0,restY);
  assert.equal(high.y,low.y,`${phase} must ignore float height before contact`);
  assert.equal(high.x,low.x);
  assert.equal(high.z,low.z);
 }
 const orbitStart=fishMouthApproach(rest,-3.4,0,'broad','reading',0,restY);
 const orbitEnd=fishMouthApproach(rest,-3.4,2,'broad','reading',.5,restY);
 assert.ok(Math.hypot(orbitStart.x-orbitEnd.x,orbitStart.z-orbitEnd.z)>.1);
 assert.equal(orbitStart.y,orbitEnd.y,'circling and probe pulses must not bob the whole fish');
 const depths=[-5.5,-4.3,-3.4,-2.2,-1.1,-.3,-.001].map(age=>fishMouthApproach(rest,age,1,'broad','nibble',0,restY).y);
 assert.ok(depths.every((depth,i)=>i===0||depth>=depths[i-1]),'pre-hook depth only rises with the approach');
 const before=fishMouthApproach(rest,-.001,1,'dart','nibble',0,restY);
 const contact=fishMouthApproach(rest,0,1,'dart','hooked',0,restY);
 assert.ok(Math.abs(contact.y-before.y)<.001);
 assert.ok(Math.hypot(contact.x-rest.x,contact.y-rest.y,contact.z-rest.z)<1e-9);
 const hooked=fishMouthApproach({...rest,y:-.4},.1,1,'dart','hooked',0,restY);
 assert.equal(hooked.y,-.4,'after contact the mouth follows the real hook');
 assert.ok(Object.values(fishMouthApproach({x:0,y:NaN,z:0},-.4,1,'dart','nibble',0,NaN)).every(Number.isFinite));
});

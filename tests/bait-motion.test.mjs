import test from 'node:test';
import assert from 'node:assert/strict';
import {BaitMotion} from '../src/bait-motion.mjs';

test('bait lags behind moving float, then settles without detaching',()=>{
 const bait=new BaitMotion();
 bait.update({x:0,z:0},1/60);
 let pose;
 for(let i=1;i<=24;i++)pose=bait.update({x:i*.08,z:0},1/60);
 assert.ok(pose.x<-.01&&pose.x>=-.13);
 for(let i=0;i<90;i++)pose=bait.update({x:1.92,z:0},1/60);
 assert.ok(Math.abs(pose.x)<.002);
 assert.deepEqual(bait.reset(),{x:0,z:0});
});

test('line load damps bait swing and invalid timing cannot corrupt it',()=>{
 const free=new BaitMotion(),loaded=new BaitMotion();
 free.update({x:0,z:0},1/60);loaded.update({x:0,z:0},1/60);
 let a,b;
 for(let i=1;i<=20;i++){
  a=free.update({x:i*.07,z:i*.02},1/60,0);
  b=loaded.update({x:i*.07,z:i*.02},1/60,1);
 }
 assert.ok(Math.hypot(b.x,b.z)<Math.hypot(a.x,a.z));
 assert.deepEqual(free.update({x:2,z:1},NaN),a);
 assert.ok(Number.isFinite(free.update({x:Infinity,z:0},1/60).x));
});

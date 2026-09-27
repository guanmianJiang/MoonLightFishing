import test from 'node:test';
import assert from 'node:assert/strict';
import {introCameraPose} from '../dist/camera-intro.js';

const normal=[2.4,17.8,15.5],aim=[-1,0,1];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

test('intro starts on a distant diagonal and ends at the normal camera exactly',()=>{
 const start=introCameraPose(0,normal,aim,1.6),end=introCameraPose(1,normal,aim,1.6);
 assert.ok(distance(start.position,[-1.2,.62,.35])>50);assert.ok(distance(end.position,normal)<1e-12);assert.ok(distance(end.aim,aim)<1e-12);assert.equal(end.fov,36);assert.equal(end.done,true);
});

test('approach, 120-degree orbit, and pullback meet without camera jumps',()=>{
 const center=[-1.2,.62,.35],orbitStart=introCameraPose(.24,normal,aim,1.6),orbitEnd=introCameraPose(.59,normal,aim,1.6);
 const angle=p=>Math.atan2(p.position[0]-center[0],p.position[2]-center[2]);
 assert.ok(Math.abs((angle(orbitEnd)-angle(orbitStart))-Math.PI*2/3)<1e-12);
 assert.ok(distance(introCameraPose(.24-1e-6,normal,aim,1.6).position,orbitStart.position)<.001);
 assert.ok(distance(introCameraPose(.59-1e-6,normal,aim,1.6).position,orbitEnd.position)<.001);
 assert.ok(distance(orbitStart.position,center)>14&&distance(orbitStart.position,center)<16);
});

test('final pullback eases gently instead of moving linearly',()=>{
 const p90=introCameraPose(.9,normal,aim,1.6),p99=introCameraPose(.99,normal,aim,1.6);
 assert.ok(distance(p99.position,normal)<distance(p90.position,normal)*.02);
});

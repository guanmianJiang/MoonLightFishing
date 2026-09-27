import test from 'node:test';
import assert from 'node:assert/strict';
import {solveTwoBoneIK} from '../src/two-bone-ik.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('idle arm IK keeps both segment lengths and the chosen elbow side',()=>{
 const shoulder={x:-.23,y:.70,z:.02},restElbow={x:-.31,y:.53,z:.20},target={x:-.08,y:.43,z:.46};
 const upper=distance(shoulder,restElbow),lower=.35;
 const result=solveTwoBoneIK(shoulder,target,restElbow,upper,lower);
 assert.ok(Math.abs(distance(shoulder,result.elbow)-upper)<1e-5);
 assert.ok(Math.abs(distance(result.elbow,result.hand)-lower)<1e-5);
 assert.ok(result.elbow.x<shoulder.x);
 assert.equal(result.limited,false);
});

test('an unreachable pointer target stops at the arm length',()=>{
 const result=solveTwoBoneIK({x:0,y:0,z:0},{x:3,y:0,z:0},{x:0,y:1,z:0},.3,.3);
 assert.equal(result.limited,true);
 assert.ok(result.hand.x<.6);
 assert.ok(Math.abs(distance({x:0,y:0,z:0},result.elbow)-.3)<1e-5);
});

test('vertical hand targets still produce perpendicular elbow bend',()=>{
 const shoulder={x:0,y:0,z:0};
 const result=solveTwoBoneIK(shoulder,{x:0,y:.4,z:0},{x:0,y:.2,z:0},.3,.3);
 assert.ok(Math.abs(distance(shoulder,result.elbow)-.3)<1e-5);
 assert.ok(Math.abs(distance(result.elbow,result.hand)-.3)<1e-5);
 assert.ok(Math.abs(result.elbow.x)>0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleCastMotion} from '../src/angler-motion.js';
import {supportGripTarget} from '../src/rod-grip.mjs';
import {solveTwoBoneIK} from '../src/two-bone-ik.mjs';
import {Group,Vector3} from '../src/three.module.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const shoulderA={x:-.23,y:.70,z:.02},shoulderB={x:.23,y:.70,z:.02};

test('both hands keep fixed arm lengths and the support hand stays on the shaft through casts',()=>{
 for(const castDistance of [3,8,13])for(const time of [.34,.63,.70,.78,.9,1.52]){
  const pose=sampleCastMotion(time,castDistance);
  const target={x:-.13+pose.gripSide,y:.44+pose.handLift+pose.gripSide*.35,z:.42+pose.action*.23+pose.handBack+pose.gripSide*.45};
  const primary=solveTwoBoneIK(shoulderA,target,{x:-.31,y:.53,z:.20},.34,.38);
  const axis={x:0,y:Math.sin(pose.rodAngle),z:Math.cos(pose.rodAngle)};
  const grip=supportGripTarget(primary.hand,shoulderB,axis,.715);
  const secondary=solveTwoBoneIK(shoulderB,grip,{x:.31,y:.52,z:.23},.34,.38);
  assert.ok(Math.abs(distance(primary.hand,primary.elbow)-.38)<1e-5);
  assert.ok(Math.abs(distance(secondary.hand,secondary.elbow)-.38)<1e-5);
  assert.ok(distance(secondary.hand,grip)<.015,`support grip escaped at ${castDistance}m ${time}s: reach ${distance(shoulderB,grip).toFixed(3)}, error ${distance(secondary.hand,grip).toFixed(3)}`);
  const offset={x:grip.x-primary.hand.x,y:grip.y-primary.hand.y,z:grip.z-primary.hand.z};
  assert.ok(Math.hypot(offset.y*axis.z-offset.z*axis.y,offset.z*axis.x-offset.x*axis.z,offset.x*axis.y-offset.y*axis.x)<1e-8);
 }
});

test('unreachable main hand is clamped and the rod starts at the solved hand',()=>{
 const target={x:0,y:.4,z:2};
 const solved=solveTwoBoneIK(shoulderA,target,{x:-.31,y:.53,z:.20},.34,.38);
 assert.equal(solved.limited,true);
 assert.ok(distance(shoulderA,solved.hand)<.72);
 assert.ok(distance(target,solved.hand)>1);
});

test('support grip remains on the rendered rod through torso lean and side roll',()=>{
 const body=new Group();body.rotation.set(-.25,.42,.11);body.updateMatrixWorld(true);
 const localAxis=new Vector3(0,Math.sin(1.16),Math.cos(1.16));
 const primary=new Vector3(-.1,.48,.37);
 const grip=supportGripTarget(primary,new Vector3(.23,.7,.02),localAxis,.715);
 const worldPrimary=primary.clone().applyMatrix4(body.matrixWorld);
 const worldGrip=new Vector3(grip.x,grip.y,grip.z).applyMatrix4(body.matrixWorld);
 const worldAxis=localAxis.clone().transformDirection(body.matrixWorld);
 const along=worldGrip.clone().sub(worldPrimary).dot(worldAxis);
 const onRod=worldPrimary.clone().addScaledVector(worldAxis,along);
 assert.ok(worldGrip.distanceTo(onRod)<1e-9);
});

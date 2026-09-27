import test from 'node:test';
import assert from 'node:assert/strict';
import {idleLookTarget} from '../dist/idle-look.mjs';

const origin={x:0,y:.5,z:0},forward={x:0,z:1},spot={x:0,y:.12,z:9};

test('idle look is neutral without a water target',()=>{
 assert.deepEqual(idleLookTarget(origin,forward,null,spot),{torsoYaw:0,headYaw:0,pitch:0});
});

test('idle look tracks left and right with separate torso and head limits',()=>{
 const left=idleLookTarget(origin,forward,{x:-10,y:.12,z:2},spot);
 const right=idleLookTarget(origin,forward,{x:10,y:.12,z:2},spot);
 assert.ok(left.torsoYaw<0&&right.torsoYaw>0);
 assert.ok(Math.abs(left.torsoYaw)<=.62&&Math.abs(right.torsoYaw)<=.62);
 assert.ok(Math.abs(left.headYaw)<=.42&&Math.abs(right.headYaw)<=.42);
 assert.ok(Math.abs(left.torsoYaw+left.headYaw)>.8);
 assert.ok(Math.abs(right.torsoYaw+right.headYaw)>.8);
});

test('near and far pointer targets keep the neck pitch bounded',()=>{
 const near=idleLookTarget(origin,forward,{x:0,y:.12,z:1},spot);
 const far=idleLookTarget(origin,forward,{x:0,y:.12,z:30},spot);
 assert.ok(near.pitch>=-.20&&near.pitch<=.16);
 assert.ok(far.pitch>=-.20&&far.pitch<=.16);
 assert.ok(near.pitch<far.pitch);
});

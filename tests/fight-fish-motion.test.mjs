import test from 'node:test';
import assert from 'node:assert/strict';
import {fightFishMotion} from '../src/fight-fish-motion.mjs';

const fish={startDistance:9,distance:7,progress:2/7.2,fishPosition:.5,fishVelocity:0,surge:0,load:.4,pumpPulse:0,radialVelocity:-1,seed:1};

test('the fish follows the cast direction toward the angler at every spot',()=>{
 for(const spot of [{x:-8,z:5},{x:5,z:5},{x:7,z:10}]){
  const far=fightFishMotion(fish,{x:-1,z:0},spot,0);
  const near=fightFishMotion({...fish,distance:3,progress:.8},{x:-1,z:0},spot,0);
  const sourceDist=Math.hypot(far.position.x+1,far.position.z);
  const pulledDist=Math.hypot(near.position.x+1,near.position.z);
  assert.ok(pulledDist<sourceDist);
  assert.ok(far.heading.x*(spot.x+1)+far.heading.z*spot.z<0);
 }
});

test('fish faces shore while pulled in and turns toward open water on a run',()=>{
 const angler={x:0,z:0},spot={x:8,z:0};
 const pulled=fightFishMotion({...fish,radialVelocity:-.8},angler,spot,0);
 const escaping=fightFishMotion({...fish,radialVelocity:.8},angler,spot,0);
 assert.ok(pulled.heading.x<0);
 assert.ok(escaping.heading.x>0);
});

test('the hooked fish stays submerged until a near-shore lift can breach the surface',()=>{
 const angler={x:0,z:0},spot={x:8,z:0};
 const far=fightFishMotion(fish,angler,spot,0);
 const near=fightFishMotion({...fish,distance:2,progress:.97,pumpPulse:1},angler,spot,0);
 assert.ok(far.position.y<-.3);
 assert.ok(near.position.y>0);
 assert.ok(near.position.y>far.position.y);
 assert.ok(near.pitch<0,'lift should raise the head toward the rod');
});

test('a lateral dodge stays perpendicular to the reel-in path',()=>{
 const angler={x:0,z:0},spot={x:0,z:9};
 const left=fightFishMotion({...fish,fishPosition:.2},angler,spot,0);
 const right=fightFishMotion({...fish,fishPosition:.8},angler,spot,0);
 assert.ok(left.position.x>0 && right.position.x<0);
 assert.equal(left.position.z,right.position.z);
});

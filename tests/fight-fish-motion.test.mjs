import test from 'node:test';
import assert from 'node:assert/strict';
import {fightFishMotion,hookedFishPose,biteFishPose,turnFishYaw,fightEntryPosition} from '../src/fight-fish-motion.mjs';
import {Euler,Group,Vector3} from '../src/three.module.js';
import {alignFishMouth,fishMouthWorld} from '../src/fish-attachment.mjs';

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

test('taut load raises the hooked mouth while slack lets the fish level out',()=>{
 const angler={x:0,z:0},spot={x:8,z:0};
 const quiet=fightFishMotion({...fish,load:.08,tension:.08,slack:0,radialVelocity:0},angler,spot,0);
 const loaded=fightFishMotion({...fish,load:.9,tension:1,slack:0,radialVelocity:-.6},angler,spot,0);
 const loose=fightFishMotion({...fish,load:.9,tension:1,slack:.8,radialVelocity:0},angler,spot,0);
 const lifted=fightFishMotion({...fish,load:.9,tension:1,slack:0,pumpPulse:1},angler,spot,0);
 assert.ok(loaded.pitch<quiet.pitch-.3);
 assert.ok(lifted.pitch<loaded.pitch-.1);
 assert.ok(loose.pitch>loaded.pitch+.25);
 assert.ok(loaded.position.y>quiet.position.y,'line load also lifts the body slightly');
});

test('the first fight frame carries the bite pose before line tension builds',()=>{
 const angler={x:0,z:0},spot={x:8,z:0};
 const bite=hookedFishPose({x:1,z:0},.4,1,1);
 const opening=fightFishMotion({...fish,fishState:'hookset',stateAge:0,load:0,tension:0,slack:.22,radialVelocity:0},angler,spot,1);
 const settling=fightFishMotion({...fish,fishState:'hookset',stateAge:2,load:0,tension:0,slack:.22,radialVelocity:0},angler,spot,1);
 assert.ok(Math.abs(opening.pitch-bite.pitch)<.12,'the head must not snap flat at the transition');
 assert.ok(opening.pitch<settling.pitch-.25,'the bite impulse settles while the player takes up slack');
 assert.ok(Math.abs(opening.heading.z)>.75,'the first frame keeps the flank visible');
});

test('the fish shows a flank but keeps its real travel direction and mouth higher than tail',()=>{
 for(const spot of [{x:8,z:0},{x:-5,z:7},{x:0,z:9}]){
  const angler={x:0,z:0};
  for(const radialVelocity of [-.7,.8]){
   const motion=fightFishMotion({...fish,load:.8,tension:.9,slack:0,radialVelocity},angler,spot,.5);
   const outward={x:spot.x/Math.hypot(spot.x,spot.z),z:spot.z/Math.hypot(spot.x,spot.z)};
   const along=motion.heading.x*outward.x+motion.heading.z*outward.z;
   const flank=motion.heading.x*(-outward.z)+motion.heading.z*outward.x;
   assert.ok(radialVelocity<0?along<-.5:along>.5);
   assert.ok(Math.abs(flank)>.4&&Math.abs(flank)<1.3);
   const yaw=Math.atan2(motion.heading.z,-motion.heading.x);
   const rotation=new Euler(motion.roll,yaw,motion.pitch);
   const mouth=new Vector3(-1,0,0).applyEuler(rotation);
   const tail=new Vector3(1,0,0).applyEuler(rotation);
   assert.ok(mouth.y>tail.y+.35,'the visible model must lift its head, not just report a pitch value');
  }
 }
});

test('bite orientation and position remain continuous across the hook and fight boundaries',()=>{
 const outward={x:.6,z:.8},seed=1.2;
 const before=biteFishPose(outward,-.001,4,seed),after=biteFishPose(outward,0,4,seed);
 const beforeYaw=Math.atan2(before.heading.z,-before.heading.x),afterYaw=Math.atan2(after.heading.z,-after.heading.x);
 assert.ok(Math.abs(Math.atan2(Math.sin(afterYaw-beforeYaw),Math.cos(afterYaw-beforeYaw)))<.02);
 assert.ok(Math.abs(after.pitch-before.pitch)<.01);
 const start={x:2,y:-.4,z:3},target={x:1,y:-.65,z:2.5};
 assert.deepEqual(fightEntryPosition(start,target,0),start);
 assert.deepEqual(fightEntryPosition(start,target,.4),target);
 const middle=fightEntryPosition(start,target,.2);
 assert.ok(middle.x<start.x&&middle.x>target.x&&middle.y<start.y&&middle.y>target.y);
});

test('fish only begins forceful tail and body struggle after the hook is set',()=>{
 const outward={x:1,z:0},time=.1,seed=0;
 for(const age of [-5,-2,-.6,-.001]){
  const pose=biteFishPose(outward,age,time,seed,false);
  assert.ok(Math.abs(pose.tail)<=.12,'an unhooked fish only paddles gently');
  assert.ok(Math.abs(pose.roll)<.04,'an unhooked fish must not thrash its body');
 }
 const before=biteFishPose(outward,-.001,time,seed,false);
 const contact=biteFishPose(outward,0,time,seed,true);
 const struggling=biteFishPose(outward,.3,time,seed,true);
 assert.ok(Math.abs(contact.tail-before.tail)<.002,'the bite frame keeps the previous tail pose');
 assert.ok(Math.abs(contact.roll-before.roll)<.002,'the body does not snap on contact');
 assert.ok(Math.abs(struggling.tail)>.4,'strong tail action starts after the bite');
 assert.ok(Math.abs(struggling.roll)>Math.abs(contact.roll));
 const restored=biteFishPose(outward,NaN,NaN,NaN,false);
 assert.ok([restored.heading.x,restored.heading.z,restored.pitch,restored.roll,restored.tail].every(Number.isFinite));
});

test('lateral swimming faces the actual side of travel and turning has a speed limit',()=>{
 const angler={x:0,z:0},spot={x:8,z:0},side={x:0,z:1};
 for(const fishVelocity of [-.8,.8]){
  const f={...fish,radialVelocity:-.6,fishVelocity};
  const pose=fightFishMotion(f,angler,spot,1);
  const lateral=pose.heading.x*side.x+pose.heading.z*side.z;
  assert.ok(lateral*fishVelocity>.3,'head must not face opposite the sideways dodge');
  const next=fightFishMotion({...f,distance:f.distance-.06,fishPosition:f.fishPosition+fishVelocity*.1},angler,spot,1.1);
  const moved={x:next.position.x-pose.position.x,z:next.position.z-pose.position.z};
  assert.ok(moved.x*pose.heading.x+moved.z*pose.heading.z>0,'head and displacement must agree');
 }
 const current=0,opposite={x:1,z:0};
 assert.ok(Math.abs(turnFishYaw(current,opposite,.016)-current)<=.077);
 assert.ok(Math.abs(turnFishYaw(current,opposite,1)-current)<=.577);
});

test('struggle sways the whole fish around the line while keeping depth and heading finite',()=>{
 const angler={x:0,z:0},spot={x:8,z:0},state={...fish,fishState:'hookset',stateAge:.1};
 const left=fightFishMotion(state,angler,spot,1,-1),right=fightFishMotion(state,angler,spot,1,1);
 assert.ok(right.position.z-left.position.z>.35);
 assert.equal(right.position.x,left.position.x);
 assert.ok(right.position.y>-.6&&right.position.y<0);
 assert.ok(right.roll-left.roll>.45);
 assert.ok([left.pitch,right.pitch,left.heading.x,right.heading.z].every(Number.isFinite));
});

test('a newly hooked fish turns its flank and raises its mouth before the fight starts',()=>{
 for(const outward of [{x:1,z:0},{x:0,z:1},{x:-.6,z:.8}]){
  const first=hookedFishPose(outward,0,2,1);
  const loaded=hookedFishPose(outward,.35,2.35,1);
  const length=Math.hypot(outward.x,outward.z);
  const shore=loaded.heading.x*outward.x/length+loaded.heading.z*outward.z/length;
  const flank=loaded.heading.x*(-outward.z)/length+loaded.heading.z*outward.x/length;
  assert.ok(shore<-.9,'the head stays toward the rod');
  assert.ok(Math.abs(flank)>.5,'the side of the fish is visible');
  assert.ok(loaded.pitch<first.pitch-.3,'the mouth rises as the line takes load');
  const fish=new Group();fish.userData.mouthLocal=new Vector3(-.94,-.035,0);
  fish.scale.setScalar(.6);fish.rotation.set(loaded.roll,Math.atan2(loaded.heading.z,-loaded.heading.x),loaded.pitch);
  const hook=new Vector3(2,-.35,4);alignFishMouth(fish,hook);
  const tail=new Vector3(.94,0,0).applyMatrix4(fish.matrixWorld);
  assert.ok(fishMouthWorld(fish).distanceTo(hook)<1e-8);
  assert.ok(hook.y>tail.y+.25,'the rendered head must be higher than the tail');
 }
});

test('bite pose handles restored or invalid bite times without nonfinite rotations',()=>{
 for(const age of [-2,Number.NaN,Number.POSITIVE_INFINITY,.5]){
  const pose=hookedFishPose({x:0,z:0},age,0,0);
  assert.ok([pose.heading.x,pose.heading.z,pose.pitch,pose.roll].every(Number.isFinite));
  assert.ok(pose.pitch<=-.08);
 }
});

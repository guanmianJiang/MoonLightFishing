import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../dist/vendor/loaders/GLTFLoader.js';
import {Box3,Vector3} from '../dist/three.module.js';
import {sampleAnglerMotion,sampleCastMotion,castEffort,reelAnimationTime,isLargeCatch,shouldStandForCatch} from '../dist/angler-motion.js';
import {castFlight,CAST_RELEASE_TIME} from '../dist/cast-flight.mjs';

test('Blender cast releases after the backswing and returns to rest continuously',()=>{
 const backswing=sampleAnglerMotion('cast',.63),release=sampleAnglerMotion('cast',CAST_RELEASE_TIME),rest=sampleAnglerMotion('cast',1.85);
 assert.ok(backswing.rodAngle>2.5&&release.rodAngle<.3);
 assert.ok(backswing.action<0&&release.action>0);
 assert.ok(Math.abs(rest.action)<1e-9&&Math.abs(rest.handLift)<1e-9);
 for(let t=0;t<1.84;t+=.01){
  const a=sampleAnglerMotion('cast',t),b=sampleAnglerMotion('cast',t+.01);
  assert.ok(Math.abs(a.rodAngle-b.rodAngle)<.43,`rod jump at ${t}`);
  assert.ok(Math.abs(a.handLift-b.handLift)<.04,`hand jump at ${t}`);
 }
});

test('backswing grip clears the torso before the rod passes behind the angler',()=>{
 for(const t of [.34,.43,.53,.63,.68]){
  const pose=sampleAnglerMotion('cast',t);
  const gripX=pose.gripSide;
  const gripY=.435+pose.handLift+pose.gripSide*.35+pose.offHandLift*.5;
  const gripZ=.435+pose.action*.235+pose.handBack+pose.gripSide*.45+pose.offHandBack*.5;
  const rodBack=Math.max(0,-Math.cos(pose.rodAngle));
  const torsoBack=Math.max(0,-gripZ);
  const crossing=rodBack>0?Math.min(1,torsoBack/(rodBack*3.55)):0;
  const rodX=gripX+Math.sin(pose.torsoYaw)*Math.cos(pose.rodAngle)*3.55*crossing;
  assert.ok(gripX>.26,`grip too close to torso at ${t}: ${gripX}`);
  assert.ok(rodX>.26||gripY>1.06,`rod crosses torso at ${t}: ${rodX}`);
 }
 assert.equal(sampleAnglerMotion('cast',1.85).gripSide,0);
});

test('cast movement grows with the intended water distance',()=>{
 const near=sampleCastMotion(.63,3),middle=sampleCastMotion(.63,8),far=sampleCastMotion(.63,13);
 assert.ok(castEffort(3)<castEffort(8)&&castEffort(8)<castEffort(13));
 assert.ok(near.rodAngle<1.6&&middle.rodAngle>1.8&&far.rodAngle>2.5);
 assert.ok(Math.abs(near.action)<Math.abs(middle.action)&&Math.abs(middle.action)<Math.abs(far.action));
 assert.ok(Math.abs(near.torsoYaw)<Math.abs(middle.torsoYaw)&&Math.abs(middle.torsoYaw)<Math.abs(far.torsoYaw));
 assert.ok(near.gripSide<middle.gripSide&&middle.gripSide<far.gripSide);
 for(const distance of [2.5,3,5,8,13,20]){
  for(let t=.25;t<=.68;t+=.01){
   const pose=sampleCastMotion(t,distance);
   if(pose.rodAngle>1.8)assert.ok(pose.gripSide>=.26,`backswing clearance at ${distance} m, ${t} s`);
  }
 }
 assert.equal(sampleCastMotion(1.85,3).gripSide,0);
});

test('cast flight has momentum, gravity and distance-scaled timing',()=>{
 const origin={x:0,y:1.4,z:0},near={x:4,y:.2,z:0},far={x:15,y:.2,z:0};
 const short=castFlight(CAST_RELEASE_TIME,origin,near),long=castFlight(CAST_RELEASE_TIME,origin,far);
 assert.ok(long.duration>short.duration&&long.height>short.height);
 for(const target of [near,far]){
  const launch=castFlight(CAST_RELEASE_TIME,origin,target);
  const apex=castFlight(CAST_RELEASE_TIME+launch.duration*.5,origin,target);
  const end=castFlight(CAST_RELEASE_TIME+launch.duration,origin,target);
  assert.ok(launch.velocity.y>0&&end.velocity.y<0);
  assert.ok(apex.position.y>target.y&&Math.abs(apex.position.x-target.x*.5)<1e-9);
  assert.ok(Math.abs(end.position.x-target.x)<1e-9&&Math.abs(end.position.y-target.y)<1e-9);
  assert.ok(CAST_RELEASE_TIME+launch.duration<=1.85);
 }
});

test('Blender reel lifts the grip before settling',()=>{
 const start=sampleAnglerMotion('reel',0),lift=sampleAnglerMotion('reel',.42),end=sampleAnglerMotion('reel',3.2);
 assert.ok(lift.handLift>start.handLift+.25);
 assert.ok(lift.handBack<-.2);
 assert.ok(lift.rodAngle>end.rodAngle);
});

test('a won fight holds the raised rod pose during the catch camera instead of replaying the reel',()=>{
 assert.equal(reelAnimationTime(0,true),1.6);
 assert.equal(reelAnimationTime(0,false),0);
 assert.ok(sampleAnglerMotion('reel',reelAnimationTime(0,true)).handLift>.2);
 assert.equal(reelAnimationTime(4,true),1.6);
});

test('cast and reel carry torso, support hand and weight shift through the motion',()=>{
 const backswing=sampleAnglerMotion('cast',.63),release=sampleAnglerMotion('cast',.78),reel=sampleAnglerMotion('reel',.42),rest=sampleAnglerMotion('cast',1.85);
 assert.ok(backswing.torsoYaw<-.3&&release.torsoYaw>.1);
 assert.ok(backswing.offHandBack<-.1&&reel.offHandLift<-.05);
 assert.ok(backswing.rootLift<-.04&&release.rootLift>.02);
 assert.ok(Math.abs(rest.torsoYaw)<1e-9&&Math.abs(rest.offHandBack)<1e-9);
});

test('large fish stays standing through the landing and sits after processing',()=>{
 assert.equal(isLargeCatch({id:'catfish',weight:3}),true);
 assert.equal(isLargeCatch({id:'carp',weight:1.8}),false);
 assert.equal(isLargeCatch({id:'bottle',weight:5}),false);
 const fish={id:'catfish',weight:3};
 assert.equal(shouldStandForCatch(fish,{fighting:true}),true);
 assert.equal(shouldStandForCatch(fish,{landedFromFight:true}),true);
 assert.equal(shouldStandForCatch(fish,{revealing:true}),true);
 assert.equal(shouldStandForCatch(fish,{showingResult:true}),true);
 assert.equal(shouldStandForCatch(fish),false);
 assert.equal(shouldStandForCatch({id:'carp',weight:1.8},{fighting:true}),false);
 const start=sampleAnglerMotion('stand_up',0),standing=sampleAnglerMotion('stand_up',1.05),seated=sampleAnglerMotion('sit_down',1.15);
 assert.ok(standing.rootLift>.4&&standing.action>.95);
 assert.ok(Math.abs(seated.rootLift)<1e-9&&Math.abs(seated.action)<1e-9);
 assert.ok(Math.abs(start.rootLift)<1e-9);
});

for(const name of ['upper_sleeve','forearm','trouser_thigh','trouser_shin'])test(`${name} is a normalized Y-axis joint skin`,async()=>{
 const bytes=await readFile(new URL(`../dist/assets/models/angler-gull/${name}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const box=new Box3().setFromObject(gltf.scene),size=box.getSize(new Vector3());
 assert.ok(size.y>.9&&size.y<1.1);
 assert.ok(size.x>1.5&&size.z>1.5);
});

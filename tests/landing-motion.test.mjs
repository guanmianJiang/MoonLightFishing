import test from 'node:test';
import assert from 'node:assert/strict';
import {landingPose,landingDynamics,landingFishPose} from '../dist/landing-motion.mjs';

test('landed fish rises in one pull with a small rebound and reaches the angler',()=>{
 const start={x:2.1,y:.55,z:0},hold={x:.65,y:2.2,z:0};
 let previous=start,rebounded=false;
 for(let i=0;i<=32;i++){
  const pose=landingPose(start,hold,i*.1);
  assert.ok(pose.y>=previous.y-.08,'rebound should remain controlled');
  assert.ok(pose.x<=previous.x+.08,'fish should not swing far back out');
  if(pose.y<previous.y-.001)rebounded=true;
  previous=pose;
 }
 assert.ok(rebounded,'the fish should resist and rebound briefly');
 assert.ok(landingPose(start,hold,.82).progress>.35&&landingPose(start,hold,.82).progress<.7);
 const final=landingPose(start,hold,3);
 assert.ok(Math.abs(final.x-hold.x)<1e-9);
 assert.equal(final.y,hold.y);
 assert.equal(final.progress,1);
});

test('large fish makes the angler and rod strain more than a small fish',()=>{
 const small=landingDynamics(.48,.5),large=landingDynamics(.48,3.4);
 assert.ok(large.strain>small.strain*1.5);
 assert.equal(landingDynamics(0,3.4).strain,0);
 assert.ok(Math.abs(landingDynamics(1.05,3.4).recoil)>0);
 assert.ok(Math.abs(landingDynamics(3,3.4).recoil)<.01);
});

test('fish hangs mouth-up after leaving the water and keeps struggling',()=>{
 const towardAngler={x:-1,z:0};
 const submerged=landingFishPose(.2,-.3,3,0,towardAngler);
 const airborne=landingFishPose(1.1,1.2,3,.3,towardAngler);
 const later=landingFishPose(2.6,1.8,3,.3,towardAngler);
 assert.ok(Math.abs(submerged.direction.y)<.05);
 assert.ok(airborne.direction.y>.8,'mouth should be above the tail');
 assert.ok(Math.abs(airborne.tail)>.1,'tail should keep struggling during the lift');
 assert.ok(Math.abs(airborne.struggle)>Math.abs(later.struggle));
});

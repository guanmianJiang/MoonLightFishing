import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {landingPose,landingDynamics,landingFishPose,landingCatchReaction} from '../src/landing-motion.mjs';

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

test('airborne reaction contracts, releases and pauses between three diminishing bursts',()=>{
 const peaks=[.20,.67,1.15].map(age=>landingCatchReaction(age,.15));
 assert.ok(peaks[0].burst>.7&&peaks[1].burst<peaks[0].burst&&peaks[2].burst<peaks[1].burst);
 for(const age of [-1,0,.4,.9,2,100])assert.equal(landingCatchReaction(age,.15).burst,0);
 assert.ok(landingCatchReaction(.13,.15).curl>0&&landingCatchReaction(.27,.15).curl<0,'one contraction relaxes across neutral');
 assert.ok(Math.abs(landingCatchReaction(3,.15).sway)<.001);
});

test('weight stretches the burst rhythm slightly, frame rate never changes event samples and malformed ages stay quiet',()=>{
 const light=landingCatchReaction(.2,.15),heavy=landingCatchReaction(.24,3.35);assert.ok(heavy.burst>light.burst);
 for(const fps of [30,60,120])assert.deepEqual(landingCatchReaction(Math.round(fps*.2)/fps,.15),light);
 for(const age of [NaN,Infinity,-Infinity])assert.deepEqual(landingCatchReaction(age,NaN),{burst:0,curl:0,roll:0,yaw:0,sway:0});
 for(const weight of [NaN,Infinity,-1,1e9])assert.ok(Object.values(landingCatchReaction(.13,weight)).every(Number.isFinite));
 const reduced=landingCatchReaction(.13,.15,true),full=landingCatchReaction(.13,.15);assert.ok(reduced.burst<full.burst*.4&&Math.abs(reduced.curl)<Math.abs(full.curl)*.4);
});

test('event driven hanging stays mouth-up and ignores unrelated global animation time',()=>{
 const a=landingFishPose(1.2,1.5,2,0,{x:-1,z:0},{airAge:.15}),b=landingFishPose(1.2,1.5,2,900,{x:-1,z:0},{airAge:.15});
 assert.deepEqual(a.direction,b.direction);assert.deepEqual(a.reaction,b.reaction);assert.ok(a.direction.y>.9);assert.ok(Math.abs(Math.hypot(...Object.values(a.direction))-1)<1e-12);
});

test('actual normal fight success receives one weight heave while object and empty outcomes skip it',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),line=source.split('\n').find(s=>s.includes('  const landing=reelMotion'));
 for(const [caught,expected] of [[{id:'carp',weight:3},true],[{id:'bottle',weight:3},false],[null,false]]){
  const context=vm.createContext({reelMotion:{},p:{catch:caught,landedFromFight:true},reelAge:.48,landingDynamics,isObjectCatch:c=>c?.id==='bottle'});
  vm.runInContext(line+'\nthis.motion=landing;',context);assert.equal(!!context.motion,expected);if(expected)assert.ok(context.motion.strain>.5);
 }
});

test('actual scene starts airborne rhythm once after the fish bounds clear water, then new catch resets it',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),lines=source.split('\n'),age=lines.find(s=>s.includes('   const airAge=revealAirAt')),gate=lines.find(s=>s.includes('revealAirBounds.setFromObject(revealFish).min.y'));
 let now=100,height=.14;const context=vm.createContext({revealAirAt:null,objectCatch:false,revealFish:{},WATER_LEVEL:.12,Date:{now:()=>now},revealAirBounds:{setFromObject:()=>({min:{y:height}})}});
 vm.runInContext('{'+age+'\n'+gate+'\nthis.age=airAge;}',context);assert.equal(context.revealAirAt,null);assert.equal(context.age,-1);
 height=.16;now=250;vm.runInContext(gate,context);assert.equal(context.revealAirAt,250);
 now=450;vm.runInContext('{'+age+'\n'+gate+'\nthis.age=airAge;}',context);assert.equal(context.revealAirAt,250);assert.equal(context.age,.2);
 context.p={start:2};vm.runInContext(lines.find(s=>s.includes('revealKey=p.start;revealAirAt=null;')),context);assert.equal(context.revealAirAt,null);
 context.objectCatch=true;vm.runInContext(gate,context);assert.equal(context.revealAirAt,null);
});

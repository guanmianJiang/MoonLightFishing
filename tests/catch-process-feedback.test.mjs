import test from 'node:test';
import assert from 'node:assert/strict';
import {catchProcessFeedback,releaseTrajectory,sampleRelease,processCameraCue,processGesture,catchProcessTip,releaseContactReady} from '../src/catch-process-feedback.mjs';
import {fishingUILayout} from '../src/ui/fishing-ui-state.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../src/three.module.js';
import {solveTwoBoneIK} from '../src/two-bone-ik.mjs';
import {supportGripTarget} from '../src/rod-grip.mjs';
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);

test('handling keeps the last grip then releases it continuously; hand follow through finishes near contact',()=>{
 const event=catchProcessFeedback('release',{id:'minnow'},{},{}),flight=.43;
 assert.deepEqual(processGesture(event,0,flight),{hold:1,reach:0,lower:0,offHand:1});
 assert.ok(processGesture(event,.1,flight).reach>.99);
 assert.equal(processGesture(event,flight+.18,flight).reach,0);
 assert.equal(processGesture(event,flight+.4,flight).hold,0);
 const nearEnd=processGesture(event,flight+.4-.001,flight);assert.ok(nearEnd.hold<.00001);
 for(const age of [-1,NaN,Infinity,event.duration,event.duration+1])assert.deepEqual(processGesture(event,age,flight),{hold:0,reach:0,lower:0,offHand:0});
 assert.equal(processGesture(event,.1,flight,true).reach,0);assert.equal(processGesture(event,.1,flight,true).hold,processGesture(event,.1,flight).hold);
 for(const time of [NaN,Infinity,-1,0,10])for(const age of [0,.1,.3,1])assert.ok(Object.values(processGesture(event,age,time)).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
});

test('collecting lowers the free hand while recording keeps the catch presentation',()=>{
 for(const action of ['study','keep','basket']){
  const event=catchProcessFeedback(action,{id:'carp'},{},{}),cue=processGesture(event,event.duration*.6);
  assert.equal(cue.reach,0);assert.ok(cue.hold>0);assert.equal(cue.offHand,cue.hold);
  assert.equal(cue.lower>0,action!=='study');
 }
});

test('actual scene grip starts at the preceding constrained hand position and recovers without invalid joints',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),start=source.indexOf('  if(processing&&processPose){'),end=source.indexOf('  for(let i=0;i<2;i++){placeRod',start),code=source.slice(start,end);
 const shoulders=[new T.Vector3(-.23,.70,.02),new T.Vector3(.23,.70,.02)],target=[new T.Vector3(-.1,.8,.55),new T.Vector3(.2,.73,.52)],poles=[new T.Vector3(-.3,.5,.2),new T.Vector3(.3,.5,.2)];
 const joints=target.map((hand,i)=>solveTwoBoneIK(shoulders[i],hand,poles[i],.34,.38));
 const vec=p=>new T.Vector3(p.x,p.y,p.z),pose={hands:joints.map(j=>vec(j.hand)),elbows:joints.map(j=>vec(j.elbow)),angle:1.4,lean:.12};
 const event=catchProcessFeedback('release',{id:'carp'},{},{}),context=vm.createContext({processing:event,processPose:pose,handlingPose:processGesture(event,0,.43),angle:.68,person:{rotation:{x:0}},handLocal:target.map(h=>h.clone().multiplyScalar(.6)),elbows:poles.map(p=>p.clone()),shoulders,idlePivot:new T.Vector3(),idleYawAxis:new T.Vector3(0,1,0),torsoAimYaw:0,idlePitch:0,T,clamp:T.MathUtils.clamp,solveTwoBoneIK,supportGripTarget,fightPose:null,reelPose:0,state:{},p:null,reelAge:0,lastPresentationPose:null});
 vm.runInContext('function frame(){'+code+'}',context);context.frame();
 for(let i=0;i<2;i++){near(context.handLocal[i].distanceTo(pose.hands[i]),0);assert.ok(context.handLocal[i].distanceTo(shoulders[i])<=.72)}
 near(context.angle,pose.angle);near(context.person.rotation.x,pose.lean);
 context.handlingPose=processGesture(event,.9,.43);context.frame();assert.ok(context.handLocal.every(hand=>hand.toArray().every(Number.isFinite)));
});

test('actual canvas handlers ignore processing input and defer aiming taps until release',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 for(const name of ['pointerdown','pointermove','pointerup']){
  const start=source.indexOf(` renderer.domElement.addEventListener('${name}',e=>{`),end=source.indexOf('\n });',start)+5;assert.ok(start>=0&&end>start);
  let callback,captures=0,starts=0,selections=0;const context=vm.createContext({getState:()=>({catchProcessEvent:{action:'release'}}),renderer:{domElement:{addEventListener(_name,fn){callback=fn},setPointerCapture(){captures++}}},pointers:new Map([[7,[0,0]]]),drag:{moved:true},aimPointer:null,startAimPointer(){starts++},selectAimWater(){selections++},readyWaterGesture:()=> 'tap'});
  vm.runInContext(source.slice(start,end),context);callback({pointerId:7,button:0});assert.equal(captures,0);assert.equal(starts,0);assert.equal(selections,0);
  context.getState=()=>({aiming:true});context.pointers=new Map(name==='pointerdown'?[]:[[7,[120,200]]]);context.aimPointer=name==='pointerdown'?null:{id:7,startX:120,startY:200,startWater:[1,2],dragging:false};callback({pointerId:7,button:0,clientX:120,clientY:200});
  assert.equal(starts,name==='pointerdown'?1:0);assert.equal(selections,name==='pointerup'?1:0);assert.equal(captures,name==='pointerdown'?1:0);
 }
});

test('water contact is consumed once and hidden or stale frames cannot replay its impact',()=>{
 const plan=releaseTrajectory([0,1,0],[0,.12,2]);
 assert.equal(releaseContactReady(plan,plan.flightTime-.001),false);assert.equal(releaseContactReady(plan,plan.flightTime+.05),true);
 assert.equal(releaseContactReady(plan,plan.flightTime+.06,true),false);assert.equal(releaseContactReady(plan,plan.flightTime+.06,false,true),false);
 assert.equal(releaseContactReady(plan,plan.flightTime+.19),false);assert.equal(releaseContactReady(plan,NaN),false);
});

test('release accelerates down under gravity and intersects the requested water point',()=>{
 const plan=releaseTrajectory([1,1.5,2],[3,.12,4],.1);
 const a=sampleRelease(plan,.1),b=sampleRelease(plan,.2);
 near(b.velocity[1]-a.velocity[1],-1.18);
 const impact=sampleRelease(plan,plan.flightTime);impact.position.forEach((v,i)=>near(v,plan.end[i]));
 const before=sampleRelease(plan,plan.flightTime-1e-7),after=sampleRelease(plan,plan.flightTime+1e-7);
 before.position.forEach((v,i)=>near(v,after.position[i],1e-5));before.velocity.forEach((v,i)=>near(v,after.velocity[i],1e-4));
 assert.ok(impact.velocity[1]<-5);assert.equal(before.phase,'air');assert.equal(impact.phase,'entry');
});
test('mass changes impact size without making heavy fish fall faster',()=>{
 const small=releaseTrajectory([0,1.8,0],[0,.12,2],.05),large=releaseTrajectory([0,1.8,0],[0,.12,2],4);
 assert.equal(small.flightTime,large.flightTime);assert.deepEqual(sampleRelease(small,.3).position,sampleRelease(large,.3).position);
 assert.ok(large.impactStrength>small.impactStrength);assert.ok(large.impactStrength<=.98);
});
test('fish consume entry momentum before swimming away; objects settle without active swimming',()=>{
 const fish=releaseTrajectory([0,1.4,0],[0,.12,2]),object=releaseTrajectory([0,1.4,0],[0,.12,2],1,true);
 const a=sampleRelease(fish,fish.flightTime+.05),b=sampleRelease(fish,fish.flightTime+.5);
 assert.ok(b.velocity[1]>a.velocity[1]);assert.ok(b.position[1]<.12);assert.equal(b.phase,'swim');assert.ok(b.immersion>.9);
 assert.equal(sampleRelease(object,object.flightTime+.5).phase,'sink');assert.ok(sampleRelease(object,object.flightTime+.9).velocity[2]<.01);
 assert.equal(sampleRelease(fish,fish.flightTime+1.1).visible,false);
});
test('invalid inputs remain finite, zero lateral travel stays stationary and negative ages preserve start',()=>{
 for(const args of [[null,[NaN,0,0],NaN],[[-1,-3,0],[0,.12,2],Infinity]]){
 const plan=releaseTrajectory(...args);assert.ok(Number.isFinite(plan.flightTime));for(const age of [-2,NaN,Infinity,100])assert.ok(sampleRelease(plan,age).position.every(Number.isFinite));
 }
 const plan=releaseTrajectory([0,1,0],[0,.12,0]);assert.deepEqual(sampleRelease(plan,-1).position,plan.start);assert.equal(sampleRelease(plan,1).position[0],0);
});
test('tips use the actual settlement facts, distinguish objects, and have separate action copy',()=>{
 const result={text:'追踪位已满，本次只改变鱼群数量。'},caught={id:'minnow',weight:.1};
 const event=catchProcessFeedback('release',caught,{name:'白条'},result,1000);
 assert.match(catchProcessTip(event).hint,/松手/);assert.equal(catchProcessTip(event,true).hint,result.text);
 const object=catchProcessFeedback('release',{id:'bottle'}, {object:true}, {text:'已放回原位置。'});
 assert.doesNotMatch(catchProcessTip(object).hint,/游|追踪/);assert.match(catchProcessTip(object,true).title,/挂物/);
 const events=['study','keep','basket'].map(action=>catchProcessFeedback(action,caught,{},result));assert.equal(new Set(events.map(e=>e.title)).size,3);
 assert.equal(catchProcessFeedback('invalid',caught,{},result),null);assert.equal(catchProcessFeedback('release',null,{},result),null);
});
test('handling camera weights fade continuously and reduced motion preserves framing without added shifts',()=>{
 const event=catchProcessFeedback('release',{id:'minnow'}, {},{});
 assert.equal(processCameraCue(event,0).weight,1);assert.equal(processCameraCue(event,event.duration).weight,0);
 for(const age of [-1,NaN,Infinity,event.duration+.1])assert.equal(processCameraCue(event,age).weight,0);
 const reduced=processCameraCue(event,.5,true);assert.equal(reduced.push,0);assert.equal(reduced.side,0);
 assert.deepEqual(processCameraCue({duration:NaN},.2),{weight:0,push:0,side:0});
 assert.equal(fishingUILayout({processing:true}).mode,'processing');assert.equal(fishingUILayout({processing:true}).canExpandRoute,false);
});

test('the actual scene handling block moves existing meshes for every choice and emits contact once',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),start=source.indexOf('  const process=state.catchProcessEvent'),end=source.indexOf('  cameraUpdate(state,dt);',start),code=source.slice(start,end);
 assert.ok(start>=0&&end>start);
 for(const action of ['study','keep','basket','release']){
  const event=catchProcessFeedback(action,{id:'carp',weight:2},{}, {},1000),model=new T.Group();model.userData.tail=new T.Group();
  const origin=new T.Vector3(0,1.3,0),plan=releaseTrajectory(origin.toArray(),[0,.12,2],2);let contacts=0,splashes=0,age=.5;
  const context=vm.createContext({state:{catchProcessEvent:event,onReleaseLand:()=>contacts++},Date:{now:()=>1000+age*1000},releaseFish:model,releaseKey:1000,processPlan:plan,processOrigin:origin,processRotation:new T.Quaternion(),processVelocity:new T.Vector3(),processSide:new T.Vector3(1,0,0),releaseSplashed:false,animatedSpecimens:new Set(),T,clamp:T.MathUtils.clamp,sampleRelease,releaseContactReady,t:1,dt:.016,document:{hidden:false},setFishImmersion(){},animateFish(){},splash(){splashes++}});
  vm.runInContext('function frame(){'+code+'}',context);context.frame();assert.ok(model.position.toArray().every(Number.isFinite));
  if(action==='keep'||action==='basket')assert.ok(model.position.y<origin.y,'collection choices actually lower the fish');
  if(action==='release'){age=plan.flightTime+.03;context.frame();context.frame();assert.equal(contacts,1);assert.equal(splashes,1);event.object=true;context.frame();assert.equal(model.userData.tail.rotation.y,0)}
  context.state.catchProcessEvent=null;context.frame();assert.equal(model.visible,false);
 }
});

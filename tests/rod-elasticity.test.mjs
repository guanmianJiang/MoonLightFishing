import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Vector3,PerspectiveCamera,MathUtils} from '../src/three.module.js';
import {stepRodSpring,writeRodCurve,rodStoredEnergy,rodCameraBeat,frameRodCamera,lossLeanTarget} from '../src/rod-elasticity.mjs';
import {lostFightRecoil} from '../src/angler-feedback.mjs';
const points=()=>Array.from({length:28},()=>new Vector3());

test('rod loads promptly, relaxes continuously and has the same response at 30/60/120 Hz',()=>{
 const states=[];for(const fps of [30,60,120]){let s={position:0,velocity:0};for(let i=0;i<fps*.2;i++)s=stepRodSpring(s.position,s.velocity,1.8,1/fps);assert.ok(s.position>1.6&&s.position<2,'clear loading within 200 ms');states.push(s);}
 for(const s of states)assert.ok(Math.abs(s.position-states[0].position)<1e-12&&Math.abs(s.velocity-states[0].velocity)<1e-12);
 const s=states[0],first=stepRodSpring(s.position,s.velocity,.04,0);assert.deepEqual(first,s);
 const unloaded=stepRodSpring(s.position,s.velocity,.04,.1);assert.ok(unloaded.position<s.position*.7&&unloaded.velocity<0,'unloading keeps momentum but clearly relaxes within 100 ms');
});

test('extreme loading and reverse recoil preserve the shaft length and a rigid handhold',()=>{
 const start=new Vector3(-1,1.4,2),axis=new Vector3(0,.9,.4).normalize(),pull=new Vector3(1,-1,4).normalize();
 for(const bend of [0,.2,1,3.5,6,-.5,-2.3]){
  const p=writeRodCurve(points(),start,axis,pull,bend,.4);let length=0;for(let i=1;i<p.length;i++)length+=p[i].distanceTo(p[i-1]);
  assert.ok(Math.abs(length-3.55)<1e-12);assert.deepEqual(p[0],start);
  for(let i=1;i<5;i++)assert.ok(p[i].clone().sub(p[i-1]).normalize().distanceTo(axis)<1e-10,'support hand stays on a straight butt section');
  assert.ok(p.at(-1).distanceTo(start)<=3.55+1e-10);
 }
});

test('bending follows lateral load, reverses on unload, and cannot turn the shaft into a stretched line',()=>{
 const origin=new Vector3(),axis=new Vector3(0,1,0);
 const right=writeRodCurve(points(),origin,axis,{x:1,y:-1,z:0},1).at(-1),left=writeRodCurve(points(),origin,axis,{x:-1,y:-1,z:0},1).at(-1),recoil=writeRodCurve(points(),origin,axis,{x:1,y:-1,z:0},-1).at(-1);
 assert.ok(right.x>.5&&left.x<-.5&&recoil.x<-.5);assert.ok(right.distanceTo(origin)<3.55);
});

test('loss starts at the actual loaded curve before the conserved length rod snaps across neutral',()=>{
 const start=new Vector3(),axis=new Vector3(0,Math.sin(1.32),Math.cos(1.32)),pull=new Vector3(0,-1,1).normalize();
 const before=writeRodCurve(points(),start,axis,pull,1.8*1.45,0),recoil=lostFightRecoil(0,1.8,1.32,.82,'line-break',.4,.1);
 const first=writeRodCurve(points(),start,axis,pull,recoil.bend*1.45,0);assert.ok(first.every((p,i)=>p.distanceTo(before[i])<1e-12));
 const snap=lostFightRecoil(.09,1.8,1.32,.82,'line-break');assert.ok(snap.bend<0);assert.ok(rodStoredEnergy(1.8,.4)>rodStoredEnergy(.2,0)*5);
 assert.equal(rodStoredEnergy(0,0),0);assert.equal(rodCameraBeat(18,true),0);assert.ok(Math.abs(rodCameraBeat(1e5))<=.065);
});

test('degenerate directions, invalid time and excessive numbers remain finite',()=>{
 for(const values of [[NaN,Infinity,NaN,NaN],[1e308,-1e308,1e308,10],[.5,1,.2,-1]])assert.ok(Object.values(stepRodSpring(...values)).every(Number.isFinite));
 for(const axis of [{x:0,y:1,z:0},{x:0,y:0,z:0},{x:NaN,y:Infinity,z:0}]){const p=writeRodCurve(points(),{x:NaN,y:1,z:Infinity},axis,axis,NaN,Infinity);assert.ok(p.every(v=>v.toArray().every(Number.isFinite)));}
});

test('actual scene rod block uses one fixed-length curve and loss captures the last force direction',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),start=source.indexOf('  lastRodPull.copy(pull);'),end=source.indexOf('\n',start),p=points(),anchor=new Vector3();
 const ctx=vm.createContext({lastRodPull:new Vector3(),pull:new Vector3(0,-1,1),writeRodCurve,rodPoints:p,start:new Vector3(1,1,1),rodDirection:new Vector3(0,1,0),bend:2,activeFight:{},lossRecoil:null,state:{revealing:false},rodLag:0,rodGeo:{},updateTube(){},lineAnchor:anchor,tip:new Vector3()});
 vm.runInContext(source.slice(start,end),ctx);assert.ok(anchor.distanceTo(p.at(-1))<1e-9);assert.ok(anchor.distanceTo(ctx.start)<3.55);assert.match(source,/pose:lastFightPose,pull:lastRodPull\.clone\(\)/);
});

test('portrait and landscape frame the actual fixed-length bent and rebound silhouettes',()=>{
 for(const [width,height] of [[390,844],[320,568],[844,390]])for(const bend of [0,2.8,-2.3]){
  const p=writeRodCurve(points(),new Vector3(0,1.6,0),new Vector3(0,1,.1),new Vector3(0,-1,1),bend);
  const shot={position:new Vector3(3,2.35,-3.2),aim:new Vector3(0,.5,2)};
  const original=shot.position.clone().sub(shot.aim).normalize(),target=shot.aim.clone();frameRodCamera(shot,p,width/height,60,1.3);
  assert.deepEqual(shot.aim,target);assert.ok(original.distanceTo(shot.position.clone().sub(target).normalize())<1e-12);
  const camera=new PerspectiveCamera(60,width/height,.01,100);camera.zoom=1.3;camera.position.copy(shot.position);camera.lookAt(shot.aim);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const point of p){const q=point.clone().project(camera);assert.ok(Math.abs(q.x)<=.86001&&Math.abs(q.y)<=.82001&&q.z<1);}
 }
 const shot={position:new Vector3(3,2,1),aim:new Vector3()};const before=shot.position.clone();frameRodCamera(shot,points(),NaN,60);assert.deepEqual(shot.position,before);
});

test('actual loss lean converges once per frame without accumulating recoil or changing across frame rates',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),line=source.split('\n').find(s=>s.includes('person.rotation.x=T.MathUtils.damp(person.rotation.x,lossRecoil?'));
 const results=[];for(const fps of [30,60,120]){
  const ctx=vm.createContext({T:{MathUtils},person:{rotation:{x:-.2}},lossRecoil:{kick:1.8},lossLeanTarget,reelMotion:{lean:.04},standMotion:{lean:0},castMotion:null,dt:1/fps});
  for(let i=0;i<fps;i++)vm.runInContext(line,ctx);results.push(ctx.person.rotation.x);assert.ok(Math.abs(ctx.person.rotation.x)<.4);
 }
 for(const x of results)assert.ok(Math.abs(x-results[0])<1e-12);
 assert.equal(lossLeanTarget(NaN,Infinity),0);assert.ok(Math.abs(lossLeanTarget(1e9,1e9))<=.65);
});

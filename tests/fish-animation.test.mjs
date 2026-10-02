import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as T from '../src/three.module.js';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';
import {fishAnimationTarget,createFishAnimation} from '../src/fish-animation.mjs';
import {createFishBodyRig,fishBodyWave} from '../src/fish-body-rig.mjs';
import {animateSpecimen,disposeSpecimenAnimation,handoffSpecimen} from '../src/fishing-art.js';
import {makeSpecimen} from '../src/scene-assets.js';
import {assetAnchorLocal,fishMouthWorld,alignFishMouth} from '../src/fish-attachment.mjs';

test('stages use real effort, species pace and low holding amplitude; objects remain still',()=>{
 const quiet=fishAnimationTarget({id:'carp',weight:2},{stage:'approach'}),held=fishAnimationTarget({id:'carp',weight:2},{stage:'held'});
 const fight=fishAnimationTarget({id:'carp',weight:2},{stage:'fight',effort:1,surge:1});
 assert.ok(fight.amplitude>quiet.amplitude*3&&held.amplitude<quiet.amplitude);
 assert.ok(fishAnimationTarget({id:'minnow',weight:.05},{stage:'swim'}).speed>fishAnimationTarget({id:'carp',weight:4},{stage:'swim'}).speed*1.3);
 assert.equal(fishAnimationTarget({id:'carp'},{stage:'hooked',hookAge:0}).amplitude,quiet.amplitude);
 for(const caught of [{id:'bottle'},{id:'bell'},{id:'custom',object:true}])for(const stage of ['fight','landing','held','swim'])assert.deepEqual(fishAnimationTarget(caught,{stage}),{speed:0,amplitude:0,fin:0,breath:0,curl:0});
});

test('transitions integrate the existing phase without snapping and reject invalid frame time',()=>{
 const driver=createFishAnimation({id:'carp',weight:2});let a;
 for(let i=0;i<100;i++)a=driver.update({stage:'approach'},.016);
 const b=driver.update({stage:'fight',effort:1,surge:1},0);assert.deepEqual(a,b);
 const c=driver.update({stage:'fight',effort:1,surge:1},.016);
 assert.ok(c.amplitude-a.amplitude<.014);assert.ok((c.phase-a.phase+Math.PI*2)%(Math.PI*2)<.25);
 for(const dt of [NaN,-1,Infinity])assert.deepEqual(driver.update({stage:'fight',effort:1,surge:1},dt),c);
 assert.ok(Object.values(driver.update({stage:'swim'},1e6)).every(Number.isFinite));
 const reduced=createFishAnimation({id:'carp'});for(let i=0;i<100;i++)a=reduced.update({stage:'fight',effort:1},.016,true);assert.ok(a.amplitude<.06);
});

test('centreline displacement has the analytic derivative used to correct normals and locks the head',()=>{
 const pose={phase:1.2,amplitude:.1,curl:.06};for(const x of [-.7,-.4,0,.1]){
  const w=fishBodyWave(x,1.6,1,pose),eps=1e-5,derivative=(fishBodyWave(x+eps,1.6,1,pose).offset-fishBodyWave(x-eps,1.6,1,pose).offset)/(2*eps);
  assert.ok(Math.abs(derivative-w.slope)<1e-7);
 }
 assert.deepEqual(fishBodyWave(.7,1.6,1,pose),{offset:0,slope:0});
});

for(const id of ['carp','minnow','perch','catfish','oldgold','moon','shrimp'])test(`${id}: shipped mesh bends without moving the mouth, altering cache, adding meshes or losing bounds`,async()=>{
 const buffer=await readFile(new URL(`../public/assets/models/specimens/${id}.glb`,import.meta.url)),source=(await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene;
 const model=source.clone(true),before=[];source.traverse(o=>{if(o.isMesh)before.push([o,Array.from(o.geometry.attributes.position.array),o.geometry,o.material]);});
 if(id!=='shrimp'){
  let triangles=0;const normals=new Set();source.getObjectByName(id+'_Body').traverse(o=>{if(!o.isMesh)return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;const n=o.geometry.attributes.normal;for(let i=0;i<n.count;i++)normals.add([n.getX(i),n.getY(i),n.getZ(i)].map(v=>v.toFixed(3)).join(','));});
  assert.ok(triangles>=1500&&triangles<1600,'the shipped body retains the rounded 32 by 24 profile');assert.ok(normals.size>500,'body normals remain smooth around the profile');
 }
 const mouth=assetAnchorLocal(model,'MouthAnchor'),rig=createFishBodyRig(model,{id}),tail=model.getObjectByName(id+'_Tail'),tip=tail.children[0];
 const tipBefore=Array.from(tip.geometry.attributes.position.array);rig.apply({phase:1.3,amplitude:.12,curl:.18,fin:.22,breath:.012});
 assert.ok(assetAnchorLocal(model,'MouthAnchor').distanceTo(mouth)<1e-8);
 assert.notDeepEqual(Array.from(tip.geometry.attributes.position.array),tipBefore);
 assert.ok(rig.vertexCount>30&&rig.vertexCount<18000);
 let meshes=0,released=0;
 model.traverse(o=>{if(!o.isMesh)return;meshes++;const {position,normal}=o.geometry.attributes;assert.ok(Array.from(position.array).every(Number.isFinite));assert.ok(Array.from(normal.array).every(Number.isFinite));
  for(let i=0;i<position.count;i++){const n=new T.Vector3().fromBufferAttribute(normal,i);assert.ok(Math.abs(n.length()-1)<1e-5);}
  if(!before.some(([, ,g])=>g===o.geometry)){o.geometry.addEventListener('dispose',()=>released++);for(let i=0;i<position.count;i++)assert.ok(o.geometry.boundingSphere.containsPoint(new T.Vector3().fromBufferAttribute(position,i)));}
 });assert.equal(meshes,before.length);
 for(const [o,positions,geometry,material] of before){assert.deepEqual(Array.from(o.geometry.attributes.position.array),positions);assert.equal(o.geometry,geometry);assert.equal(o.material,material);}
 // Runtime wrapper and rotated/scaled hook alignment are unaffected by deformation.
 const root=new T.Group();root.add(model);model.rotation.y=Math.PI;root.userData.mouthLocal=assetAnchorLocal(root,'MouthAnchor');root.scale.setScalar(.55);root.rotation.set(.2,1,-.6);const hook=new T.Vector3(2,.3,4);alignFishMouth(root,hook);assert.ok(fishMouthWorld(root).distanceTo(hook)<.001);
 rig.dispose();const n=released;assert.ok(n>0);rig.dispose();assert.equal(released,n);
});

test('landing pulses bend the body clearly, settle between kicks, and carry across held without resetting phase',()=>{
 const caught={id:'carp',weight:.15},peak=fishAnimationTarget(caught,{stage:'landing',airAge:.2}),quiet=fishAnimationTarget(caught,{stage:'landing',airAge:.4});
 assert.ok(peak.amplitude>quiet.amplitude*5);assert.ok(fishAnimationTarget(caught,{stage:'landing',airAge:.13}).curl>.02);
 assert.deepEqual(fishAnimationTarget(caught,{stage:'held',airAge:.13}),fishAnimationTarget(caught,{stage:'landing',airAge:.13}));
 const driver=createFishAnimation(caught);let a;for(let i=0;i<10;i++)a=driver.update({stage:'landing',airAge:.13},.016);
 const b=driver.update({stage:'held',airAge:.13},0);assert.deepEqual(a,b);
 for(let i=0;i<120;i++)a=driver.update({stage:'held',airAge:3},1/60);assert.ok(Math.abs(a.curl)<1e-6&&a.amplitude<.017);
 const reduced=createFishAnimation(caught);for(let i=0;i<20;i++)a=reduced.update({stage:'landing',airAge:.13},.016,true);assert.ok(Math.abs(a.curl)<Math.abs(fishAnimationTarget(caught,{stage:'landing',airAge:.13}).curl)*.4);
 for(const id of ['bottle','bell'])assert.equal(fishAnimationTarget({id},{stage:'landing',airAge:.13}).curl,0);
});

test('late shipped fish preserves the exact mouth, scaled pose and living phase instead of restarting at its centre',async()=>{
 const bytes=await readFile(new URL('../public/assets/models/specimens/carp.glb',import.meta.url)),asset=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 asset.userData.mouthLocal=assetAnchorLocal(asset,'MouthAnchor');
 const old=makeSpecimen('carp');old.position.set(2,1.8,3);old.rotation.set(.6,.9,-.2);old.scale.setScalar(.58);old.visible=false;animateSpecimen(old,{id:'carp',weight:2},{stage:'landing',airAge:.13},.08);
 const mouth=fishMouthWorld(old),driver=old.userData.fishAnimation,before=driver.update({},0);
 assert.equal(handoffSpecimen(old,asset),asset);assert.ok(fishMouthWorld(asset).distanceTo(mouth)<1e-8);assert.ok(asset.quaternion.angleTo(old.quaternion)<1e-7);assert.deepEqual(asset.scale,old.scale);assert.equal(asset.visible,false);assert.equal(asset.userData.fishAnimation,driver);
 disposeSpecimenAnimation(old);assert.deepEqual(asset.userData.fishAnimation.update({},0),before);assert.equal(handoffSpecimen(asset,null),asset);
});

test('actual late preload promotes both fight and reveal once, and stale or processed catches cannot replace a fish',async()=>{
 const source=await readFile(new URL('../src/scene.js',import.meta.url),'utf8'),line=source.split('\n').find(s=>s.includes('preparedFish=asset;if(fightKey===key'));
 for(const stale of [false,'key','pending']){
  const old=makeSpecimen('carp'),asset=makeSpecimen('carp'),calls=[];old.position.y=1.8;animateSpecimen(old,{id:'carp'},{stage:'landing',airAge:.13},.05);
  let resolve;const ctx=vm.createContext({p:{start:1,catch:{id:'carp'}},specimenIds:new Set(['carp']),preparedFishKey:null,preparedFish:null,fightKey:1,fightFish:old,revealFish:old,animatedSpecimens:new Set([old]),loadSpecimen:()=>new Promise(r=>resolve=r),handoffSpecimen,disposeSpecimenAnimation,scene:{remove:m=>calls.push(['remove',m]),add:m=>calls.push(['add',m])},getState:()=>({pending:stale==='pending'?null:{start:1}})});
  vm.runInContext(line,ctx);if(stale==='key')ctx.preparedFishKey=2;resolve(asset);await Promise.resolve();await Promise.resolve();
  if(stale){assert.equal(ctx.fightFish,old);assert.equal(calls.length,0);}else{assert.equal(ctx.fightFish,asset);assert.equal(ctx.revealFish,asset);assert.equal(ctx.animatedSpecimens.has(old),false);assert.equal(old.userData.fishBodyRig,undefined);assert.deepEqual(calls.map(c=>c[0]),['remove','add']);}
 }
});

test('fallback deformation uses local length regardless of scene scale and rotation, and pins eye positions',()=>{
 const a=makeSpecimen('carp'),b=makeSpecimen('carp');b.scale.setScalar(.45);b.rotation.set(.3,1.1,-.7);b.position.set(2,1,4);
 const x=createFishBodyRig(a,{headDirection:-1}),y=createFishBodyRig(b,{headDirection:-1}),pose={phase:1.4,amplitude:.08,fin:.1};x.apply(pose);y.apply(pose);
 const p=a.children[0].geometry.attributes.position.array,q=b.children[0].geometry.attributes.position.array;assert.ok(p.every((v,i)=>Math.abs(v-q[i])<1e-6));
 x.dispose();y.dispose();
 const object=makeSpecimen('bottle');animateSpecimen(object,{id:'bottle'},{stage:'fight'},.1);assert.equal(object.userData.fishBodyRig,undefined);
});

test('cached specimens can retire and animate again; shrimp bends vertically and fish bends sideways',()=>{
 const fish=makeSpecimen('carp'),original=fish.children[0].geometry;
 animateSpecimen(fish,{id:'carp'},{stage:'fight',effort:1},.1);assert.notEqual(fish.children[0].geometry,original);
 disposeSpecimenAnimation(fish);assert.equal(fish.children[0].geometry,original);
 animateSpecimen(fish,{id:'carp'},{stage:'swim'},.1);assert.notEqual(fish.children[0].geometry,original);disposeSpecimenAnimation(fish);
 const shrimp=makeSpecimen('shrimp'),mesh=shrimp.children[3],before=Array.from(mesh.geometry.attributes.position.array),rig=createFishBodyRig(shrimp,{id:'shrimp',headDirection:-1});
 rig.apply({phase:1.2,amplitude:.1});const after=mesh.geometry.attributes.position.array;
 assert.ok(after.some((v,i)=>i%3===1&&Math.abs(v-before[i])>.001));assert.ok(after.every((v,i)=>i%3!==2||Math.abs(v-before[i])<1e-6));rig.dispose();
});

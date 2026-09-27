import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../src/three.module.js';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';
import {FERRY_ROUTES,gullRoute} from '../src/coastal-motion.js';
for(const name of ['angler_body','seagull'])test(`${name} loads with valid geometry and semantic parts`,async()=>{
 const bytes=await readFile(new URL(`../public/assets/models/angler-gull/${name}.glb`,import.meta.url));
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 let tris=0;scene.traverse(o=>{if(o.isMesh){assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3}});assert.ok(tris>1000&&tris<24000);
 if(name==='seagull'){
  for(const n of ['Wing_L','Wing_R','Wrist_L','Wrist_R','Gull_tail'])assert.ok(scene.getObjectByName(n),n);
  assert.equal(scene.getObjectByName('Wrist_L').parent,scene.getObjectByName('Wing_L'));
  const wing=scene.getObjectByName('Wing_L'),tip=scene.getObjectByName('Wrist_L');scene.updateMatrixWorld(true);const before=tip.getWorldPosition(new T.Vector3());wing.rotation.x=.6;scene.updateMatrixWorld(true);assert.ok(tip.getWorldPosition(new T.Vector3()).distanceTo(before)>.1);
 }else for(const n of ['Head','Tailored_jacket','Backpack','Boot','Eye'])assert.ok(scene.getObjectByName(n),n);
});
test('both ferries stay in the default desktop and portrait shoulder view over a complete route',()=>{
 for(const aspect of [16/9,9/16])for(const aiming of [true,false]){
  const origin=new T.Vector3(-1.25,1.35,.1),spot=new T.Vector3(-7.8,.12,4.6),forward=spot.clone().sub(origin);forward.y=0;forward.normalize();const right=new T.Vector3(forward.z,0,-forward.x),camera=new T.PerspectiveCamera(42,aspect,.1,2400);
  camera.position.copy(origin).addScaledVector(forward,aiming?-5.5:-6.05).addScaledVector(right,aspect<.8?.78:2.05);camera.position.y=aiming?2.85:2.38;const aim=spot.clone().lerp(origin,aiming?.23:.17);aim.y=aiming?.20:.13;camera.lookAt(aim);camera.updateMatrixWorld();
  for(const route of FERRY_ROUTES)for(let i=0;i<=100;i++){
   const x=route.position[0]+Math.sin(i/100*Math.PI*2)*route.range,p=new T.Vector3(x,1,route.position[2]).project(camera);
   assert.ok(Math.abs(p.x)<.85&&Math.abs(p.y)<.8&&p.z<1,`${route.name}, aspect ${aspect}: ${p.toArray()}`);
  }
 }
});
test('gull routes move offshore over a longer corridor without reversing at launch',()=>{
 for(const value of [0,.25,.5,.75,.999]){const r=gullRoute(()=>value);assert.equal(Math.abs(r.fromX)*2,96);assert.ok(r.startZ>=12&&r.exitZ>=r.startZ+10);assert.ok(r.dur>=30&&r.dur<=40);assert.ok(r.fromX*r.dir<0)}
});

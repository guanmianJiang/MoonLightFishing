import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../src/three.module.js';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';
import {createAnglerFaceRig} from '../src/angler-face-rig.mjs';
import {installFishingArt} from '../src/fishing-art.js';
import {anglerExpressionTarget} from '../src/angler-expression.mjs';
async function asset(){const b=await readFile(new URL('../public/assets/models/angler-gull/angler_body.glb',import.meta.url));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene}

test('actual GLB eyes, both brows and mouth express emotion without changing cached source assets',async()=>{
 const source=await asset(),root=source.clone(true),before=[];source.traverse(o=>{if(o.isMesh)before.push([o,[...o.geometry.attributes.position.array],o.material])});
 const count=r=>{let n=0;r.traverse(o=>n+=!!o.isMesh);return n},meshCount=count(root),rig=createAnglerFaceRig(root),eye=root.getObjectByName('Eye'),brows=[];root.traverse(o=>{if(/^Brow/.test(o.name))brows.push(o)});
 const mouth=root.getObjectByName('Smile');assert.equal(brows.length,2);assert.equal(count(root),meshCount);
 let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3});assert.ok(triangles<24000);
 rig.apply(anglerExpressionTarget({outcomeEvent:{kind:'line-break',at:0}},100));assert.ok(eye.scale.y>1.3);assert.ok(brows[0].position.y>1.07);
 const shock=[...mouth.geometry.attributes.position.array];rig.apply(anglerExpressionTarget({catchProcessEvent:{action:'release'}}));assert.ok(eye.scale.y<1);assert.notDeepEqual([...mouth.geometry.attributes.position.array],shock);
 const version=mouth.geometry.attributes.position.version;rig.apply(anglerExpressionTarget({catchProcessEvent:{action:'release'}}));assert.equal(mouth.geometry.attributes.position.version,version);
 for(const cue of [{eyeOpen:0},{smile:-.4,browTilt:-.2},{mouthOpen:.5},{eyeOpen:NaN,mouthOpen:Infinity,smile:-100}]){
  rig.apply(cue);assert.ok([...mouth.geometry.attributes.position.array,...mouth.geometry.attributes.normal.array].every(Number.isFinite));
  const positions=mouth.geometry.attributes.position;for(let i=0;i<positions.count;i++)assert.ok(mouth.geometry.boundingSphere.containsPoint(new T.Vector3().fromBufferAttribute(positions,i)));
 }
 for(const [part,positions,material] of before){assert.deepEqual([...part.geometry.attributes.position.array],positions);assert.equal(part.material,material)}
 const own=[mouth.geometry,...brows.map(b=>b.geometry)];let releases=0;own.forEach(g=>g.addEventListener('dispose',()=>releases++));rig.dispose();rig.dispose();rig.apply({});assert.equal(releases,3);
});

test('blink closes all eye components around the same lid center and restores them without drift',async()=>{
 const root=await asset(),rig=createAnglerFaceRig(root),eye=root.getObjectByName('Eye'),white=root.getObjectByName('Eye_white'),highlight=root.getObjectByName('Eye_highlight'),base=highlight.position.y;
 rig.apply({eyeOpen:.065});assert.equal(white.visible,false);assert.equal(highlight.visible,false);assert.ok(eye.visible);assert.ok(Math.abs(highlight.position.y-white.position.y)<.001);
 for(let i=0;i<10;i++){rig.apply({eyeOpen:.2});rig.apply({eyeOpen:1})}assert.equal(highlight.position.y,base);assert.equal(white.visible,true);rig.dispose();
 const empty=createAnglerFaceRig(new T.Group());empty.apply({mouthOpen:1});empty.dispose();
});

test('actual asynchronous art installation applies the latest expression when the face arrives',async()=>{
 const source=await asset(),original=GLTFLoader.prototype.load;let complete;
 GLTFLoader.prototype.load=function(url,onLoad){if(url.includes('angler_body'))complete=onLoad;return this};
 try{
  const person=new T.Group(),art=installFishingArt({scene:new T.Scene(),person,idleLure:new T.Group(),bobber:new T.Group(),caughtHook:new T.Group(),terrainY:()=>0,hatParts:[],hookParts:[new T.Group(),new T.Group()],bodyParts:[],upperArms:[],foreArms:[],thighs:[],shins:[]});
  art.setExpression({eyeOpen:1.38,mouthOpen:1,browLift:.017});art.setExpression({eyeOpen:.88,smile:.72});complete({scene:source});await Promise.resolve();await Promise.resolve();
  const head=person.getObjectByName('IdleHeadPivot'),eye=head.getObjectByName('Eye');assert.equal(eye.scale.y,.88);assert.equal(head.getObjectByName('Smile').geometry.attributes.position.count,147);
  art.setIdleLook(.12,.20,.10);assert.equal(head.rotation.y,.20);art.dispose();assert.equal(source.getObjectByName('Eye').scale.y,1);
 }finally{GLTFLoader.prototype.load=original}
});

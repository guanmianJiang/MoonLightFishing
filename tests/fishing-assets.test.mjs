import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';
import {Box3,Group,Vector3} from '../src/three.module.js';
import {FISH,BAITS} from '../src/data/catalog.mjs';
import {assetAnchorLocal,alignFishMouth,fishMouthWorld} from '../src/fish-attachment.mjs';

for(const [folder,names] of [
 ['coastal-garden',['dune_grass','beach_bloom','driftwood','shell_pair']],
 ['specimens',FISH.filter(item=>!item.object).map(item=>item.id)],
 ['fishing-details',['tackle_box','bait_bucket','field_stool','angler_hat',...BAITS.map(item=>'bait_'+item.id)]]
])for(const name of names)test(`Blender asset ${name}: engine import, finite geometry and budget`,async()=>{
 const data=await readFile(new URL(`../public/assets/models/${folder}/${name}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let triangles=0;
 gltf.scene.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;assert.ok(p.count>0);assert.ok([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;assert.ok(o.geometry.attributes.normal)}});
 assert.ok(triangles>0&&triangles<12000);
 const size=new Box3().setFromObject(gltf.scene).getSize(new Vector3());assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0));
 if(folder==='specimens'){
  assert.ok(gltf.scene.getObjectByName(name+'_Tail'),'tail articulation exported');
  assert.ok(size.x>size.y,'fish retain horizontal silhouette');
  const anchors=[];gltf.scene.traverse(o=>{if(o.name==='MouthAnchor')anchors.push(o)});
  assert.equal(anchors.length,1,'every living catch exports exactly one mouth anchor');
  assert.ok(!anchors[0].isMesh,'the anchor costs no draw call');
  const mouth=anchors[0].getWorldPosition(new Vector3());
  assert.ok(mouth.toArray().every(Number.isFinite)&&mouth.x>0,'the mouth is at the +X head');
  const fish=new Group(),wrapper=new Group(),center=new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
  gltf.scene.position.sub(center);wrapper.add(gltf.scene);wrapper.rotation.y=Math.PI;wrapper.scale.setScalar(1.8/size.x);fish.add(wrapper);
  fish.userData.mouthLocal=assetAnchorLocal(fish,'MouthAnchor');
  assert.ok(fish.userData.mouthLocal.x<-.1,'the runtime fish faces -X with the mouth at its head');
  fish.scale.setScalar(.58);fish.rotation.set(.12,.8,-.42);
  const hook=new Vector3(2,-.3,4);alignFishMouth(fish,hook);
  assert.ok(fishMouthWorld(fish).distanceTo(hook)<.001,'the imported anchor stays on the hook after scaling and rotation');
 }
 if(name.startsWith('bait_')&&name!=='bait_bucket'){
  assert.ok(size.y*.72<.155,'the game-size bait stays smaller than the float');
  const anchors=[];gltf.scene.traverse(o=>{if(o.name==='HookAnchor')anchors.push(o)});
  assert.equal(anchors.length,1,'every bait exports exactly one hook tip anchor');
  assert.ok(!anchors[0].isMesh);
  const tip=anchors[0].getWorldPosition(new Vector3());
  assert.ok(tip.toArray().every(Number.isFinite)&&tip.y<0,'the tip hangs below the attachment eye');
 }
});

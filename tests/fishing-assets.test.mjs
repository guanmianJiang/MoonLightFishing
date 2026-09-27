import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../src/vendor/loaders/GLTFLoader.js';
import {Box3,Vector3} from '../src/three.module.js';

for(const [folder,names] of [
 ['coastal-garden',['dune_grass','beach_bloom','driftwood','shell_pair']],
 ['specimens',['carp','minnow','perch','catfish','oldgold','moon','shrimp']],
 ['fishing-details',['tackle_box','bait_bucket','field_stool','angler_hat','bait_grain','bait_worm','bait_glow']]
])for(const name of names)test(`Blender asset ${name}: engine import, finite geometry and budget`,async()=>{
 const data=await readFile(new URL(`../public/assets/models/${folder}/${name}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let triangles=0;
 gltf.scene.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;assert.ok(p.count>0);assert.ok([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;assert.ok(o.geometry.attributes.normal)}});
 assert.ok(triangles>0&&triangles<12000);
 const size=new Box3().setFromObject(gltf.scene).getSize(new Vector3());assert.ok(size.toArray().every(x=>Number.isFinite(x)&&x>0));
 if(folder==='specimens'){assert.ok(gltf.scene.getObjectByName(name+'_Tail'),'tail articulation exported');assert.ok(size.x>size.y,'fish retain horizontal silhouette')}
 if(name.startsWith('bait_')&&name!=='bait_bucket')assert.ok(size.y<.3,'bait uses metres, not review-board enlargement');
});

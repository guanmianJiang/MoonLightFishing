import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import * as T from '../src/three.module.js';
import {shore,terrainY} from '../src/coast.js';
import {createSeabedScatter} from '../src/seabed-scatter.mjs';
import {installSeabedDetails,seabedRockGeometry,seabedShellGeometry} from '../src/seabed-details.js';

const samplers={shore,terrainY};
test('scatter is sparse, repeatable and inside the submerged playable shelf',()=>{
 const items=createSeabedScatter(samplers);
 assert.deepEqual(items,createSeabedScatter(samplers));
 assert.notDeepEqual(items,createSeabedScatter({...samplers,seed:27}));
 assert.equal(items.filter(item=>item.kind==='rock').length,28);
 assert.equal(items.filter(item=>item.kind==='shell').length,14);
 for(const [i,item] of items.entries()){
  assert.ok(item.x>=-16&&item.x<=12);
  const distance=item.z-shore(item.x),bed=terrainY(item.x,item.z),depth=.14-bed;
  assert.ok(distance>=3&&distance<=17&&depth>=.30&&depth<=2.4);
  assert.ok(!(item.x>-2.8-item.size&&item.x<.4+item.size&&item.z<1.5+item.size));
  assert.ok(item.y<bed&&bed-item.y<item.size*.11);
  assert.ok(item.size>=.15&&item.size<=.38);
  assert.ok(Math.abs(Math.hypot(...item.normal)-1)<1e-12);
  for(const other of items.slice(i+1))assert.ok(Math.hypot(item.x-other.x,item.z-other.z)>=1.1);
 }
 // Less than 3% of the shelf is covered by bounding discs.
 assert.ok(items.reduce((sum,item)=>sum+Math.PI*item.size**2,0)/(28*14)<.03);
});

test('scatter follows slopes and handles empty, invalid or exhausted terrain',()=>{
 assert.throws(()=>createSeabedScatter(),TypeError);
 const plane={shore:()=>-4,terrainY:(x,z)=>-.50-x*.004-z*.025};
 for(const item of createSeabedScatter(plane)){
  assert.ok(Math.abs(item.normal[0]/item.normal[1]-.004)<1e-12);
  assert.ok(Math.abs(item.normal[2]/item.normal[1]-.025)<1e-12);
 }
 assert.deepEqual(createSeabedScatter({...samplers,rockCount:-1,shellCount:NaN}),[]);
 assert.deepEqual(createSeabedScatter({...samplers,rockCount:Infinity,shellCount:0}),[]);
 assert.equal(createSeabedScatter({...samplers,rockCount:2.9,shellCount:0}).length,2);
 assert.ok(createSeabedScatter({...samplers,rockCount:1000,shellCount:1000}).length<=128);
 for(const terrainY of [()=>NaN,()=>Infinity,()=>1,()=>-10])assert.deepEqual(createSeabedScatter({...samplers,terrainY}),[]);
 assert.deepEqual(createSeabedScatter({...samplers,shore:()=>NaN}),[]);
 assert.deepEqual(createSeabedScatter({...samplers,seed:NaN}),createSeabedScatter(samplers));
});

test('seabed geometry and shared batches stay within the mobile budget and dispose',()=>{
 const scene=new T.Scene(),details=installSeabedDetails(scene,shore,terrainY);
 assert.equal(details.batches.length,2);
 let triangles=0;
 for(const batch of details.batches){
  assert.ok(batch.isInstancedMesh);assert.equal(batch.castShadow,false);
  assert.equal(batch.receiveShadow,true);assert.equal(batch.material.transparent,false);
  assert.equal(batch.count,details.layout.filter(item=>`seabed-${item.kind}`===batch.name).length);
  const positions=batch.geometry.attributes.position;
  assert.ok([...positions.array,...batch.geometry.attributes.normal.array,...batch.instanceMatrix.array,...batch.instanceColor.array].every(Number.isFinite));
  triangles+=(batch.geometry.index?.count??positions.count)/3*batch.count;
  batch.geometry.computeBoundingBox();
  assert.ok(batch.geometry.boundingBox.max.y<.55);
 }
 assert.ok(triangles<8000);
 let disposed=0;for(const batch of details.batches){batch.geometry.addEventListener('dispose',()=>disposed++);batch.material.addEventListener('dispose',()=>disposed++);}
 details.dispose();assert.equal(disposed,4);assert.equal(scene.children.length,0);
});

test('shell is a closed fan with a raised dome, rather than a sphere or open plane',()=>{
 const shell=seabedShellGeometry(),p=shell.attributes.position,indices=shell.index.array,edges=new Map();
 const point=i=>`${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
 let volume=0;
 for(let i=0;i<indices.length;i+=3){
  const a=new T.Vector3().fromBufferAttribute(p,indices[i]),b=new T.Vector3().fromBufferAttribute(p,indices[i+1]),c=new T.Vector3().fromBufferAttribute(p,indices[i+2]);
  assert.ok(new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).length()>1e-7);
  volume+=a.dot(b.clone().cross(c))/6;
  for(let j=0;j<3;j++){
   const key=[point(indices[i+j]),point(indices[i+(j+1)%3])].sort().join('|');edges.set(key,(edges.get(key)||0)+1);
  }
 }
 assert.ok([...edges.values()].every(count=>count===2));
 assert.ok(volume>0);
 shell.computeBoundingBox();assert.ok(shell.boundingBox.max.y>.20&&shell.boundingBox.min.y<0);
 shell.dispose();seabedRockGeometry().dispose();
});

function png(path){
 const bytes=readFileSync(new URL(path,import.meta.url)),idat=[];
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 for(let offset=8;offset<bytes.length;){const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(type==='IDAT')idat.push(bytes.subarray(offset+8,offset+8+size));offset+=12+size;}
 return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),raw:inflateSync(Buffer.concat(idat))};
}
test('sand maps have bounded contrast, seamless coarse edges and valid tangent normals',()=>{
 const albedo=png('../public/assets/sand-albedo.png'),normal=png('../public/assets/sand-detail-normal.png');
 for(const map of [albedo,normal]){assert.equal(map.width,512);assert.equal(map.height,512);assert.equal(map.raw.length,(512*3+1)*512);}
 let minimum=255,maximum=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const offset=y*1537+1+x*3,r=albedo.raw[offset];minimum=Math.min(minimum,r);maximum=Math.max(maximum,r);
  assert.ok(normal.raw[offset+2]>=245,'fine sand must not carry large rock-like slopes');
 }
 assert.ok(minimum>=205&&maximum-minimum>18&&maximum-minimum<50);
 for(let y=0;y<512;y++)assert.ok(Math.abs(albedo.raw[y*1537+1]-albedo.raw[y*1537+1+511*3])<15);
 for(let x=0;x<512;x++)assert.ok(Math.abs(albedo.raw[1+x*3]-albedo.raw[511*1537+1+x*3])<15);
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 assert.ok(scene.includes('sandAlbedo.colorSpace=T.SRGBColorSpace'));
 assert.ok(scene.includes('sandNormal.colorSpace=T.NoColorSpace'));
 assert.ok(scene.includes('submergedNormalWeight*normalLod'));
 assert.ok(!scene.includes('bedSand=vec3(.12,.34,.29)'));
 assert.ok(!scene.includes('sandDetailMask=1.-smoothstep'));
});

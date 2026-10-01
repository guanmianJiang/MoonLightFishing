import * as T from './three.module.js';
import {createSeabedScatter} from './seabed-scatter.mjs';

export function seabedRockGeometry(){
 const geometry=new T.IcosahedronGeometry(1,0),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),shape=1+.17*Math.sin(x*3.1+z*2.4+y*1.7);
  p.setXYZ(i,x*shape*1.13,y*.48*(1+.12*Math.sin(z*4.3)),z*shape*.81);
 }
 geometry.computeVertexNormals();return geometry;
}

// Closed fan shell: rounded dome, scalloped lip and broad radial ribs.
export function seabedShellGeometry(){
 const segments=20,rings=5,vertices=[],indices=[];
 for(let side=0;side<2;side++)for(let ring=0;ring<=rings;ring++)for(let segment=0;segment<=segments;segment++){
  const radius=.035+.965*ring/rings,angle=-1.16+segment/segments*2.32;
  const ribs=.5+.5*Math.cos(angle*Math.PI*8/2.32);
  const edge=1+.035*Math.cos(angle*Math.PI*8/2.32)*radius**4;
  const dome=Math.sin(Math.PI*radius)*.23;
  vertices.push(Math.sin(angle)*radius*edge,side===0?.025+dome*(.88+.12*ribs):-.015,Math.cos(angle)*radius*edge-.36);
 }
 const width=segments+1,layer=(rings+1)*width;
 for(let side=0;side<2;side++)for(let ring=0;ring<rings;ring++)for(let segment=0;segment<segments;segment++){
  const a=side*layer+ring*width+segment,b=a+1,c=a+width,d=c+1;
  indices.push(...(side===0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
 }
 // Connect both sheets along the complete perimeter, including the hinge.
 const boundary=[];
 for(let s=0;s<=segments;s++)boundary.push(s);
 for(let r=1;r<=rings;r++)boundary.push(r*width+segments);
 for(let s=segments-1;s>=0;s--)boundary.push(rings*width+s);
 for(let r=rings-1;r>0;r--)boundary.push(r*width);
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length];
  indices.push(a,b,a+layer,b,b+layer,a+layer);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function installSeabedDetails(scene,shore,terrainY){
 const layout=createSeabedScatter({shore,terrainY}),batches=[],dummy=new T.Object3D(),up=new T.Vector3(0,1,0),tilt=new T.Quaternion(),turn=new T.Quaternion();
 for(const kind of ['rock','shell']){
  const items=layout.filter(item=>item.kind===kind);
  if(!items.length)continue;
  const geometry=kind==='rock'?seabedRockGeometry():seabedShellGeometry();
  const material=new T.MeshStandardMaterial({color:kind==='rock'?'#a39b83':'#e5d9c1',roughness:.94,flatShading:kind==='rock'});
  const batch=new T.InstancedMesh(geometry,material,items.length);batch.name=`seabed-${kind}`;batch.receiveShadow=true;batch.castShadow=false;
  items.forEach((item,i)=>{
   dummy.position.set(item.x,item.y,item.z);dummy.scale.setScalar(item.size);
   tilt.setFromUnitVectors(up,new T.Vector3(...item.normal));turn.setFromAxisAngle(up,item.yaw);dummy.quaternion.copy(tilt).multiply(turn);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
   batch.setColorAt(i,new T.Color().setRGB(1-i%4*.035,1-i%3*.035,1-i%5*.025));
  });
  batch.computeBoundingSphere();scene.add(batch);batches.push(batch);
 }
 return {layout,batches,dispose(){for(const batch of batches){batch.removeFromParent();batch.geometry.dispose();batch.material.dispose();batch.dispose();}}};
}

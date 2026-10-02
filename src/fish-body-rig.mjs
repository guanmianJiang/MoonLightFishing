import * as T from './three.module.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));

// All parts share the same centreline. The front of the head remains rigid.
export function fishBodyWave(x,length,headDirection,pose={},out={}){
 const u=clamp(.20-x*headDirection/length,0,1),amplitude=clamp(pose.amplitude,0,.12)*length;
 const angle=(Number.isFinite(pose.phase)?pose.phase:0)-u*2.8;
 const curl=clamp(Number.isFinite(pose.curl)?pose.curl:0,-.18,.18)*length;
 const offset=amplitude*u*u*Math.sin(angle)+curl*u*u;
 const slope=-headDirection/length*(amplitude*(2*u*Math.sin(angle)-2.8*u*u*Math.cos(angle))+2*curl*u);
 out.offset=offset;out.slope=u>0&&u<1?slope:0;return out;
}

export function createFishBodyRig(root,{id='carp',headDirection=1}={}){
 root.updateMatrixWorld(true);
 const body=root.getObjectByName(id+'_Body'),inverseRoot=root.matrixWorld.clone().invert(),bounds=new T.Box3();
 (body||root).traverse(mesh=>{if(!mesh.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld),p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));});
 const length=Math.max(.1,bounds.getSize(new T.Vector3()).x),entries=[],gills=[],owned=[];
 const point=new T.Vector3(),normal=new T.Vector3(),wave={};let disposed=false;
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  if(/^Gill_plate/.test(mesh.name))gills.push({mesh,scale:mesh.scale.clone()});
  const toRoot=new T.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld),fromRoot=toRoot.clone().invert();
  const normalToRoot=new T.Matrix3().getNormalMatrix(toRoot),normalFromRoot=new T.Matrix3().getNormalMatrix(fromRoot);
  const src=mesh.geometry.attributes.position,norm=mesh.geometry.attributes.normal,points=new Float32Array(src.count*3),normals=new Float32Array(src.count*3);
  let animated=false;
  for(let i=0;i<src.count;i++){
   point.fromBufferAttribute(src,i).applyMatrix4(toRoot).toArray(points,i*3);
   if(point.x*headDirection<length*.20)animated=true;
   if(norm)normal.fromBufferAttribute(norm,i).applyMatrix3(normalToRoot).normalize().toArray(normals,i*3);
  }
  if(!animated)return;
  const original=mesh.geometry,geometry=original.clone();mesh.geometry=geometry;owned.push(geometry);
  geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal?.setUsage(T.DynamicDrawUsage);
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=length*.33/Math.max(.01,Math.min(...mesh.scale.toArray()));
  const pectoral=/^Pectoral/.test(mesh.name),pivot=new T.Vector3().fromArray(points),side=Math.sign(pivot.z)||1;
  entries.push({mesh,original,geometry,points,normals,fromRoot,normalFromRoot,pectoral,pivot,side});
 });
 return {apply(pose={}){
  if(disposed)return;
  const fin=clamp(pose.fin,0,.25),phase=Number.isFinite(pose.phase)?pose.phase:0,shrimp=id==='shrimp';
  for(const e of entries){
   const pos=e.geometry.attributes.position,norm=e.geometry.attributes.normal;
   const angle=e.pectoral?e.side*fin*Math.sin(phase*.55+.7):0,c=Math.cos(angle),s=Math.sin(angle);
   for(let i=0;i<pos.count;i++){
    point.fromArray(e.points,i*3);normal.fromArray(e.normals,i*3);
    if(e.pectoral){const y=point.y-e.pivot.y,z=point.z-e.pivot.z;point.y=e.pivot.y+y*c-z*s;point.z=e.pivot.z+y*s+z*c;const ny=normal.y;normal.y=ny*c-normal.z*s;normal.z=ny*s+normal.z*c;}
    fishBodyWave(point.x,length,headDirection,pose,wave);
    if(shrimp){point.y+=wave.offset;normal.x-=wave.slope*normal.y;}
    else{point.z+=wave.offset;normal.x-=wave.slope*normal.z;}
    point.applyMatrix4(e.fromRoot);pos.setXYZ(i,point.x,point.y,point.z);
    if(norm){normal.applyMatrix3(e.normalFromRoot).normalize();norm.setXYZ(i,normal.x,normal.y,normal.z);}
   }
   pos.needsUpdate=true;if(norm)norm.needsUpdate=true;
  }
  for(const g of gills)g.mesh.scale.z=g.scale.z*(1+clamp(pose.breath,0,.02)*Math.sin(phase*.45));
 },dispose(){if(disposed)return;disposed=true;for(const e of entries)e.mesh.geometry=e.original;for(const g of gills)g.mesh.scale.copy(g.scale);owned.forEach(g=>g.dispose());},get vertexCount(){return entries.reduce((n,e)=>n+e.points.length/3,0)}};
}

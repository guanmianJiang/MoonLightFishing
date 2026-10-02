import * as T from './three.module.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),safe=(v,d,a,b)=>clamp(Number.isFinite(v)?v:d,a,b);

export function createAnglerFaceRig(root){
 const eyes=[],brows=[],owned=[],centers=new Map();let mouth=null,disposed=false;
 root?.traverse(part=>{if(part.isMesh&&/^Eye_white/.test(part.name))centers.set(Math.sign(part.position.x),part.position.y)});
 root?.traverse(part=>{
  if(!part.isMesh)return;
  if(/^Eye/.test(part.name))eyes.push({part,position:part.position.clone(),scale:part.scale.clone(),visible:part.visible,center:centers.get(Math.sign(part.position.x))??part.position.y});
  else if(/^Brow/.test(part.name)){
   const geometry=part.geometry.clone();geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-center.z);part.position.add(center.multiply(part.scale).applyQuaternion(part.quaternion));part.geometry=geometry;owned.push(geometry);
   brows.push({part,position:part.position.clone(),rotation:part.rotation.z,side:Math.sign(part.position.x)||1});
  }else if(/^Smile/.test(part.name)&&!mouth){
   const geometry=new T.BufferGeometry(),segments=20,sides=6,count=(segments+1)*(sides+1),indices=[];
   // Query the shared source without modifying its bounding-box cache.
   const center=new T.Box3().setFromBufferAttribute(part.geometry.attributes.position).getCenter(new T.Vector3());
   geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage));
   for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1)}geometry.setIndex(indices);geometry.boundingSphere=new T.Sphere(center.clone(),.10);part.geometry=geometry;owned.push(geometry);mouth={part,geometry,center,segments,sides,last:null};
  }
 });
 function apply(cue={}){
  if(disposed)return;
  const open=safe(cue.eyeOpen,1,.065,1.4),lift=safe(cue.browLift,0,-.01,.020),tilt=safe(cue.browTilt,0,-.25,.25),asym=safe(cue.asymmetry,0,-.01,.01);
  for(const eye of eyes){eye.part.position.copy(eye.position);eye.part.position.y=eye.center+(eye.position.y-eye.center)*open;eye.part.scale.copy(eye.scale);eye.part.scale.y*=open;eye.part.visible=eye.visible&&(!/^Eye_(white|highlight)/.test(eye.part.name)||open>.15)}
  for(const brow of brows){brow.part.position.copy(brow.position);brow.part.position.y+=lift+brow.side*asym;brow.part.rotation.z=brow.rotation+brow.side*tilt}
  if(!mouth)return;
  const {geometry,center,segments,sides}=mouth,positions=geometry.attributes.position,normals=geometry.attributes.normal,smile=safe(cue.smile,.22,-.5,1),shape=safe(cue.mouthOpen,0,0,1),width=T.MathUtils.lerp(.043*safe(cue.mouthWidth,1,.8,1.15),.012,shape),radius=.0045,gap=.0008+.0152*shape;
  if(mouth.last&&Math.abs(smile-mouth.last.smile)<.0001&&Math.abs(shape-mouth.last.shape)<.0001&&Math.abs(width-mouth.last.width)<.00001)return;
  mouth.last={smile,shape,width};
  for(let i=0;i<=segments;i++){
   const angle=i/segments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),curve=.016*smile*(1-shape),x=center.x+c*width,y=center.y+curve*(c*c-.40)+s*gap,z=center.z+.008-.015*(c*width/.043)**2;
   const dx=-s*width,dy=-2*curve*c*s+c*gap,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a),v=i*(sides+1)+j;positions.setXYZ(v,x+nx*c*radius,y+ny*c*radius,z+s*radius);normals.setXYZ(v,nx*c,ny*c,s)}
  }
  // The closed lip only needs the lower half; opening reveals the upper lip.
  geometry.setDrawRange(shape<.05?segments/2*sides*6:0,shape<.05?segments/2*sides*6:segments*sides*6);
  positions.needsUpdate=normals.needsUpdate=true;
 }
 apply();
 return {apply,dispose(){if(disposed)return;disposed=true;owned.forEach(geometry=>geometry.dispose())}};
}

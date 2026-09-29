import * as T from './three.module.js';
const TAU=Math.PI*2;
export const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.65,flatShading:false,...extra});
// Leaves carry a soft wax highlight; canvas has a broad fibre sheen.
export function organicMaterial(color,fabric=false){
 const material=new T.MeshPhysicalMaterial({color,side:T.DoubleSide,roughness:fabric?.78:.40,
  metalness:0,clearcoat:fabric?0:.22,clearcoatRoughness:.48,
  sheen:fabric?.65:0,sheenColor:new T.Color('#ead9b9'),sheenRoughness:.85});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vOrganic;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOrganic=position;');
  shader.fragmentShader='varying vec3 vOrganic;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float fibrePhase=${fabric?'vOrganic.x*145.':'vOrganic.x*42.+vOrganic.z*95.'};
float fibre=sin(fibrePhase)*(1.-smoothstep(.5,2.,fwidth(fibrePhase)));
diffuseColor.rgb*=1.+fibre*${fabric?'.025':'.045'};
`);
 };
 material.customProgramCacheKey=()=>fabric?'canvas-fibre-1':'leaf-wax-1';
 return material;
}
export function timberMaterial(color){
 const material=mat(color,{roughness:.78});
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vTimber;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTimber=position;');
  s.fragmentShader='varying vec3 vTimber;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float woodPhase=vTimber.z*170.+sin(vTimber.x*3.8+vTimber.z*11.)*1.7;
float woodFilter=1.-smoothstep(.7,3.0,fwidth(woodPhase));
float woodGrain=sin(woodPhase)*sin(woodPhase*.37+1.2)*woodFilter;
diffuseColor.rgb*=.98+woodGrain*.075;`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+woodGrain*.045,.65,.9);');
 };
 return material;
}
export const mats={wood:mat('#8f633d'),edge:mat('#543f32'),sand:mat('#ead9a8'),stone:mat('#87938c'),green:mat('#486f62'),cream:mat('#f3ead1'),red:mat('#c95e4f'),metal:mat('#58726f')};
export function mesh(geo,material,parent,pos=[0,0,0],scale=[1,1,1]){const m=new T.Mesh(geo,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
export function box(p,s,material,parent){const r=Math.min(.11,...s.map(v=>v*.22)),shape=new T.Shape(),x=s[0]/2-r,y=s[1]/2-r;shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:s[2]-r*2,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:4,steps:1});g.translate(0,0,-s[2]/2+r);g.computeVertexNormals();return mesh(g,material,parent,p)}
export function rod(a,b,r,material,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new T.CylinderGeometry(r*.8,r,d.length(),16),material,parent);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m}
export function placeRod(m,a,b){const d=new T.Vector3().subVectors(b,a);m.position.copy(a).addScaledVector(d,.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
export function line(points,color,parent){const l=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity:.75}));parent.add(l);return l}
export function fin(points,color,parent){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();return mesh(g,mat(color,{side:T.DoubleSide}),parent)}
export function makeSpecimen(id,variation=''){
 const group=new T.Group();const pale=variation.includes('浅金');
 if(id==='bottle'){
  const glass=mat('#76a991',{roughness:.2,metalness:.08});mesh(new T.CylinderGeometry(.33,.35,1.05,10),glass,group,[0,0,0]);mesh(new T.ConeGeometry(.33,.28,10),glass,group,[0,.64,0]);mesh(new T.CylinderGeometry(.12,.14,.35,8),glass,group,[0,.82,0]);mesh(new T.CylinderGeometry(.125,.125,.13,8),mats.wood,group,[0,1.01,0]);box([0,0,.338],[.4,.43,.015],mats.cream,group);group.rotation.z=-.45;group.userData.object=true;return group;
 }
 if(id==='bell'){
  const points=[new T.Vector2(.08,.6),new T.Vector2(.22,.52),new T.Vector2(.28,.25),new T.Vector2(.38,-.22),new T.Vector2(.52,-.4),new T.Vector2(.54,-.5),new T.Vector2(.43,-.5),new T.Vector2(.33,-.27),new T.Vector2(.17,.38)];mesh(new T.LatheGeometry(points,32),mat('#baac69',{side:T.DoubleSide,metalness:.3}),group);const ring=mesh(new T.TorusGeometry(.14,.045,5,12),mats.metal,group,[0,.71,0]);ring.rotation.y=.4;mesh(new T.SphereGeometry(.09,8,6),mats.metal,group,[0,-.46,0]);group.userData.object=true;return group;
 }
 if(id==='shrimp'){
  for(let i=0;i<6;i++){const m=mesh(new T.SphereGeometry(1,20,14),mat(i%2?'#db9875':'#efbd94'),group,[-.58+i*.22,.08-Math.pow(i-2,2)*.014,0],[.19,.22-i*.015,.18-i*.011]);m.rotation.z=i*.13;}
  for(const sign of [-1,1]){mesh(new T.SphereGeometry(.065,8,6),mat('#293936'),group,[-.8,.24,sign*.14]);line([[-.75,.15,sign*.12],[-1.1,.4,sign*.3],[-1.55,.55,sign*.42]],'#9a7353',group);for(let i=0;i<4;i++)rod([-.6+i*.25,-.03,sign*.12],[-.78+i*.23,-.4,sign*.42],.019,mats.red,group)}fin([[.57,0,0],[.94,.19,-.25],[.93,-.1,0],[.57,0,0],[.93,-.1,0],[.94,.19,.25]],'#d99170',group);group.userData.mouthLocal=new T.Vector3(-.91,.08,0);return group;
 }
 const colors={carp:'#b4c4ba',minnow:'#b5d5d0',perch:'#86a77d',catfish:'#6b8680',oldgold:'#dca94c',moon:'#d8e9e2'};
 const color=pale?'#dcc67a':colors[id]||colors.carp;
 const chunky=id==='carp'||id==='oldgold'||id==='moon',slender=id==='minnow';
 const profile=chunky?[.02,.19,.32,.4,.39,.30,.16,.065]:slender?[.02,.13,.19,.21,.20,.15,.10,.045]:[.06,.24,.29,.30,.27,.22,.13,.055];
 const curve=new T.SplineCurve(profile.map((v,i)=>new T.Vector2(i,v)));const radii=Array.from({length:32},(_,i)=>Math.max(.01,curve.getPoint(i/31).y));
 const pos=[],idx=[],sides=32;
 for(let i=0;i<radii.length;i++)for(let j=0;j<sides;j++){const a=j/sides*TAU;pos.push(-1+i/(radii.length-1)*1.785,Math.sin(a)*radii[i],Math.cos(a)*radii[i]*.65);}
 for(let i=0;i<radii.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;idx.push(a,a+sides,b,b,a+sides,b+sides)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,mat(color),group);
 const tail=new T.Group();tail.position.x=.78;group.add(tail);const tc=id==='perch'?'#cf8966':id==='oldgold'?'#bb7a36':color;
 fin([[0,0,0],[.54,.37,0],[.38,0,0],[0,0,0],[.38,0,0],[.54,id==='oldgold'?-.12:-.37,0]],tc,tail);group.userData.tail=tail;
 fin([[-.48,.28,0],[.1,chunky?.65:.45,0],[.45,.2,0]],tc,group);
 for(const sign of [-1,1]){mesh(new T.SphereGeometry(.083,20,14),mats.cream,group,[-.72,.08,sign*.14]);mesh(new T.SphereGeometry(.046,20,14),mat('#263b36'),group,[-.746,.09,sign*.195]);fin([[-.43,-.08,sign*.15],[-.08,-.25,sign*.51],[.02,-.14,sign*.11]],tc,group);if(id==='catfish')line([[-.95,-.08,sign*.15],[-1.22,-.13,sign*.35],[-1.35,-.27,sign*.45]],'#455b54',group)}
 if(id==='perch')for(let i=0;i<4;i++)box([-.45+i*.23,.04,.175],[.055,.35,.015],mat('#506e59'),group);
 group.userData.mouthLocal=new T.Vector3(-.97,-.035,0);
 return group;
}

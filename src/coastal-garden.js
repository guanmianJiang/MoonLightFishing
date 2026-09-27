import * as T from './three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';

export function weatherCoastalStone(model){
 model.traverse(o=>{if(!o.isMesh)return;
  const style=source=>{const material=source.clone();material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vCoastalStone;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvCoastalStone=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 vCoastalStone;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float stoneWet=1.-smoothstep(.06,.58,vCoastalStone.y);
float strata=.97+.03*sin(vCoastalStone.y*14.+sin(vCoastalStone.x*1.3)*.45);
diffuseColor.rgb*=mix(vec3(1.),vec3(.62,.74,.68),stoneWet)*strata;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(1.,.72,1.-smoothstep(.06,.58,vCoastalStone.y));');
  };material.customProgramCacheKey=()=> 'coastal-stone-v6';return material};
  o.material=Array.isArray(o.material)?o.material.map(style):style(o.material);
 });return model;
}

export function palmFrondGeometry(length,width){
 const vertices=[],indices=[];
 const point=(u,side=0)=>[length*u,.12*Math.sin(Math.PI*u)-.42*u*u,side];
 const quad=(a,b,c,d)=>{const n=vertices.length/3;vertices.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3)};
 // Narrow, folded central rib supports swept alternating leaflets.
 for(let k=0;k<8;k++){const u=k/8,v=(k+1)/8;quad(point(u,-.026*(1-u)),point(u,.026*(1-u)),point(v,.026*(1-v)),point(v,-.026*(1-v)))}
 for(let k=1;k<=10;k++)for(const side of [-1,1]){
  const u=.035+k*.079+(side===1?.018:0),w=width*1.15*Math.sin(Math.PI*u),start=point(u),tip=point(Math.min(.99,u+.12),side*w),end=point(Math.min(1,u+.075));tip[1]-=.09*Math.sin(Math.PI*u);
  const ridge=[(start[0]+tip[0])*.5,(start[1]+tip[1])*.5+.024,side*w*.52];const n=vertices.length/3;
  vertices.push(...start,...ridge,...tip,...end);indices.push(n,n+1,n+2,n+1,n+3,n+2);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function installCoastalGarden(scene,shore,terrainY){
 const wind={value:0},motion={value:1},loader=new GLTFLoader();
 const layouts={dune_grass:[],beach_bloom:[],driftwood:[],shell_pair:[]};
 // Clustered margins frame the camp; no random plants in the casting corridor.
 for(const side of [-1,1])for(let i=0;i<12;i++){
  const x=side*(5.9+(i%4)*2.05+Math.sin(i*2.3)*.32),z=shore(x)-.9-Math.floor(i/4)*2.15;
  layouts.dune_grass.push([x,z,.78+(i%3)*.16,i*2.4]);
  if(i%2===0)layouts.beach_bloom.push([x+side*.72,z-.26,.88+(i%3)*.16,i*1.7]);
 }
 layouts.beach_bloom.push([-6.2,-6.35,1.1,.2],[2.1,-5.1,.95,1.4]);
 layouts.driftwood.push([8.2,shore(8.2)-.65,1.15,.55],[-8.2,shore(-8.2)-.6,.92,-.6]);
 // Five sparse shell pairs follow the wrack line, away from the casting path.
 layouts.shell_pair.push([-7.2,shore(-7.2)-.55,1.04,.35],[7.2,shore(7.2)-.58,.92,2.3],[10.9,shore(10.9)-.76,1.12,-.55],[-10.8,shore(-10.8)-.68,.92,1.1],[3.7,shore(3.7)-.86,1.03,-1.3]);
 for(const [name,placements] of Object.entries(layouts))loader.load(`./assets/models/coastal-garden/${name}.glb?v=6`,g=>{
  g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(!o.isMesh)return;
   const material=o.material.clone();material.envMapIntensity=.55;
   if(name==='dune_grass'||name==='beach_bloom'){
    material.side=T.DoubleSide;material.onBeforeCompile=shader=>{shader.uniforms.uCoastalWind=wind;shader.uniforms.uCoastalMotion=motion;shader.vertexShader='uniform float uCoastalWind;uniform float uCoastalMotion;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float phase=0.;
#ifdef USE_INSTANCING
phase=instanceMatrix[3].x*.63+instanceMatrix[3].z*.41;
#endif
float bend=max(transformed.y,0.);
float gust=.72+.28*sin(uCoastalWind*.48+phase*.16);
transformed.x+=sin(uCoastalWind*.9+phase*.12)*bend*bend*.12*gust*uCoastalMotion;
transformed.z+=sin(uCoastalWind*.82+phase*.09+1.)*bend*bend*.035*gust*uCoastalMotion;`)};material.customProgramCacheKey=()=> 'coastal-wind-v7';
   }
   const instanced=new T.InstancedMesh(o.geometry,material,placements.length),dummy=new T.Object3D();instanced.name=name;instanced.castShadow=true;instanced.receiveShadow=true;
   placements.forEach(([x,z,scale,angle],i)=>{dummy.position.set(x,terrainY(x,z)+.012,z);dummy.rotation.set(0,angle,0);dummy.scale.setScalar(scale);dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix.clone().multiply(o.matrixWorld))});instanced.computeBoundingSphere();scene.add(instanced);
  });
 },undefined,error=>console.warn('Coastal garden asset unavailable',name,error));
 return {update(t,reducedMotion=false){wind.value=t;motion.value=reducedMotion?0:1}};
}

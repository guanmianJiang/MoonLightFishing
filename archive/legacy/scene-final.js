import {renderSettings,glslNumber,settingsUniforms} from './render-settings.js';
import {waterSurfaceGLSL} from './water-surface.js';
import * as T from './three.module.js';
import {coastGeometry,shore,shoreGLSL,terrainY} from './coast.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {createWater} from './water.js';
import {FishingLine,dynamicTube,updateTube,phaseOf} from './fishing-motion.js';
import {createComposer} from './postprocessing.js';
import {introCameraPose} from './camera-intro.js?v=compact-intro-2';

const TAU=Math.PI*2,clamp=T.MathUtils.clamp;
export const WATER_SPOTS={reed:new T.Vector3(-7.8,.12,4.6),bridge:new T.Vector3(3.9,.12,4.8),deep:new T.Vector3(6.6,.12,10.2)};
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.65,flatShading:false,...extra});
// Leaves carry a soft wax highlight; canvas has a broad fibre sheen.
function organicMaterial(color,fabric=false){
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
function timberMaterial(color){
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
const mats={wood:mat('#8f633d'),edge:mat('#543f32'),sand:mat('#ead9a8'),stone:mat('#87938c'),green:mat('#486f62'),cream:mat('#f3ead1'),red:mat('#c95e4f'),metal:mat('#58726f')};
function mesh(geo,material,parent,pos=[0,0,0],scale=[1,1,1]){const m=new T.Mesh(geo,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function box(p,s,material,parent){const r=Math.min(.11,...s.map(v=>v*.22)),shape=new T.Shape(),x=s[0]/2-r,y=s[1]/2-r;shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:s[2]-r*2,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:4,steps:1});g.translate(0,0,-s[2]/2+r);g.computeVertexNormals();return mesh(g,material,parent,p)}
function rod(a,b,r,material,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new T.CylinderGeometry(r*.8,r,d.length(),16),material,parent);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m}
function placeRod(m,a,b){const d=new T.Vector3().subVectors(b,a);m.position.copy(a).addScaledVector(d,.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
function line(points,color,parent){const l=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity:.75}));parent.add(l);return l}
function fin(points,color,parent){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();return mesh(g,mat(color,{side:T.DoubleSide}),parent)}
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
  for(const sign of [-1,1]){mesh(new T.SphereGeometry(.065,8,6),mat('#293936'),group,[-.8,.24,sign*.14]);line([[-.75,.15,sign*.12],[-1.1,.4,sign*.3],[-1.55,.55,sign*.42]],'#9a7353',group);for(let i=0;i<4;i++)rod([-.6+i*.25,-.03,sign*.12],[-.78+i*.23,-.4,sign*.42],.019,mats.red,group)}fin([[.57,0,0],[.94,.19,-.25],[.93,-.1,0],[.57,0,0],[.93,-.1,0],[.94,.19,.25]],'#d99170',group);return group;
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
 return group;
}

const noiseGLSL=`
float hash(float n){return fract(sin(n)*43758.5453);}float sandNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(dot(i,vec2(1.,57.))),hash(dot(i+vec2(1,0),vec2(1.,57.))),f.x),mix(hash(dot(i+vec2(0,1),vec2(1.,57.))),hash(dot(i+1.,vec2(1.,57.))),f.x),f.y);}
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float causticPattern(vec2 p,float t){p+=vec2(sin(p.y*1.8+t*.7),cos(p.x*1.6-t*.6))*.35;float a=sin(p.x*2.8+sin(p.y*2.)+t*.3);float b=sin(p.y*3.1+sin(p.x*2.4)-t*.25);return pow(clamp(1.-abs(a+b)*1.2,0.,1.),4.);}
float cells(vec2 p,float t){vec2 n=floor(p),f=fract(p);float a=8.,b=8.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 o=hash2(n+g);o=.5+.35*sin(t*.35+6.2831*o);float d=length(g+o-f);if(d<a){b=a;a=d;}else if(d<b)b=d;}return b-a;}
vec4 mod289(vec4 x){return x-floor(x/289.)*289.;}
vec4 permute289(vec4 x){return mod289((x*34.+1.)*x);}
vec4 simplexNoiseDerivative(vec3 v,float blur){
 const vec2 C=vec2(1./6.,1./3.);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz),l=1.-g;
 vec3 i1=min(g.xyz,l.zxy),i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.x,x2=x0-i2+C.y,x3=x0-.5;
 vec4 p=permute289(permute289(permute289(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 vec4 j=p-49.*floor(p/49.),x_=floor(j/7.),y_=floor(j-7.*x_);
 vec4 x=(x_*2.+.5)/7.-1.,y=(y_*2.+.5)/7.-1.,h=1.-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.,sh=-step(h,vec4(0.));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 g0=vec3(a0.xy,h.x),g1=vec3(a0.zw,h.y),g2=vec3(a1.xy,h.z),g3=vec3(a1.zw,h.w);
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
 vec4 m2=m*m,m3=m2*m,m4=m2*m2;
 vec3 grad=-6.*m3.x*x0*dot(x0,g0)+m4.x*g0-6.*m3.y*x1*dot(x1,g1)+m4.y*g1-6.*m3.z*x2*dot(x2,g2)+m4.z*g2-6.*m3.w*x3*dot(x3,g3)+m4.w*g3;
 vec4 px=vec4(dot(x0,g0),dot(x1,g1),dot(x2,g2),dot(x3,g3));
 return mix(42.,0.,blur)*vec4(grad,dot(m4,px));
}
float shadertoyWaterCaustics(vec3 pos,float blur){
 vec4 n=simplexNoiseDerivative(pos,blur);pos-=n.xyz*.07;pos*=1.62;
 n=simplexNoiseDerivative(pos,blur);pos-=n.xyz*.07;
 n=simplexNoiseDerivative(pos,blur);pos-=n.xyz*.07;
 return simplexNoiseDerivative(pos,blur).w;
}
`;
export function createWorld(host,getState,onSpot){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor('#74c7cf');renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=renderSettings.exposure;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可旋转缩放的三维钓鱼海湾');renderer.domElement.style.touchAction='none';
 const scene=new T.Scene();scene.background=new T.Color('#74c7cf');scene.fog=new T.FogExp2('#9bd8d4',.00145);const camera=new T.PerspectiveCamera(36,1,.1,2400);let yaw=.16,pitch=.86,closeYaw=0,closePitch=0,zoom=1,desiredZoom=1,frame=0,cameraBlend=0,initializedCamera=false;const cameraAim=new T.Vector3(-1,0,1),introPosition=new T.Vector3(),introAim=new T.Vector3();let introStart=performance.now(),introActive=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!getState().pending;
 const target=new T.Vector3(-1,0,1),focusTarget=new T.Vector3(-1,0,1),focusAim=new T.Vector3(-1,0,1);let focusBlend=0;const hemi=new T.HemisphereLight('#d4e8f5','#b9ae91',1.85);scene.add(hemi);const sun=new T.DirectionalLight('#fff0d6',2.65);sun.position.set(-6,14,-15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.near=.5;sun.shadow.camera.far=60;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=4;sun.shadow.intensity=.76;scene.add(sun);scene.add(new T.AmbientLight('#d9e9ef',.22));
 // The shaders and the actual directional light share one source of truth.
 const lighting={uSunDirection:{value:sun.position.clone().sub(sun.target.position).normalize()},uSunRadiance:{value:sun.color.clone().multiplyScalar(sun.intensity)}};
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vDir;void main(){float horizon=smoothstep(-.12,.48,vDir.y);vec3 horizonCol=vec3(.58,.86,.83),zenith=vec3(.12,.51,.70);vec3 col=mix(horizonCol,zenith,horizon);float cloud=smoothstep(.76,.90,sin(vDir.x*11.+sin(vDir.z*7.))*sin(vDir.z*8.));cloud*=smoothstep(.05,.34,vDir.y)*(1.-smoothstep(.38,.68,vDir.y));col=mix(col,vec3(.93,.96,.86),cloud*.11);gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});const sky=new T.Mesh(new T.SphereGeometry(1600,48,32),skyMat);sky.frustumCulled=false;scene.add(sky);
 let seed=456;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 // Keep the actual shoreline on the procedural height field. The decimated
 // GLB collapses long triangles across the water contact and exposes broad,
 // straight-edged patches of sand through the water mesh.
 const geo=coastGeometry(false,{stride:2,shoreDense:true});
 const surfaceLoader=new T.TextureLoader(),sandNormal=surfaceLoader.load('./assets/sand-normal.jpg');
 const skyTexture=surfaceLoader.load('./assets/sky-toon-04.png');skyTexture.colorSpace=T.SRGBColorSpace;skyTexture.wrapS=T.RepeatWrapping;
 skyMat.uniforms.uSky={value:skyTexture};
 skyMat.fragmentShader=`uniform sampler2D uSky;varying vec3 vDir;void main(){vec3 d=normalize(vDir);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5);vec3 col=texture2D(uSky,uv).rgb;
 // Long optical paths near the horizon wash both hemispheres toward one shared
 // aerial-perspective color.  The asymmetric lobes keep the zenith and the
 // lower reflection hemisphere intact while removing the old horizontal cut.
 vec3 horizonAir=vec3(.54,.70,.73);
 float horizonPath=exp(-abs(d.y)*15.0);
 float upperScatter=exp(-max(d.y,0.)*8.0);
 float lowerScatter=exp(-max(-d.y,0.)*23.0);
 float scatter=horizonPath*.68+upperScatter*lowerScatter*.18;
 float luminance=dot(col,vec3(.2126,.7152,.0722));
 col=mix(vec3(luminance),col,1.-scatter*.34);
 col=mix(col,horizonAir,clamp(scatter,0.,.88));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;skyMat.needsUpdate=true;
 sandNormal.wrapS=sandNormal.wrapT=T.RepeatWrapping;sandNormal.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 const groundMat=mat('#ffffff',{normalMap:sandNormal,normalScale:new T.Vector2(.28,.28),roughness:.98});
 const time={value:0};let previewTime=null;
 groundMat.onBeforeCompile=s=>{
  s.uniforms.uTime=time;
  Object.assign(s.uniforms,lighting,settingsUniforms);
  s.vertexShader='uniform float uTime;\nvarying vec3 vGround;\n'+noiseGLSL+shoreGLSL+waterSurfaceGLSL+'\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;\nfloat waterSide=smoothstep(1.2,3.2,position.z-shore(position.x));\nvec2 hp=position.xz*uSetting_underwaterReliefScale*.75;\nfloat h=sandNoise(hp+vec2(.17,-.23))-.5;\nfloat h2=sin(position.x*.42+position.z*.27)*.5+sin(position.x*.19-position.z*.53+1.7)*.25;\nfloat bedRelief=(h*.7+h2*.3)*uSetting_underwaterRelief*waterSide*.95;\nfloat waterY=.14+waterSurface(position.xz,uTime).z;\nfloat flooded=smoothstep(-.015,.045,shoreContactDistance(position.xz,uTime));\nfloat bedY=position.y+bedRelief;\ntransformed.y=mix(bedY,min(bedY,waterY-.045),flooded);');
  s.fragmentShader='uniform float uTime;uniform vec3 uSunDirection,uSunRadiance;varying vec3 vGround;\n'+noiseGLSL+shoreGLSL+waterSurfaceGLSL+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 untexturedNormal=normal;
#include <normal_fragment_maps>
float landDetail=1.-smoothstep(-.25,.15,vGround.z-shore(vGround.x));
float sandFootprint=max(length(dFdx(vGround.xz)),length(dFdy(vGround.xz)));
float normalLod=1.-smoothstep(.06,.24,sandFootprint);
normal=normalize(mix(untexturedNormal,normal,landDetail*normalLod));
vec2 reliefP=vGround.xz*uSetting_underwaterReliefScale*.75;
float reliefX=sandNoise(reliefP+vec2(.025,0.))-sandNoise(reliefP-vec2(.025,0.));
float reliefZ=sandNoise(reliefP+vec2(0.,.025))-sandNoise(reliefP-vec2(0.,.025));
float reliefGate=smoothstep(1.2,3.2,vGround.z-shore(vGround.x));
normal=normalize(normal+vec3(-reliefX,0.,-reliefZ)*uSetting_underwaterRelief*reliefGate*.9);`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float d=vGround.z-shore(vGround.x);
vec3 drySand=vec3(.66,.49,.28),wetSand=vec3(.40,.285,.15),bedSand=vec3(.12,.34,.29);
float currentWaterGap=.14+waterSurface(vGround.xz,uTime).z-vGround.y;
float wetHistory=sandWetness(vGround,uTime,max(length(dFdx(vGround.xz)),length(dFdy(vGround.xz))));
float wetAmount=pow(clamp(wetHistory,0.,1.),1.32);
// Continue the wet material a short distance below the contact. Previously the
// exposure mask made wetness drop to zero exactly at the waterline, revealing a
// bright dry-sand strip before the seabed colour took over.
float contactWetness=1.-smoothstep(.035,.30,abs(currentWaterGap));
float submergedContact=smoothstep(-.055,.018,currentWaterGap)*(1.-smoothstep(.34,.82,currentWaterGap));
float materialWetness=wetAmount;
// Wet colour persists underwater; the air/wet-sand specular interface does not.
// Use the displaced water height, so the glossy strip follows runup/retreat.
float exposedWetSand=materialWetness*(1.-smoothstep(-.015,.035,currentWaterGap));
float submergedSpecularFade=1.-smoothstep(0.,.06,currentWaterGap);
vec3 sand=mix(drySand,mix(drySand,wetSand,uSetting_wetSandDarkening),materialWetness);
float bedBlend=smoothstep(.06,2.85,currentWaterGap);
sand=mix(sand,bedSand,bedBlend);
float contactFootprint=max(fwidth(currentWaterGap),.025);
float sandDetailMask=1.-smoothstep(.08+contactFootprint,.34+contactFootprint,currentWaterGap);
float broad=sandNoise(vGround.xz*.28);
float footprint=max(fwidth(vGround.x),fwidth(vGround.z));
float grain=(sandNoise(vGround.xz*48.)-.5)*.16*(1.-smoothstep(.015,.065,footprint));
float reliefNoise=sandNoise(vGround.xz*uSetting_underwaterReliefScale*.42+vec2(.17,-.23));
float submergedRelief=(1.-smoothstep(.08,.55,currentWaterGap))*uSetting_underwaterRelief;
float sandMottle=(sandNoise(vGround.xz*3.7)-.5)*.11;
float mineral=(sandNoise(vGround.xz*13.7)-.5)*.10*(1.-smoothstep(.045,.16,footprint));
float ridges=sin(vGround.z*12.+sin(vGround.x*.8)*2.5+sandNoise(vGround.xz*.7)*3.)*.025*(1.-smoothstep(.04,.15,footprint))*(1.-wetAmount);
sand*=1.+sandDetailMask*((broad-.5)*.12+sandMottle+mineral+grain+ridges);
// Sparse world-space grains: randomised positions per cell, confined to wet sand.
vec2 sparkleUV=vGround.xz*max(uSetting_sandSparkleDensity*.34,1.);
vec2 sparkleCell=floor(sparkleUV),sandColorSparkleSeed=hash2(sparkleCell+17.3);
float sparkleDistance=length(fract(sparkleUV)-(.18+.64*sandColorSparkleSeed));
float sparkleAA=max(fwidth(sparkleDistance),.018);
float sparkleDot=1.-smoothstep(.035-sparkleAA,.035+sparkleAA,sparkleDistance);
float sparkleMask=exposedWetSand*smoothstep(.08,.55,currentWaterGap);
sand+=vec3(sparkleDot*uSetting_sandSparkleStrength*.08*sparkleMask);
// Back-project onto the receiver along the refracted sun ray. Nearby samples
// morph rather than cross-scroll, so the pattern focuses and dissolves instead
// of looking like two bright decals sliding over each other.
float rawBedDepth=max(0.,currentWaterGap);
float lowDepthNoise=lowFrequencyDepthNoise(vGround.xz,uTime);
float shallowDepthMask=1.-smoothstep(.45,4.2,rawBedDepth);
float submergedDepthGate=smoothstep(.012,.11,rawBedDepth);
float bedDepth=max(0.,rawBedDepth+lowDepthNoise*.14*shallowDepthMask*submergedDepthGate);
vec3 lightToSurface=uSunDirection;
vec3 incidentLight=-lightToSurface;
vec3 refractedLight=refract(incidentLight,vec3(0.,1.,0.),.7502);
float causticTravel=bedDepth/max(-refractedLight.y,.08);
vec3 causticProjectionWS=vGround-refractedLight*causticTravel;
// One enlarged field: depth gradually defocuses it rather than adding fine decals.
// Gate on physical depth, before artistic noise: dry/thin water stays dark.
float causticAlpha=smoothstep(uSetting_causticMinDepth,uSetting_causticFadeInDepth,rawBedDepth);
float causticNoiseBlur=smoothstep(.9,4.5,bedDepth)*.32;
vec3 causticPos=causticProjectionWS*uSetting_causticScale+vec3(0.,uTime*.075*uSetting_causticSpeed,0.);
float causticRaw=shadertoyWaterCaustics(causticPos,causticNoiseBlur);
// Continuous focus response, not a thresholded white mask. Limit energy
// before lighting so shallow sand never becomes an emissive decal.
float causticAA=max(fwidth(causticRaw),.025);
float causticFocus=exp(clamp(causticRaw*3.2-2.2,-8.,1.2));
vec3 causticFocused=vec3(causticFocus)*causticAlpha/(1.+causticAA*6.);
float brightnessNoise=smoothstep(-.65,.65,lowFrequencyDepthNoise(causticProjectionWS.xz,uTime*.35));
float causticBrightness=mix(.35,1.25,brightnessNoise);
vec3 causticLight=causticFocused*causticBrightness;
vec3 causticReceiverNormal=normalize(cross(dFdx(vGround),dFdy(vGround)));
causticReceiverNormal*=causticReceiverNormal.y<0.?-1.:1.;
float receiverLightFacing=smoothstep(.12,.72,dot(causticReceiverNormal,-refractedLight));
float causticDepthFocus=exp(-bedDepth*.32)*(1.-smoothstep(uSetting_causticFadeOutDepth,uSetting_causticDepth,rawBedDepth));
float causticFootprintFade=1.-smoothstep(.08,.30,footprint);
float depthLightMod=.86+.22*(lowDepthNoise*.5+.5);
float causticVisibility=causticDepthFocus*receiverLightFacing*causticFootprintFade*depthLightMod;
diffuseColor.rgb*=sand*(1.+causticLight*causticVisibility*uSetting_causticStrength);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(mix(.99,uSetting_wetSandRoughness,exposedWetSand)+(broad-.5)*.04*sandDetailMask,.06,1.);`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
material.specularColor*=mix(1.,uSetting_wetSandSpecular,exposedWetSand)*submergedSpecularFade;`);
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec3 causticEnergy=causticLight*causticVisibility;
// Caustics modulate the receiving sand albedo and inherit its shadows.
vec2 grainUV=vGround.xz*uSetting_sandSparkleDensity;vec2 grainCell=floor(grainUV);vec2 seed=hash2(grainCell);
vec2 sparkleSeed=hash2(grainCell+vec2(19.7,73.1));
vec2 delta=fract(grainUV)-(.2+.6*seed);float pixelSize=max(length(dFdx(grainUV)),length(dFdy(grainUV)));
float grainDistance=length(delta);float grainAA=clamp(fwidth(grainDistance),.010,.09);
float grainDot=1.-smoothstep(.075,.075+grainAA*.70,grainDistance);
vec3 grainNormal=normalize(vec3((sparkleSeed.x-.5)*.48,1.,(sparkleSeed.y-.5)*.48));
vec3 grainView=normalize(cameraPosition-vGround);vec3 grainHalf=normalize(grainView+uSunDirection);
float grainNdotH=max(dot(grainNormal,grainHalf),0.);
float grainSpec=pow(grainNdotH,64.);
float grainFade=mix(.48,1.,1.-smoothstep(1.5,7.0,pixelSize));
float grainPresence=step(mix(.97,.94,wetAmount),sparkleSeed.x);
float grainVariation=mix(.22,1.,sparkleSeed.y*sparkleSeed.y);
float grainBrightness=mix(.68,1.55,wetAmount)*uSetting_sandSparkleStrength*.22;
float exposedGrainMask=exposedWetSand*smoothstep(.08,.55,currentWaterGap);
// Fade unresolved physical grains; a sparse, larger mineral population keeps
// a few subpixel catches at overview distance without turning into confetti.
float resolvedGrain=1.-smoothstep(.65,1.7,pixelSize);
vec2 mineralUV=vGround.xz*5.5,mineralCell=floor(mineralUV);
vec2 mineralSeed=hash2(mineralCell+43.2);
float mineralDistance=length(fract(mineralUV)-(.22+.56*mineralSeed));
float mineralAA=max(fwidth(mineralDistance),.015);
float mineralRadius=.027;
float mineralDot=(1.-smoothstep(max(0.,mineralRadius-mineralAA*.5),mineralRadius+mineralAA*.5,mineralDistance))
 *min(1.,mineralRadius/max(mineralAA,.001));
float mineralSpec=pow(max(dot(normalize(vec3((mineralSeed.x-.5)*.8,1.,(mineralSeed.y-.5)*.8)),grainHalf),0.),32.);
float mineralCatch=mineralDot*step(.91,mineralSeed.y)*mineralSpec*mix(.55,1.35,wetAmount )*uSetting_sandSparkleStrength*.22;
totalEmissiveRadiance+=uSunRadiance*vec3(.88,.76,.54)*(.5*grainDot*grainSpec*grainFade*grainPresence*grainVariation*grainBrightness*resolvedGrain+mineralCatch)*exposedGrainMask;`);
 };
 const ground=mesh(geo,groundMat,scene);ground.castShadow=false;ground.renderOrder=-2;
 const waterSystem=createWater(renderer,scene,time,lighting);const water=waterSystem.mesh;
 waterSystem.material.uniforms.uSky.value=skyTexture;
 const postFX=createComposer(renderer,scene,camera);

 function rock(x,z,size=1,burial=.34,stretch=1){const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const xx=p.getX(i),yy=p.getY(i),zz=p.getZ(i),low=Math.sin(xx*2.3+yy*1.4+zz*.9)*.11+Math.sin(xx*.8-yy*2.1+zz*1.7)*.06;p.setXYZ(i,xx*(1+low)*1.30,yy*(.64+low*.22),zz*(1+low*.7)*.86);const weathered=T.MathUtils.smoothstep(yy,-.55,.75),variation=.96+low*.25;colors.push((.72+.28*weathered)*variation,(.76+.24*weathered)*variation,(.77+.20*weathered)*variation)}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const m=mesh(g,mat(rand()>.5?'#969782':'#b0aa91',{roughness:.93,flatShading:true,vertexColors:true}),scene,[x,terrainY(x,z)+size*(.30-burial*.22),z],[size*stretch,size*(.58+rand()*.13),size*(.72+rand()*.18)]);m.rotation.set((rand()-.5)*.18,rand()*TAU,(rand()-.5)*.12);return m}
 const rockClusters=[
  {x:9.1,d:.75,s:1.02,rocks:[[0,0,1,.34],[.85,.34,.58,.42],[-.66,.72,.46,.48],[1.30,1.08,.30,.55],[-.28,1.38,.25,.62]]},
  {x:-10.8,d:.20,s:1.20,rocks:[[0,0,1,.30],[-.94,.42,.55,.42],[.72,.70,.48,.48],[-1.38,1.12,.30,.58],[.30,1.46,.24,.64]]},
  {x:13.2,d:1.55,s:.76,rocks:[[0,0,1,.36],[-.62,.28,.58,.44],[.58,.62,.40,.50],[1.02,1.02,.27,.62]]}
 ];
 rockClusters.forEach(cluster=>cluster.rocks.forEach(([dx,dz,scale,burial],i)=>{const x=cluster.x+dx,z=shore(x)+cluster.d+dz;rock(x,z,cluster.s*scale,burial,i===0?1.16:.88+rand()*.20)}));
 // Small beach details are instanced to keep draw calls low.
 const pebbles=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),mat('#e5d7b5'),100),dummy=new T.Object3D();for(let i=0;i<100;i++){const x=(rand()-.5)*31,z=shore(x)-rand()*8,s=.025+rand()*.09;dummy.position.set(x,terrainY(x,z)+s*.35,z);dummy.rotation.set(rand(),rand()*6,rand());dummy.scale.set(s,s*.45,s*.8);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix)}pebbles.receiveShadow=true;scene.add(pebbles);
 const plants=[];function plant(x,z,h=1,color='#6b9167'){const group=new T.Group();group.position.set(x,terrainY(x,z),z);scene.add(group);const verts=[],indices=[];for(let j=0;j<5;j++){const ang=j*2.4+rand(),height=h*(.6+rand()*.5),lean=.2+rand()*.25,base=verts.length/3;for(let k=0;k<4;k++){const t=k/3,px=Math.sin(ang)*lean*t*t,pz=Math.cos(ang)*lean*t*t,w=(1-t)*.075;verts.push(px-w,height*t,pz,px+w,height*t,pz)}for(const n of [0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6])indices.push(base+n)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,mat(color,{side:T.DoubleSide}),group);plants.push(group);return group}
 for(let i=0;i<38;i++){const x=-9+(rand()-.5)*5,z=-1.8+rand()*5;plant(x,z,.28+rand()*.48,rand()>.5?'#3f8175':'#5b9b82')}
 for(let i=0;i<18;i++){const x=8.6+(rand()-.5)*3,z=.5+rand()*4;plant(x,z,.24+rand()*.42,rand()>.5?'#4a8778':'#6aa08b')}

 const palms=[];let baseY;const trunkMats=[mat('#8a6037',{roughness:.96}),mat('#a57945',{roughness:.94})],frondMats=[mat('#518258',{flatShading:true,roughness:.58}),mat('#729757',{flatShading:true,roughness:.62})],coconutMat=mat('#6f5031',{roughness:.96});
 function palmTree(x,inset,height,leanX=0,leanZ=0,scale=1){
  const palm=new T.Group(),z=shore(x)-inset;palm.position.set(x,terrainY(x,z),z);scene.add(palm);
  // One continuous tapered trunk avoids the old overlapping cylinder joints.
  const verts=[],indices=[],segments=6,sides=7,points=[];
  for(let i=0;i<=segments;i++){const u=i/segments,point=new T.Vector3(leanX*height*(.2*u+.8*u*u),height*u,leanZ*height*(.15*u+.85*u*u));points.push(point);const radius=(.15-.075*u)*scale;for(let j=0;j<sides;j++){const a=j/sides*TAU;verts.push(point.x+Math.cos(a)*radius,point.y,point.z+Math.sin(a)*radius);if(i<segments){const n=i*sides+j,k=i*sides+(j+1)%sides;indices.push(n,n+sides,k,k,n+sides,k+sides)}}}
  const trunkGeo=new T.BufferGeometry();trunkGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));trunkGeo.setIndex(indices);trunkGeo.computeVertexNormals();mesh(trunkGeo,trunkMats[0],palm);
  const crown=points[segments],fronds=[],turn=rand()*TAU;
  palm.userData={crownSplay:1.08+rand()*.18};
  for(let leaf=0;leaf<12;leaf++){
   const upper=leaf>=8,angle=turn+(upper?(leaf-8)/4*TAU+.35:leaf/8*TAU),length=(upper?1.28:1.92)*scale*(.92+rand()*.18),width=(upper?.22:.29)*scale,v=[],ix=[];
   for(let k=0;k<=4;k++){const u=k/4,w=width*Math.sin(Math.PI*u);v.push(length*u,-.42*u*u,-w,length*u,.13*Math.sin(Math.PI*u)-.42*u*u,0,length*u,-.42*u*u,w);if(k<4){const n=k*3;ix.push(n,n+1,n+3,n+1,n+4,n+3,n+1,n+2,n+4,n+2,n+5,n+4)}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(ix);geo.computeVertexNormals();const joint=new T.Group();joint.position.copy(crown);joint.position.y+=upper?.12:0;joint.rotation.set(0,angle,upper?.48:.06);palm.add(joint);mesh(geo,frondMats[leaf%2],joint);fronds.push({joint,baseZ:joint.rotation.z,phase:leaf*.9});
  }
  for(let i=0;i<3;i++)mesh(new T.IcosahedronGeometry(.11*scale,0),coconutMat,palm,[crown.x+Math.cos(i*2.1)*.13,crown.y-.1,crown.z+Math.sin(i*2.1)*.13]);
  palm.userData={...palm.userData,fronds,sway:rand()*TAU,growDelay:Math.floor(palms.length/4)*.20+(palms.length%4)*.075+rand()*.06,growDuration:.52+rand()*.20,growScale:.88+rand()*.24};palms.push(palm);return palm;
 }
 // Dense, staggered groves: overlapping mature crowns above smaller companions.
 // The central beach stays open around the camp and the pier approach.
 const palmLayout=[
 [-14.9,3.6,3.9,-.24,.26,.94],[-12.8,1.6,2.65,.16,.38,.78],[-10.9,3.2,3.45,-.23,.21,.89],[-8.4,1.9,2.75,.31,.25,.78],
 [-15.5,6.4,3.1,.22,-.12,.85],[-12.6,6.2,4.4,-.20,.12,1],[-9.3,5.5,3.6,.16,.30,.91],[-8,8.1,4.1,-.22,.1,.95],
 [-11.7,4.5,1.8,.25,.22,.60],[-14.1,8.8,3.75,.19,-.18,.9],[-10.8,9.3,4.6,-.12,.18,1.02],[-7.7,3.8,1.65,-.22,.28,.59],
 [5.5,4.1,2.8,-.30,.20,.82],[7.6,1.8,3.7,.23,.31,.94],[10.1,3.4,2.55,-.26,.23,.76],[12.8,1.7,3.5,.22,.36,.92],
 [15.4,3.8,2.9,-.18,.22,.81],[6.7,7.1,4.15,-.21,.14,.96],[9.1,6.0,3.45,.27,-.10,.88],[12.4,6.5,4.4,-.24,.20,1.02],
 [15.8,7.8,3.65,.19,-.15,.91],[10.4,9.1,4.0,.14,.23,.94],[7,3.7,1.6,-.26,.16,.57],[13.7,4.2,1.95,.30,.17,.65]
 ];
 palmLayout.forEach(v=>palmTree(...v));

 // Pier: individual timber planks, caps, supports and a rope rail.
 const pier=new T.Group();pier.position.set(-1.2,0,-2);scene.add(pier);
 for(let i=0;i<13;i++){const z=-2.6+i*.42;const plank=box([0,.65,z],[2.05,.15,.385],timberMaterial(i%3===0?'#a8733e':i%3===1?'#85572f':'#b17d47'),pier);plank.rotation.y=(rand()-.5)*.012;for(const x of [-.79,.79])mesh(new T.CylinderGeometry(.024,.024,.009,8),mat('#3d3329',{metalness:.38,roughness:.52}),pier,[x,.731,z]);for(const dz of [-.095,.085])line([[-.78,.734,z+dz],[-.21,.735,z+dz+(rand()-.5)*.025],[.34,.735,z+dz],[.78,.734,z+dz+(rand()-.5)*.018]],'#6d482b',pier)}
 for(const x of [-.88,.88]){box([x,.43,0],[.16,.22,5.75],mat('#4c3627',{roughness:.86}),pier);for(const z of [-2.85,0,2.6]){mesh(new T.CylinderGeometry(.11,.15,2.35,12),mat('#4d3527',{roughness:.88}),pier,[x,-.12,z]);mesh(new T.CylinderGeometry(.15,.15,.09,12),mat('#e4d6aa',{roughness:.78}),pier,[x,1.09,z]);const coil=mesh(new T.TorusGeometry(.145,.018,8,28),mat('#b9a476',{roughness:.92}),pier,[x,.84,z]);coil.rotation.x=Math.PI/2;}}
 for(const x of [-.83,.83])for(const z of [-2.7,2.42])rod([x,.34,z],[x,-.63,z+(z<0?.58:-.58)],.055,mat('#5a402e',{roughness:.9}),pier);
 for(const z of [-2.7,2.45])for(const x of [-.91,.91])box([x,.46,z],[.21,.31,.075],mat('#374946',{metalness:.28,roughness:.56}),pier);
 for(const x of [-.89,.89]){const points=[];for(let i=0;i<=20;i++){const z=-2.8+i/20*2.8;points.push([x,.95-Math.sin(i/20*Math.PI)*.25,z])}line(points,'#b6aa86',pier)}
 // Authored PBR rowboat from the project's Arts library, converted to a mobile web LOD.
 const boat=new T.Group();boat.position.set(-4.55,.13,-1.42);boat.rotation.y=-.24;scene.add(boat);
 new GLTFLoader().load('./assets/models/gf_rowboat_335_a.glb',gltf=>{const model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=.62;o.material.roughness=Math.max(.46,o.material.roughness||0)}});const bounds=new T.Box3().setFromObject(model);model.position.y-=bounds.min.y+.18;boat.add(model)},undefined,error=>console.warn('Rowboat asset could not load',error));
 rod([-.63,.42,-.72],[.82,.62,.98],.025,mats.edge,boat);const paddle=box([.91,.65,1.08],[.25,.055,.54],mat('#a97642',{roughness:.72}),boat);paddle.rotation.y=.63;
 line([[-2.05,.95,-2],[-2.75,.35,-2.2],[-3.5,.4,-2.5]],'#dacda6',scene);

 const umbrella=new T.Group();umbrella.position.set(-5.5,terrainY(-5.5,-7),-7);scene.add(umbrella);rod([0,0,0],[0,2.9,0],.045,mats.cream,umbrella);

 const umbrellaFabric=[organicMaterial('#cbb78a',true),organicMaterial('#be5837',true)];
 for(let panel=0;panel<10;panel++){const vertices=[],indices=[];for(let ring=0;ring<=6;ring++)for(let seg=0;seg<=6;seg++){const radius=ring/6*1.75,angle=(panel+seg/6)/10*TAU;vertices.push(Math.cos(angle)*radius,3.1-.72*Math.pow(radius/1.75,1.65)-.12*Math.sin(seg/6*Math.PI)*Math.pow(radius/1.75,1.2),Math.sin(angle)*radius)}for(let ring=0;ring<6;ring++)for(let seg=0;seg<6;seg++){const i=ring*7+seg;indices.push(i,i+1,i+7,i+1,i+8,i+7)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const canopy=mesh(g,umbrellaFabric[panel%2],umbrella);canopy.receiveShadow=true}mesh(new T.SphereGeometry(.09,20,12),mats.cream,umbrella,[0,3.12,0]);

 const chair=new T.Group();chair.position.set(-4.8,terrainY(-4.8,-6.6),-6.6);chair.rotation.y=.15;scene.add(chair);for(const x of [-.36,.36]){rod([x,0,-.45],[x,.8,.3],.035,mats.wood,chair);rod([x,0,.45],[x,.65,-.25],.035,mats.wood,chair);rod([x,.5,-.25],[x,1.35,-.65],.035,mats.wood,chair)}box([0,.56,0],[.66,.055,.62],mat('#95b8ab'),chair);const back=box([0,.98,-.44],[.66,.79,.05],mat('#95b8ab'),chair);back.rotation.x=-.42;
 // Authored Blender props retain the procedural versions until loading succeeds.
 const beachLoader=new GLTFLoader();
 function prepareBeachProp(model){model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){material.envMapIntensity=.65;}}});return model}
 beachLoader.load('./assets/models/beach_parasol.glb?v=1',gltf=>{
  const model=prepareBeachProp(gltf.scene);model.position.copy(umbrella.position);scene.add(model);umbrella.visible=false;
 },undefined,error=>console.warn('Beach parasol asset could not load',error));
 beachLoader.load('./assets/models/beach_deckchair.glb?v=1',gltf=>{
  const model=prepareBeachProp(gltf.scene);model.position.set(-4.55,terrainY(-4.55,-6.15),-6.15);model.rotation.y=-.22;scene.add(model);chair.visible=false;
  const companion=model.clone(true);companion.position.set(-3.2,terrainY(-3.2,-7.65),-7.65);companion.rotation.y=.38;scene.add(companion);
 },undefined,error=>console.warn('Beach chair asset could not load',error));
 // Blender shoreline kit: anchored in the seabed, with open casting corridors.
 const reefObjects=[];
 const reefPlacements={
  reef_tall:[[-11.8,2.9,1.12,.35],[11.9,2.7,.95,-.5],[15.2,6.3,.84,.8]],
  reef_shelf:[[-10.2,3.8,1.02,-.25],[-13.2,4.7,.78,.65],[10.3,4.0,.95,.3],[14.0,7.1,.76,-.6]],
  reef_small:[[-11.5,5.2,.9,.6],[-9.8,5.5,.75,-.3],[12.1,4.7,1.05,.1],[9.6,3.0,.8,.4],[15.8,8.2,1.1,-.4]]
 };
 for(const [name,placements] of Object.entries(reefPlacements))beachLoader.load(`./assets/models/${name}.glb?v=1`,gltf=>{
  const prototype=prepareBeachProp(gltf.scene);
  placements.forEach(([x,depth,scale,rotation])=>{const z=shore(x)+depth,model=prototype.clone(true);model.scale.setScalar(scale);model.rotation.y=rotation;model.position.set(x,terrainY(x,z)-.08,z);model.userData.spawnDelay=(Math.abs(x)*.018+depth*.035)%1.15;model.userData.spawnScale=scale;model.scale.setScalar(.001);reefObjects.push(model);scene.add(model)});
 },undefined,error=>console.warn('Reef asset could not load',name,error));
 const fireTongues=[],fireMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');let campfireLight=null;
 beachLoader.load('./assets/models/beach_campfire.glb?v=1',gltf=>{
  const model=prepareBeachProp(gltf.scene),x=-2.1,z=-6.05;model.position.set(x,terrainY(x,z)-.025,z);scene.add(model);
  model.traverse(o=>{if(o.isMesh&&o.name.startsWith('Flame_')){o.castShadow=false;fireTongues.push({mesh:o,phase:fireTongues.length*1.7})}});
  campfireLight=new T.PointLight('#ffaf54',2.8,4,2);campfireLight.position.set(x,model.position.y+.65,z);scene.add(campfireLight);
 },undefined,error=>console.warn('Campfire asset could not load',error));
 const cooler=box([-6.3,terrainY(-6.3,-5.7)+.28,-5.7],[.8,.5,.55],mat('#8aafad'),scene);box([cooler.position.x,cooler.position.y+.28,cooler.position.z],[.85,.09,.60],mats.cream,scene);

 // Soft distant banks provide a readable horizon from the seated camera.
 // Open water continues to the atmospheric horizon.
 // The angler is built around articulated joints so hands, rod and line share one pose.
 const person=new T.Group();person.position.set(-1.25,.73,.0);person.rotation.y=.08;scene.add(person);const skin=mat('#c98f68',{roughness:.82}),shirt=mat('#315f59',{roughness:.90}),pants=mat('#29464b',{roughness:.95}),shoe=mat('#382f29',{roughness:.98});
 mesh(new T.CapsuleGeometry(.255,.45,10,24),shirt,person,[0,.50,0]);box([0,.48,-.19],[.38,.44,.08],mat('#284f4b',{roughness:.94}),person);mesh(new T.CylinderGeometry(.17,.205,.13,28),skin,person,[0,.83,0]);mesh(new T.SphereGeometry(.215,32,24),skin,person,[0,.99,0]);
 mesh(new T.SphereGeometry(.032,16,12),mats.edge,person,[-.17,1.01,.12]);mesh(new T.SphereGeometry(.032,16,12),mats.edge,person,[.17,1.01,.12]);mesh(new T.SphereGeometry(.045,16,12),skin,person,[0,.97,.205],[.8,1,1]);const mouth=line([[-.06,.90,.202],[0,.885,.218],[.06,.90,.202]],'#805f4c',person);mouth.material.opacity=.62;
 mesh(new T.CylinderGeometry(.36,.37,.042,48),mat('#ead99d',{roughness:.95}),person,[0,1.16,0]);mesh(new T.CylinderGeometry(.195,.25,.16,36),mat('#e7d393',{roughness:.95}),person,[0,1.25,0]);mesh(new T.TorusGeometry(.222,.018,12,40),mats.edge,person,[0,1.19,0]).rotation.x=Math.PI/2;
 const limbGeo=new T.CylinderGeometry(1,1,1,20);const upperArms=[],foreArms=[];for(let i=0;i<2;i++){upperArms.push(mesh(limbGeo,shirt,person));foreArms.push(mesh(limbGeo,skin,person));}
 for(const sign of [-1,1]){const hip=new T.Vector3(sign*.15,.29,.02),knee=new T.Vector3(sign*.21,.12,.35),ankle=new T.Vector3(sign*.22,-.18,.49);const thigh=mesh(limbGeo,pants,person),shin=mesh(limbGeo,pants,person);placeRod(thigh,hip,knee);thigh.scale.x=thigh.scale.z=.105;placeRod(shin,knee,ankle);shin.scale.x=shin.scale.z=.085;const foot=mesh(new T.CapsuleGeometry(.085,.19,8,16),shoe,person,[ankle.x,ankle.y-.01,ankle.z+.09]);foot.rotation.x=Math.PI/2;}
 const hands=[mesh(new T.SphereGeometry(.078,20,14),skin,person),mesh(new T.SphereGeometry(.078,20,14),skin,person)];

 const rodGeo=dynamicTube(28),fishingRod=mesh(rodGeo,mat('#6c5135',{roughness:.38}),scene);
 const lineGeo=dynamicTube(38),fishingLine=mesh(lineGeo,new T.MeshBasicMaterial({color:'#fff7cf',side:T.DoubleSide,transparent:true,opacity:.84,depthWrite:false}),scene);fishingLine.castShadow=false;fishingLine.renderOrder=8;const lineBorderGeo=dynamicTube(38),lineBorder=mesh(lineBorderGeo,new T.MeshBasicMaterial({color:'#164944',side:T.DoubleSide,transparent:true,opacity:.22,depthWrite:false}),scene);lineBorder.castShadow=false;lineBorder.renderOrder=7;
 const lineAnchor=new T.Vector3(),catchEndpoint=new T.Vector3(),catchVelocity=new T.Vector3();
 fishingLine.userData.excludeFromRefraction=true;lineBorder.userData.excludeFromRefraction=true;
 // Draw sky behind all geometry; the dome must never obscure the distant seabed.
 sky.renderOrder=-1000;sky.material.depthTest=false;
 const physics=new FishingLine(38),rodPoints=Array.from({length:28},()=>new T.Vector3());let bend=0,bendVelocity=0,lastTime=0,lastCast=null,lastPhase='idle',lastNibble=-1,lastReel=false,landed=false;
 const bobber=new T.Group();mesh(new T.CylinderGeometry(.032,.040,.31,20),mats.red,bobber,[0,.24,0]);mesh(new T.SphereGeometry(.095,24,16),mats.cream,bobber,[0,.055,0],[.82,1.45,.82]);mesh(new T.CylinderGeometry(.018,.018,.18,10),mats.edge,bobber,[0,-.12,0]);bobber.scale.setScalar(.96);scene.add(bobber);
 const idleLure=new T.Group();mesh(new T.SphereGeometry(.045,12,8),mat('#e5bf68',{emissive:'#6b4b20',emissiveIntensity:.08}),idleLure);mesh(new T.ConeGeometry(.024,.11,8),mats.edge,idleLure,[0,-.075,0]);scene.add(idleLure);const idleLineGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),idleLine=new T.Line(idleLineGeo,new T.LineBasicMaterial({color:'#fff4ce',transparent:true,opacity:.7}));idleLine.renderOrder=8;scene.add(idleLine);
 const droplets=[];const dropGeo=new T.SphereGeometry(1,8,6),dropMat=new T.MeshBasicMaterial({color:'#d8eee2',transparent:true,opacity:.8});for(let i=0;i<48;i++){const m=mesh(dropGeo,dropMat.clone(),scene);m.visible=false;m.castShadow=false;droplets.push({m,v:new T.Vector3(),life:0})}
 function splash(pos,strength=.6){waterSystem.splash(pos.x,pos.z,strength);for(let i=0;i<Math.min(24,Math.floor(strength*14));i++){const d=droplets.find(v=>v.life<=0);if(!d)break;const angle=rand()*TAU;d.life=.5+rand()*.3;d.m.visible=true;d.m.position.copy(pos);d.m.position.y=.19;d.m.scale.setScalar(.025+rand()*.025);d.v.set(Math.cos(angle)*strength,.7+rand()*1.1*strength,Math.sin(angle)*strength)}}
 let approachFish=null,approachKey=null,revealFish=null,revealKey=null,releaseFish=null,releaseKey=null,releaseSplashed=false;const fishCache=new Map();
 function fishModel(id){if(!fishCache.has(id))fishCache.set(id,shadowFish(id));return fishCache.get(id)}

 const marker=new T.Mesh(new T.RingGeometry(.32,.355,48),new T.MeshBasicMaterial({color:'#ffffdf',side:T.DoubleSide,transparent:true,opacity:.8}));marker.rotation.x=-Math.PI/2;marker.position.y=.19;scene.add(marker);marker.renderOrder=5;

 function shadowFish(id='minnow'){const f=makeSpecimen(id);f.traverse(o=>{if(o.isMesh){o.material=new T.MeshBasicMaterial({color:'#214f4d',transparent:true,opacity:.11,depthWrite:false});o.castShadow=false}else if(o.isLine)o.material=new T.LineBasicMaterial({color:'#214f4d',transparent:true,opacity:.08,depthWrite:false})});return f}
 function faceVelocity(f,v){if(v.lengthSq()>1e-6)f.rotation.y=Math.atan2(v.z,-v.x)}
 const marineSwimmers=[],swimMotion=matchMedia('(prefers-reduced-motion: reduce)'),growthEnabled=true;let growthStart=null;
 for(const [name,count] of [['reef_shark',1],['shoal_fish',8],['silver_fish',5]])beachLoader.load(`./assets/models/${name}.glb?v=2`,gltf=>{
  for(let i=0;i<count;i++){
   const shark=name==='reef_shark',model=gltf.scene.clone(true),phase=shark?.8:i*.17;
   const wave={value:0};
   model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.material=o.material.clone();o.material.onBeforeCompile=shader=>{shader.uniforms.uSwim=wave;shader.vertexShader='uniform float uSwim;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float tailWeight=(1.-smoothstep(${shark?'-1.7,0.65':'-0.42,0.16'},position.x));
transformed.y+=sin(uSwim+position.x*${shark?'3.2':'12.'})*tailWeight*tailWeight*${shark?'.13':'.045'};
`)};o.material.customProgramCacheKey=()=>shark?'shark-wave':'shoal-wave';}});
   scene.add(model);marineSwimmers.push({model,wave,shark,silver:name==='silver_fish',phase,index:i});
  }
 },undefined,error=>console.warn('Marine asset could not load',name,error));

function birdSurface(points,indices,material){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();const surface=new T.Mesh(geo,material);surface.castShadow=false;return surface}
function makeSeagull(){const g=new T.Group(),white=mat('#f5f1e7',{roughness:.88}),grey=mat('#aeb6b3',{roughness:.9}),dark=mat('#303b3b',{roughness:.92,side:T.DoubleSide}),beakMat=mat('#e4a13a',{roughness:.72}),eyeMat=mat('#182321',{roughness:.7});
 const body=mesh(new T.SphereGeometry(.18,16,11),white,g,[0,0,0],[1.55,.58,.72]);body.rotation.z=-.04;
 const back=mesh(new T.SphereGeometry(.17,14,9),grey,g,[-.045,.055,0],[1.38,.34,.66]);
 const chest=mesh(new T.SphereGeometry(.105,14,9),white,g,[.20,-.018,0],[1.0,1.05,.9]);
 const head=mesh(new T.SphereGeometry(.092,14,10),white,g,[.285,.052,0],[1.02,.95,.92]);
 const crown=mesh(new T.SphereGeometry(.088,12,8),grey,g,[.276,.077,0],[.94,.43,.88]);
 const beak=mesh(new T.ConeGeometry(.026,.105,7),beakMat,g,[.385,.043,0]);beak.rotation.z=-Math.PI/2;
 for(const side of [-1,1])mesh(new T.SphereGeometry(.009,8,6),eyeMat,g,[.342,.077,side*.067]);
 function wing(side){const root=new T.Group();root.position.set(.04,.07,side*.07);g.add(root);const inner=birdSurface([.09,0,0,-.15,.012,0,-.20,.018,side*.39,.025,0,side*.53,.15,-.006,side*.34],[0,1,2,0,2,3,0,3,4],grey);root.add(inner);const shoulder=birdSurface([.04,.018,side*.08,-.08,.022,side*.16,-.10,.012,side*.34,.08,.006,side*.27],[0,1,2,0,2,3],white);root.add(shoulder);const wrist=new T.Group();wrist.position.set(-.02,.01,side*.40);root.add(wrist);const outer=birdSurface([-.17,.008,0,.02,0,side*.13,-.02,-.008,side*.47,.12,-.012,side*.70,.22,-.016,side*.82,.05,-.01,side*.48],[0,1,2,0,2,5,2,3,4,2,4,5],grey);wrist.add(outer);const tips=birdSurface([-.02,-.004,side*.43,.12,-.012,side*.70,.22,-.016,side*.82,.16,-.018,side*.66,.04,-.015,side*.55],[0,1,4,1,3,4,1,2,3],dark);wrist.add(tips);return{root,wrist}}
 const left=wing(1),right=wing(-1);
 const tail=birdSurface([-.18,.025,-.03,-.42,.018,-.17,-.34,.02,0,-.42,.018,.17,-.18,.025,.03],[0,1,2,0,2,4,2,3,4],white);g.add(tail);
 g.userData={left,right,body,back,tail,head};g.scale.setScalar(.68);return g}
 let nextFlockAt=3+rand()*5;const seagullFlocks=[];const castTip=new T.Vector3();
 function gullPath(f,q,out){q=clamp(q,0,1);const v=1-q,b0=v*v*v,b1=3*v*v*q,b2=3*v*q*q,b3=q*q*q,p0x=f.fromX,p3x=-f.fromX,p1x=p0x+f.dir*10.5,p2x=p3x-f.dir*10.5,p0z=f.startZ,p3z=f.exitZ,p1z=p0z+f.bend,p2z=p3z-f.bend*.48;return out.set(p0x*b0+p1x*b1+p2x*b2+p3x*b3,f.startY+Math.sin(q*Math.PI)*f.lift+Math.sin(q*TAU+f.wavePhase)*.14,p0z*b0+p1z*b1+p2z*b2+p3z*b3)}


 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();waterSystem.resize(w,h);postFX.resize(w,h)}
 new ResizeObserver(resize).observe(host);resize();
 function cameraUpdate(state,dt){
  const active=(!!state.pending&&state.pending.phase!=='result'||!!state.aiming)&&!state.overview;cameraBlend=T.MathUtils.damp(cameraBlend,active?1:0,active?2.7:2.3,dt);
  zoom=T.MathUtils.damp(zoom,desiredZoom,5,dt);const aspect=host.clientWidth/host.clientHeight,dist=aspect<.8?32:23.5;
  const requestedFocus=WATER_SPOTS[state.focusSpot||state.spot],focusAge=state.focusPulseAt?Math.max(0,(Date.now()-state.focusPulseAt)/1000):9,focusActive=!!state.focusSpot&&!state.pending&&!state.aiming;focusBlend=T.MathUtils.damp(focusBlend,focusActive?1:0,4.5,dt);focusTarget.lerp(requestedFocus||target,1-Math.exp(-dt*(focusActive?7:3.5)));focusAim.lerp(requestedFocus||target,1-Math.exp(-dt*(focusActive?8:4)));const overview=new T.Vector3(target.x+Math.sin(yaw)*dist*Math.cos(pitch),dist*Math.sin(pitch),target.z+Math.cos(yaw)*dist*Math.cos(pitch));overview.lerp(new T.Vector3(focusTarget.x+Math.sin(yaw)*dist*.78*Math.cos(pitch),dist*Math.sin(pitch)*.88,focusTarget.z+Math.cos(yaw)*dist*.78*Math.cos(pitch)),focusBlend);
  const spot=WATER_SPOTS[state.pending?.spot||state.spot],origin=new T.Vector3(-1.25,1.35,.1),forward=spot.clone().sub(origin);forward.y=0;forward.normalize();forward.applyAxisAngle(new T.Vector3(0,1,0),closeYaw);const right=new T.Vector3(forward.z,0,-forward.x),castPhase=phaseOf(state.pending),bite=castPhase==='hooked'||state.revealing,isAiming=!!state.aiming;
  const castAge=state.pending?(Date.now()-state.pending.start)/1000:9,anticipate=castPhase==='casting'&&castAge<.48?1-Math.pow(1-castAge/.48,3):0,releaseBeat=castPhase==='casting'&&castAge>=.48&&castAge<.78?Math.sin((castAge-.48)/.30*Math.PI):0,reelAge=state.revealing?(Date.now()-state.revealStart)/1000:9,hookBeat=state.revealing&&reelAge<.30?Math.sin(reelAge/.30*Math.PI):0,fishHook=state.revealing&&state.pending?.catch&&!['bottle','bell'].includes(state.pending.catch.id),hookIn=fishHook?1-Math.pow(1-clamp(reelAge/.10,0,1),4):0,hookOutRaw=clamp((reelAge-.34)/.42,0,1),hookOut=hookOutRaw*hookOutRaw*(3-2*hookOutRaw),hookFeature=hookIn*(1-hookOut),fishInRaw=clamp((reelAge-.48)/.34,0,1),fishOutRaw=clamp((reelAge-2.35)/.62,0,1),fishFeature=fishHook*(fishInRaw*fishInRaw*(3-2*fishInRaw))*(1-fishOutRaw*fishOutRaw*(3-2*fishOutRaw));const closeDist=isAiming?-5.5:bite?-6.7:-6.05,featureDist=T.MathUtils.lerp(closeDist,-4.18,hookFeature),closeSideBase=aspect<.8?.78:2.05,featureSide=T.MathUtils.lerp(closeSideBase,aspect<.8?.38:1.12,hookFeature);const close=origin.clone().addScaledVector(forward,featureDist-anticipate*.38+releaseBeat*.34-hookBeat*.12).addScaledVector(right,featureSide-releaseBeat*.15);close.y=(isAiming?2.85:bite?2.65:2.38)+closePitch*1.15+anticipate*.12-releaseBeat*.09+hookBeat*.07-hookFeature*.22;
  const aim=spot.clone().lerp(origin,isAiming?.23:.17);aim.y=(bite?.65:isAiming?.20:.13)+closePitch*.24;if(hookFeature>.001){const tensionFocus=catchEndpoint.clone().lerp(castTip,.14);tensionFocus.y=clamp(tensionFocus.y,.42,1.38);aim.lerp(tensionFocus,hookFeature*.88)}if(fishFeature>.001){const fishCamera=catchEndpoint.clone().addScaledVector(forward,-3.15).addScaledVector(right,aspect<.8?.62:1.38);fishCamera.y=catchEndpoint.y+1.05;close.lerp(fishCamera,fishFeature);const fishAim=catchEndpoint.clone();fishAim.y+=.12;aim.lerp(fishAim,fishFeature*.96)}
 const desired=overview.lerp(close,cameraBlend),look=target.clone().lerp(aim,cameraBlend).lerp(focusAim,focusBlend*.7);const focusNod=focusActive&&focusAge<.38?Math.sin(focusAge/.38*Math.PI)*.055:0;desired.y+=focusNod;
  let introFov=null;if(introActive){const elapsed=(performance.now()-introStart)/4300,pose=introCameraPose(elapsed,desired.toArray(),look.toArray(),aspect);introPosition.fromArray(pose.position);introAim.fromArray(pose.aim);if(pose.done)introActive=false;else{desired.copy(introPosition);look.copy(introAim);introFov=pose.fov}}
  if(introFov!==null){camera.position.copy(desired);cameraAim.copy(look);initializedCamera=true}else if(!initializedCamera){camera.position.copy(desired);cameraAim.copy(look);initializedCamera=true}else{const featureStrength=Math.max(hookFeature,fishFeature),cameraSpeed=featureStrength>.01?(hookFeature>.05?24:13):(active?7:5),aimSpeed=featureStrength>.01?(hookFeature>.05?27:15):8;camera.position.lerp(desired,1-Math.exp(-dt*cameraSpeed));cameraAim.lerp(look,1-Math.exp(-dt*aimSpeed));}
  camera.zoom=1+(zoom-1)*(1-cameraBlend*.35);camera.fov=introFov??(T.MathUtils.lerp(36,bite?40:42,cameraBlend)+anticipate*1.35-releaseBeat*2.25+hookBeat*.35-hookFeature*7.2-fishFeature*9.2);camera.lookAt(cameraAim);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 }
 function cancelIntro(){if(!introActive)return;introActive=false;initializedCamera=true}
 const ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.15),intersection=new T.Vector3();let drag=null,pinchGap=0;const pointers=new Map();
 function nearBobber(clientX,clientY,radius=58){if(!bobber.visible)return false;const r=renderer.domElement.getBoundingClientRect(),p=bobber.position.clone().project(camera),x=(p.x*.5+.5)*r.width+r.left,y=(-p.y*.5+.5)*r.height+r.top;return Math.hypot(clientX-x,clientY-y)<radius}
 renderer.domElement.addEventListener('pointerdown',e=>{cancelIntro();pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()];pinchGap=Math.hypot(a[0]-b[0],a[1]-b[1]);drag=null;renderer.domElement.setPointerCapture(e.pointerId);return}const interaction=getState(),direct=['reading','hooked','empty'].includes(phaseOf(interaction.pending))&&!interaction.overview&&nearBobber(e.clientX,e.clientY);drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button,moved:false,direct};renderer.domElement.setPointerCapture(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],gap=Math.hypot(a[0]-b[0],a[1]-b[1]);desiredZoom=clamp(desiredZoom+(gap-pinchGap)*.004,.75,1.65);pinchGap=gap;return}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5)drag.moved=true;if(drag.direct){renderer.domElement.style.cursor='grabbing';drag.x=e.clientX;drag.y=e.clientY;return}if(drag.moved){const interaction=getState();if((interaction.pending||interaction.aiming)&&!interaction.overview){closeYaw=clamp(closeYaw-dx*.0024,-.65,.65);closePitch=clamp(closePitch+dy*.002,-.12,.48)}else{yaw=clamp(yaw-dx*.004,-1.2,1.2);pitch=clamp(pitch+dy*.003,.58,1.25)}}drag.x=e.clientX;drag.y=e.clientY});
 renderer.domElement.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);const interaction=getState();if(drag?.direct&&drag.button===0&&(!drag.moved||drag.sy-e.clientY>34)){interaction.onReel?.();drag=null;renderer.domElement.style.cursor='';return}if(drag&&!drag.moved&&drag.button===0){const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(plane,intersection)&&intersection.z>shore(intersection.x)){const nearest=Object.entries(WATER_SPOTS).sort((a,b)=>a[1].distanceTo(intersection)-b[1].distanceTo(intersection))[0];waterSystem.splash(intersection.x,intersection.z,.24);if(interaction.aiming&&interaction.spot===nearest[0]&&nearest[1].distanceTo(intersection)<1.45)interaction.onConfirmCast?.();else onSpot(nearest[0])}}drag=null;renderer.domElement.style.cursor=''});renderer.domElement.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;renderer.domElement.style.cursor=''});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();cancelIntro();desiredZoom=clamp(desiredZoom-e.deltaY*.001, .75,1.65)},{passive:false});
 const screenPos=(id)=>{const p=WATER_SPOTS[id].clone().project(camera);return{x:(p.x*.5+.5)*host.clientWidth,y:(-.5*p.y+.5)*host.clientHeight}},labelScreen=new Map();

 let stopped=false;function tick(ms){if(stopped)return;const t=ms*.001,dt=Math.min(.033,Math.max(.001,t-lastTime||.016));lastTime=t;time.value=previewTime??t;
  if(growthStart===null&&!introActive)growthStart=performance.now();
  const growthTime=growthStart===null?-1:(performance.now()-growthStart)/1000;
  for(const palm of palms){const u=clamp((growthTime-palm.userData.growDelay)/palm.userData.growDuration,0,1);const eased=1-Math.pow(1-u,3);const pulse=Math.sin(Math.min(1,u)*Math.PI*1.55)*Math.pow(1-u,.42);const snap=Math.sin(Math.min(1,u)*Math.PI*3.1)*Math.pow(1-u,.8);const grow=growthEnabled&&!swimMotion.matches?Math.max(.001,eased+pulse*.42+snap*.07):1;const target=palm.userData.growScale;palm.scale.set(Math.sqrt(grow)*target,grow*target,Math.sqrt(grow)*target);for(const f of palm.userData.fronds)f.joint.rotation.z=f.baseZ+(swimMotion.matches?0:Math.sin(t*.85+f.phase+palm.userData.sway)*.025);}
  for(const reef of reefObjects){const u=clamp((growthTime-(reef.userData.spawnDelay||0))/.52,0,1);const bounce=1-Math.pow(1-u,4)+Math.sin(Math.min(1,u)*Math.PI*1.55)*Math.pow(1-u,.48)*.16;const size=growthEnabled&&!swimMotion.matches?Math.max(.001,bounce):1;reef.scale.setScalar(size*(reef.userData.spawnScale||1));reef.rotation.z=Math.sin(Math.min(1,u)*Math.PI)*.035;}
  for(const fish of marineSwimmers){
   const {model,wave,shark,silver,phase,index}=fish,speed=shark?1:silver?.24:.17,a=t*speed+phase,rx=shark?2.5:silver?2.0:1.8,rz=shark?.8:1.0;
   const x=(shark?-3.0:silver?5.4:-5.4)+Math.cos(a)*rx,z=(shark?6.6:silver?4.6:3.7)+Math.sin(a)*rz+(shark?0:(index%3)*.28);
   // Crest periodically: body stays submerged while the tall dorsal breaks water.
   const surfacing=T.MathUtils.smoothstep(Math.sin((t-(marineSwimmers[0]?.started??t))*.24+1.2),-.15,.6);
   if(fish.started===undefined)fish.started=t;
   const targetDepth=shark?T.MathUtils.lerp(.72,.36,surfacing):silver?.31:.34;
   const y=Math.max(terrainY(x,z)+(shark?.43:.14),.14-targetDepth);
   model.position.set(x,y,z);const dx=-Math.sin(a)*rx,dz=Math.cos(a)*rz;model.rotation.y=Math.atan2(-dz,dx);model.rotation.x=Math.sin(a)*.035;wave.value=t*(shark?4.8:silver?8:6)+phase;
  }


  for(const tongue of fireTongues){const flicker=fireMotionPreference.matches?0:Math.sin(t*5.1+tongue.phase)*.06+Math.sin(t*8.7+tongue.phase)*.025;tongue.mesh.scale.y=1+flicker;tongue.mesh.scale.x=1-flicker*.35;}
  if(campfireLight)campfireLight.intensity=2.8+(fireMotionPreference.matches?0:Math.sin(t*7.3)*.3+Math.sin(t*11.1)*.15);

  const state=getState(),p=state.pending,spot=WATER_SPOTS[p?.spot||state.spot],phase=phaseOf(p),ready=phase==='hooked';cameraUpdate(state,dt);
  if(p?.start!==lastCast){lastCast=p?.start;landed=false;lastNibble=-1;physics.ready=false;lastPhase='idle';}
  const seatedForward=spot.clone().sub(new T.Vector3(-1.2,.73,.35));seatedForward.y=0;seatedForward.normalize();
  // Sit at the water-facing edge; knees and feet extend beyond the deck.
  const edgeDistance=Math.min(.76/Math.max(Math.abs(seatedForward.x),.001),.12/Math.max(Math.abs(seatedForward.z),.001));
  const idleBreath=!p&&!state.aiming?Math.sin(t*1.25)*.012:0;person.position.set(-1.2,.53+idleBreath,.35).addScaledVector(seatedForward,edgeDistance);
  const forward=spot.clone().sub(person.position);forward.y=0;forward.normalize();
  const age=p?(Date.now()-p.start)/1000:0,castU=clamp(age/1.85,0,1),isCast=!!p&&age<1.85,reelAge=state.revealing?(Date.now()-state.revealStart)/1000:0,reelRaw=state.revealing?clamp(reelAge/3.2,0,1):0,hookU=state.revealing?clamp(reelAge/.20,0,1):0,hookEase=1-Math.pow(1-hookU,4),hookKick=state.revealing&&reelAge<.30?Math.sin(reelAge/.30*Math.PI):0,reelBeat=state.revealing&&reelAge>.24?Math.sin((reelAge-.24)*TAU*1.25)*(1-reelRaw)*.11:0,fight=ready&&!state.revealing?1:phase==='nibble'?.28:0,fightWave=Math.sin(t*4.7)+Math.sin(t*8.3+1.7)*.48+Math.sin(t*13.1)*.2,surge=Math.pow(Math.max(0,Math.sin(t*1.17+.8)),8),tug=fight*(fightWave*.035+surge*.082),releaseAge=state.lastRelease?(Date.now()-state.lastRelease.at)/1000:9,releaseGesture=releaseAge<1.7?Math.sin(clamp(releaseAge/1.7,0,1)*Math.PI):0;
  person.rotation.y=T.MathUtils.lerp(person.rotation.y,Math.atan2(forward.x,forward.z),.06);
  let action=0;if(isCast){if(age<.48)action=-(1-Math.pow(1-age/.48,3));else if(age<.66){const u=(age-.48)/.18;action=T.MathUtils.lerp(-1,1,1-Math.pow(1-u,4))}else if(age<1.08)action=T.MathUtils.lerp(1,.24,1-Math.pow(1-(age-.66)/.42,2));else action=T.MathUtils.lerp(.24,0,(age-1.08)/.77)}
  const shoulders=[new T.Vector3(-.23,.70,.02),new T.Vector3(.23,.70,.02)],elbows=[new T.Vector3(-.31,.53,.20+action*.12),new T.Vector3(.31,.52,.23+action*.11)],handLocal=[new T.Vector3(-.13,.44,.42+action*.23),new T.Vector3(.13,.43,.45+action*.24)];
  handLocal[0].y+=fight*.18+tug+idleBreath*.8+releaseGesture*.13;handLocal[0].z-=fight*.13-releaseGesture*.18;handLocal[1].y+=fight*.075-tug*.35+idleBreath*.5+releaseGesture*.10;handLocal[1].z+=fight*.035+releaseGesture*.15;elbows[0].y+=fight*.105+releaseGesture*.06;elbows[0].z-=fight*.08-releaseGesture*.10;elbows[1].x+=fight*.045;elbows[1].z+=fight*.035+releaseGesture*.08;
  if(state.revealing){const settle=clamp((reelAge-.20)/.55,0,1),lift=hookEase*(1-settle*.18);handLocal[0].y+=lift*.36+reelRaw*.16+reelBeat;handLocal[1].y+=lift*.30+reelRaw*.13+reelBeat*.72;handLocal[0].z-=lift*.34+reelRaw*.12;handLocal[1].z-=lift*.27+reelRaw*.08;elbows[0].y+=lift*.22;elbows[1].y+=lift*.18;elbows[0].z-=lift*.20;elbows[1].z-=lift*.15;}
  for(let i=0;i<2;i++){placeRod(upperArms[i],shoulders[i],elbows[i]);upperArms[i].scale.x=upperArms[i].scale.z=.072;placeRod(foreArms[i],elbows[i],handLocal[i]);foreArms[i].scale.x=foreArms[i].scale.z=.062;hands[i].position.copy(handLocal[i])}
  person.updateMatrixWorld(true);const start=handLocal[0].clone().add(handLocal[1]).multiplyScalar(.5).applyMatrix4(person.matrixWorld);
  const signalTension=phase==='reading'?(p.signal?.id==='deep'?.34:p.signal?.id==='broad'?.12:.20):phase==='responding'?.42:0;
  const tension=(state.revealing?.72+hookKick*1.15+hookEase*.18+Math.max(0,reelBeat)*.85:ready?.65+Math.max(0,tug)*2.2:phase==='nibble'?.25:.055)+signalTension+(bobber.visible?physics.tension*.40:0);
  bendVelocity+=(tension-bend)*30*dt;bendVelocity*=Math.exp(-6.8*dt);bend+=bendVelocity*dt;
  let angle=.68+idleBreath*1.4;if(state.aiming&&!p)angle=.75+Math.sin(t*1.8)*.018;if(isCast){if(age<.48)angle=T.MathUtils.lerp(.72,2.06,1-Math.pow(1-age/.48,3));else if(age<.66){const u=(age-.48)/.18;angle=T.MathUtils.lerp(2.06,.10,1-Math.pow(1-u,4))}else if(age<1.10)angle=T.MathUtils.lerp(.10,.55,1-Math.pow(1-(age-.66)/.44,2));else angle=T.MathUtils.lerp(.55,.68,(age-1.10)/.75)}if(ready&&!state.revealing)angle=1.00+tug*1.35;if(state.revealing){const settle=clamp((reelAge-.20)/.55,0,1),setAngle=T.MathUtils.lerp(ready?1.00:.72,1.52,hookEase);angle=T.MathUtils.lerp(setAngle,1.20,settle)+reelBeat*.72}if(releaseGesture)angle+=releaseGesture*.16;
  const tip=start.clone().addScaledVector(forward,Math.cos(angle)*3.55);tip.y=start.y+Math.sin(angle)*3.55;castTip.copy(tip);
  const pull=bobber.visible?bobber.position.clone().sub(tip).normalize():new T.Vector3(0,-1,0);
  for(let i=0;i<rodPoints.length;i++){const u=i/(rodPoints.length-1);rodPoints[i].copy(start).lerp(tip,u).addScaledVector(pull,bend*.85*u*u*u);rodPoints[i].y+=Math.sin(u*Math.PI)*.045}updateTube(rodGeo,rodPoints,.035,.14);lineAnchor.copy(rodPoints[rodPoints.length-1]);tip.copy(lineAnchor);
  idleLure.visible=!p;idleLine.visible=!p;if(!p){const sway=state.aiming?.035:.065;idleLure.position.copy(tip).add(new T.Vector3(Math.sin(t*1.7)*sway,-.34+Math.sin(t*1.35)*.025,Math.cos(t*1.4)*sway));idleLure.rotation.z=Math.sin(t*1.7)*.16;const idlePos=idleLineGeo.attributes.position;idlePos.setXYZ(0,tip.x,tip.y,tip.z);idlePos.setXYZ(1,idleLure.position.x,idleLure.position.y,idleLure.position.z);idlePos.needsUpdate=true;idleLineGeo.computeBoundingSphere()}
  bobber.visible=!!p&&p.phase==='cast';fishingLine.visible=bobber.visible;lineBorder.visible=bobber.visible;marker.visible=!p;marker.position.copy(spot);marker.position.y=.19;const focusAge=state.focusPulseAt?Math.max(0,(Date.now()-state.focusPulseAt)/1000):9,focusFlash=state.focusSpot===state.spot&&focusAge<.9?Math.max(0,1-focusAge/.9):0;marker.scale.setScalar(1+Math.sin(t*3)*.08+focusFlash*(.34+.18*Math.sin(t*12)));marker.material.opacity=state.aiming?.92:.62+focusFlash*.30;marker.material.color.set(focusFlash>.05?'#f5d58d':'#ffffdf');
  if(bobber.visible){const released=age>.55,flight=clamp((age-.55)/.94,0,1);if(!released)bobber.position.copy(tip).addScaledVector(forward,.08);else{const travel=1-Math.pow(1-flight,2.15);bobber.position.copy(start).lerp(spot,travel);bobber.position.y=T.MathUtils.lerp(start.y,.19,flight)+Math.sin(flight*Math.PI)*3.45;}if(flight>=1)bobber.position.y=.205+.018*Math.sin(t*2.1);bobber.rotation.z=Math.sin(t*1.6)*.05;
   if(!landed&&flight>=1){landed=true;if(age<2.5)splash(spot,.9)}
   if(phase==='reading'){const kind=p.signal?.id,readAge=(Date.now()-p.decisionAt)/1000;if(kind==='dart'){bobber.position.y-=Math.pow(Math.max(0,Math.sin(readAge*7.4)),7)*.095;bobber.position.x+=Math.sin(readAge*3.2)*.035}else if(kind==='deep'){bobber.position.x+=Math.min(.18,readAge*.018);bobber.position.z+=Math.min(.13,readAge*.013);bobber.rotation.z=.16}else if(kind==='broad'){bobber.rotation.z=Math.sin(readAge*1.4)*.08}else{bobber.position.y-=Math.pow(Math.max(0,Math.sin(readAge*5.5)),8)*.055}}
   if(phase==='responding')bobber.position.y-=Math.pow(Math.max(0,Math.sin((Date.now()-p.reactedAt)*.012)),5)*.13;
   if(phase==='nibble'){const pulse=Math.floor((Date.now()-(p.readyAt-2200))/550);bobber.position.y-=Math.pow(Math.max(0,Math.sin((p.readyAt-Date.now())*.011)),4)*.16;bobber.rotation.z=.23*Math.sin(t*6);if(pulse!==lastNibble){waterSystem.splash(spot.x,spot.z,.30);lastNibble=pulse}}
   if(ready){bobber.position.x+=Math.sin(t*2.35)*.11+Math.sin(t*.67)*.18;bobber.position.z+=Math.cos(t*1.85)*.09+Math.sin(t*.53)*.14;bobber.position.y-=.16+Math.pow(Math.max(0,Math.sin(t*3.15)),6)*.12+surge*.08;bobber.rotation.z=.36+fightWave*.08+surge*.18;if(lastPhase!=='hooked'){splash(spot,['bottle','bell'].includes(p.catch?.id)?.4:1.2);state.onBite?.()}else if(frame%52===0)waterSystem.splash(bobber.position.x,bobber.position.z,.18+surge*.22)}
   if(phase==='empty')bobber.rotation.z=.50;
   if(state.revealing){
    if(!lastReel){catchEndpoint.copy(spot);catchEndpoint.y=.12;catchVelocity.copy(forward).multiplyScalar(-6.2);catchVelocity.y=2.35;splash(spot,p.catch?1.55:.48);}
    const u=clamp(reelRaw/.80,0,1),ease=u*u*(3-2*u),goal=tip.clone().add(new T.Vector3(0,-1.15,0));
    goal.lerpVectors(spot,goal,ease);goal.y=T.MathUtils.lerp(.12,tip.y-1.15,ease);goal.addScaledVector(forward,-hookEase*(1-clamp((reelAge-.20)/.58,0,1))*.82);goal.y+=hookKick*.22;
    const resistance=(p.catch&&!['bottle','bell'].includes(p.catch.id)?1:.12)*(1-reelRaw),fightSide=new T.Vector3(forward.z,0,-forward.x),force=goal.sub(catchEndpoint).multiplyScalar(reelAge<.24?105:65).addScaledVector(catchVelocity,reelAge<.24?-14:-11);
    force.addScaledVector(forward,Math.sin(t*13)*resistance*2.5);force.addScaledVector(fightSide,(Math.sin(t*8.7)+Math.sin(t*13.4+1.1)*.42)*resistance*8.5);force.y-=(.55+.45*Math.sin(t*6.2))*resistance*4.8;catchVelocity.addScaledVector(force,dt);catchEndpoint.addScaledVector(catchVelocity,dt);if(frame%40===0&&catchEndpoint.y<.48&&reelRaw<.78)splash(catchEndpoint,.16+Math.abs(Math.sin(t*8.7))*.18);
    bobber.position.copy(catchEndpoint);bobber.rotation.z=Math.atan2(catchVelocity.x,8)*.6;
   }
   const castSnap=released&&flight<.16,castSlack=released&&flight<1?(flight<.18?1.004:flight<.76?1.045:1.014):1.012,castExtra=released&&flight<1?(flight<.18?.025:flight<.76?.28:.07):phase==='waiting'?.32:.05;const points=physics.update(lineAnchor,bobber.position,dt,{tight:ready||state.revealing||castSnap,slack:castSlack,extra:castExtra,reel:state.revealing});points[0].copy(lineAnchor);updateTube(lineGeo,points,.0055);updateTube(lineBorderGeo,points,.009);
  }
  const actionEl=document.querySelector('#sceneAction');if(actionEl&&!actionEl.hidden&&bobber.visible){const bp=bobber.position.clone().project(camera),rr=renderer.domElement.getBoundingClientRect();actionEl.style.left=((bp.x*.5+.5)*rr.width)+'px';actionEl.style.top=((-bp.y*.5+.5)*rr.height)+'px'}
  lastReel=state.revealing;lastPhase=phase;
  const fishApproaches=p?.catch&&!['bottle','bell'].includes(p.catch.id)&&['approach','reading','responding','nibble','hooked'].includes(phase)&&!state.revealing;
  if(fishApproaches){if(approachKey!==p.start){if(approachFish)scene.remove(approachFish);approachFish=fishModel(p.catch.id);const scale=clamp(.25+Math.sqrt(p.catch.weight)*.11,.25,.8);approachFish.scale.setScalar(scale);scene.add(approachFish);approachKey=p.start}
   const approach=clamp(1-(p.readyAt-Date.now())/5500,0,1),a=t*.6,hooked=phase==='hooked',reading=phase==='reading',signal=p.signal?.id,signalOrbit=signal==='broad'?1.05:signal==='dart'?.58:.28,offset=hooked?new T.Vector3(Math.sin(t*1.7)*.52,0,Math.cos(t*1.7)*.38):reading?new T.Vector3(Math.cos(t*(signal==='dart'?2.4:.7))*signalOrbit,0,Math.sin(t*(signal==='dart'?2.4:.7))*signalOrbit):new T.Vector3((1-approach)*2.6+Math.sin(a)*.12,0,(1-approach)*1.45);approachFish.visible=true;approachFish.position.copy(spot).add(offset);approachFish.position.y=hooked?-.24:signal==='deep'?-.78:T.MathUtils.lerp(-.72,-.28,approach);faceVelocity(approachFish,hooked?new T.Vector3(Math.cos(t*1.7),0,-Math.sin(t*1.7)):spot.clone().sub(approachFish.position));approachFish.traverse(o=>{if((o.isMesh||o.isLine)&&o.material.transparent)o.material.opacity=reading?(signal==='deep'?.07:signal==='broad'?.17:.14):phase==='nibble'?.20:hooked?.22+surge*.08:.07+approach*.09});approachFish.userData.tail&&(approachFish.userData.tail.rotation.y=Math.sin(t*(hooked?14:signal==='dart'?12:7))*(hooked?.44:.3));if((reading&&frame%(signal==='dart'?28:65)===0)||(phase==='nibble'&&frame%60===0)||(hooked&&frame%95===0))waterSystem.splash(approachFish.position.x,approachFish.position.z,hooked?.13:signal==='broad'?.16:.08);
  }else if(approachFish)approachFish.visible=false;
  if(state.revealing&&p?.catch){if(revealKey!==p.start){if(revealFish)scene.remove(revealFish);revealFish=makeSpecimen(p.catch.id,p.catch.variation);revealFish.scale.setScalar(.5);scene.add(revealFish);revealKey=p.start}revealFish.visible=true;const resistance=(['bottle','bell'].includes(p.catch.id)?.12:1)*(1-reelRaw),pullDirection=tip.clone().sub(catchEndpoint).normalize(),targetRotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(-1,0,0),pullDirection),bodyFight=new T.Quaternion().setFromEuler(new T.Euler(Math.sin(t*11.7)*.18*resistance,Math.sin(t*8.9+1.2)*.25*resistance,Math.sin(t*14.3)*.20*resistance));targetRotation.multiply(bodyFight);revealFish.quaternion.slerp(targetRotation,1-Math.exp(-dt*12));const mouth=new T.Vector3(-.9,0,0).multiplyScalar(.5).applyQuaternion(revealFish.quaternion);revealFish.position.copy(catchEndpoint).sub(mouth);if(revealFish.userData.tail)revealFish.userData.tail.rotation.y=Math.sin(t*21)*(.28+resistance*.42);}else if(revealFish)revealFish.visible=false;
  if(state.lastRelease&&releaseAge<2.05){if(releaseKey!==state.lastRelease.at){if(releaseFish)scene.remove(releaseFish);releaseFish=makeSpecimen(state.lastRelease.id,state.lastRelease.variation);releaseFish.scale.setScalar(.42);scene.add(releaseFish);releaseKey=state.lastRelease.at;releaseSplashed=false}const u=clamp(releaseAge/1.55,0,1),ease=u*u*(3-2*u),releaseStart=person.position.clone().add(new T.Vector3(0,1.05,.25).applyAxisAngle(new T.Vector3(0,1,0),person.rotation.y)),releaseEnd=WATER_SPOTS[state.lastRelease.spot||state.spot].clone().lerp(person.position,.56);releaseEnd.y=.12;releaseFish.visible=u<1;releaseFish.position.lerpVectors(releaseStart,releaseEnd,ease);releaseFish.position.y+=Math.sin(u*Math.PI)*1.35;const releaseVelocity=releaseEnd.clone().sub(releaseStart);releaseVelocity.y=(1-2*u)*2.7;faceVelocity(releaseFish,releaseVelocity);releaseFish.rotation.z=Math.sin(u*Math.PI)*.28+Math.sin(t*15)*.05*(1-u);if(releaseFish.userData.tail)releaseFish.userData.tail.rotation.y=Math.sin(t*18)*.38*(1-u);if(u>.91&&!releaseSplashed){splash(releaseEnd,.72);releaseSplashed=true}}else if(releaseFish)releaseFish.visible=false;
  droplets.forEach(d=>{if(d.life<=0)return;d.life-=dt;d.v.y-=3.5*dt;d.m.position.addScaledVector(d.v,dt);d.m.material.opacity=clamp(d.life*2,0,.8);d.m.visible=d.life>0&&d.m.position.y>.14});
  boat.rotation.z=Math.sin(t*.8)*.018;boat.position.y=.2+Math.sin(t*.9)*.026;plants.forEach((p,i)=>{p.rotation.z=Math.sin(t*.9+i)*.04});
  if(seagullFlocks.length<1&&t>nextFlockAt){nextFlockAt=t+16+rand()*18;const dir=rand()<.5?-1:1,fromX=dir>0?-22:22,startY=5.2+rand()*2,startZ=-4+rand()*7,exitZ=startZ+(rand()-.5)*8,dur=12+rand()*4,count=3+Math.floor(rand()*4),members=[];for(let mi=0;mi<count;mi++){const gull=makeSeagull();gull.visible=false;scene.add(gull);const row=Math.ceil(mi/2),side=mi===0?0:(mi%2?1:-1);members.push({gull,row,side,jitterX:(rand()-.5)*.20,jitterZ:(rand()-.5)*.22,jitterY:(rand()-.5)*.18,cycle:2.8+rand()*1.7,burst:.9+rand()*.35,flaps:2+Math.floor(rand()*2),phaseOffset:rand()*2.5,cried:false,cryAt:.22+rand()*.46})}seagullFlocks.push({members,fromX,dir,startY,startZ,exitZ,dur,t0:t,bend:(rand()-.5)*7,lift:.7+rand(),wavePhase:rand()*TAU})}
  for(let fi=seagullFlocks.length-1;fi>=0;fi--){const f=seagullFlocks[fi];const age=t-f.t0;if(age<0){f.members.forEach(m=>m.gull.visible=false);continue}const u=age/f.dur;if(u>1){f.members.forEach(m=>scene.remove(m.gull));seagullFlocks.splice(fi,1);continue}
  const pos=new T.Vector3(),ahead=new T.Vector3(),behind=new T.Vector3(),velocity=new T.Vector3(),normal=new T.Vector3(),v0=new T.Vector3(),v1=new T.Vector3();
  f.members.forEach(m=>{const delay=m.row*.035;if(u<delay){m.gull.visible=false;return}m.gull.visible=true;const q=clamp(u-delay+m.jitterX*.003,0,1);gullPath(f,q,pos);gullPath(f,Math.min(1,q+.006),ahead);gullPath(f,Math.max(0,q-.006),behind);velocity.copy(ahead).sub(behind).normalize();normal.set(-velocity.z,0,velocity.x).normalize();const yaw=-Math.atan2(velocity.z,velocity.x),pitch=Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z));v0.copy(pos).sub(behind).normalize();v1.copy(ahead).sub(pos).normalize();const turn=v0.x*v1.z-v0.z*v1.x,turnBank=clamp(turn*14,-.46,.46),lateral=m.side*m.row*.72+m.jitterZ,flapClock=(age+m.phaseOffset+m.row*.13)%m.cycle,flapping=flapClock<m.burst,flapPhase=flapping?flapClock/m.burst:0,flap=flapping?Math.sin(flapPhase*Math.PI*2*m.flaps)*.68:.035+Math.sin(age*.65+m.phaseOffset)*.018,downstroke=flapping?Math.max(0,-Math.cos(flapPhase*Math.PI*2*m.flaps)):.0;m.gull.position.copy(pos).addScaledVector(normal,lateral);m.gull.position.y+=m.jitterY+downstroke*.045;m.gull.rotation.order='YXZ';m.gull.rotation.set(turnBank+m.side*.025,yaw,pitch,'YXZ');m.gull.userData.left.root.rotation.x=-flap;m.gull.userData.right.root.rotation.x=flap;m.gull.userData.left.wrist.rotation.x=-flap*.32-.035;m.gull.userData.right.wrist.rotation.x=flap*.36+.04;m.gull.userData.left.wrist.rotation.y=flapping?-.05:-.13;m.gull.userData.right.wrist.rotation.y=flapping?.05:.13;m.gull.userData.tail.rotation.y=turnBank*.42+Math.sin(age*1.8+m.phaseOffset)*.025;if(!m.cried&&q>m.cryAt&&rand()<.012){m.cried=true;const camPos=camera.position,distToCam=m.gull.position.distanceTo(camPos),pan=clamp((m.gull.position.x-camPos.x)/14,-1,1),vol=clamp(1-distToCam/18,.05,.34);window.__seagullCry?.(pan,vol,m.gull.position)}})}
  const az=renderSettings.sunAzimuth*Math.PI/180,el=renderSettings.sunElevation*Math.PI/180;
  sun.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(21.4);
  lighting.uSunDirection.value.copy(sun.position).sub(sun.target.position).normalize();
  renderer.toneMappingExposure=renderSettings.exposure;
  renderer.toneMapping=({aces:T.ACESFilmicToneMapping,neutral:T.NeutralToneMapping,agx:T.AgXToneMapping,reinhard:T.ReinhardToneMapping,linear:T.LinearToneMapping,none:T.NoToneMapping})[renderSettings.toneMapping]??T.ACESFilmicToneMapping;
  sun.color.set(renderSettings.sunColor);lighting.uSunRadiance.value.copy(sun.color).multiplyScalar(sun.intensity);
  renderer.shadowMap.needsUpdate=frame%8===0;waterSystem.capture(camera,cameraAim);postFX.composer.render();const labelBoxes=[];for(const id of Object.keys(WATER_SPOTS)){const el=document.querySelector(`[data-spot="${id}"]`);if(el){const projected=screenPos(id),tx=clamp(projected.x,65,host.clientWidth-65),baseY=clamp(projected.y-24,125,host.clientHeight-210);let targetY=baseY;for(const box of labelBoxes){if(Math.abs(tx-box.x)<118&&Math.abs(targetY-box.targetY)<38)targetY=clamp(box.targetY+40,125,host.clientHeight-210)}let tracked=labelScreen.get(id);if(!tracked){tracked={x:tx,y:targetY};labelScreen.set(id,tracked)}tracked.x=T.MathUtils.damp(tracked.x,tx,10,dt);tracked.y=T.MathUtils.damp(tracked.y,targetY,10,dt);labelBoxes.push({x:tx,targetY});el.style.left=tracked.x.toFixed(2)+'px';el.style.top=tracked.y.toFixed(2)+'px'}}frame++;requestAnimationFrame(tick);
 }
 cameraUpdate(getState(),.016);requestAnimationFrame(tick);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;document.querySelector('#renderError').hidden=false});
 return {renderer,scene,camera,setWaterNormal:waterSystem.setNormalPreset,setWaterNormalTexture:waterSystem.setNormalTexture,setPreviewTime(value){previewTime=value;},cancelIntro,reset(){cancelIntro();yaw=.16;pitch=.86;closeYaw=closePitch=0;desiredZoom=1},zoom(delta){cancelIntro();desiredZoom=clamp(desiredZoom+delta,.75,1.65)},waitingRipple(){const state=getState(),spot=WATER_SPOTS[state.pending?.spot||state.spot],side=new T.Vector3(Math.sin(time.value*.73)*.75,0,Math.cos(time.value*.61)*.55);waterSystem.splash(spot.x+side.x,spot.z+side.z,.16)},tacticResponse(success,id){const state=getState(),spot=WATER_SPOTS[state.pending?.spot||state.spot];waterSystem.splash(spot.x,spot.z,success?(id==='shorten'?.38:.24):.12);if(id==='tease')waterSystem.splash(spot.x+.12,spot.z-.08,.16)},setWeather(id){sun.intensity=id==='rain'?1.45:id==='mist'?2.05:2.65;hemi.intensity=id==='mist'?2.05:1.85;lighting.uSunRadiance.value.copy(sun.color).multiplyScalar(sun.intensity);scene.fog.density=id==='mist'?.0028:.0019;waterSystem.setWeather(id);postFX.setWeather(id)},getStats(){return{triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries}},dispose(){stopped=true;waterSystem.dispose();postFX.dispose();renderer.dispose()}};
}

export function createSpecimenViewer(host){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(320,210,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,320/210,.1,20);camera.position.set(-.6,1,4.7);camera.lookAt(0,0,0);scene.add(new T.HemisphereLight('#fffbea','#a0bdaf',2.5));const l=new T.DirectionalLight('#fff2d8',3);l.position.set(-3,4,4);scene.add(l);let model=null,visible=false;const cache=new Map();function set(id,variation=''){if(model)scene.remove(model);const key=id+'|'+variation;if(!cache.has(key))cache.set(key,makeSpecimen(id,variation));model=cache.get(key);model.rotation.y=.18;scene.add(model);renderer.render(scene,camera)}function frame(t){if(visible&&model){model.rotation.y=Math.sin(t*.0006)*.24;model.position.y=Math.sin(t*.0015)*.035;if(model.userData.tail)model.userData.tail.rotation.y=Math.sin(t*.003)*.12;renderer.render(scene,camera)}requestAnimationFrame(frame)}requestAnimationFrame(frame);return{set,show(v){visible=v},thumbnail(id){set(id);return renderer.domElement.toDataURL('image/png')},renderer};
}

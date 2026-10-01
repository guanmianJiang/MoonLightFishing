import {palmFrondGeometry,installCoastalGarden,weatherCoastalStone} from './coastal-garden.js';
import {FERRY_ROUTES,gullRoute} from './coastal-motion.js';
import {installFishingArt,loadSpecimen,specimenIds} from './fishing-art.js';
import {renderSettings,glslNumber,settingsUniforms} from './render-settings.js';
import {createSkyTextureController,normalizeSkyTexture,skyPanoramaGLSL,skyRadianceGLSL} from './sky-settings.mjs';
import {WATER_LEVEL,waterSurfaceGLSL} from './water-surface.js';
import {installSeabedDetails} from './seabed-details.js';
import * as T from './three.module.js';
import {coastGeometry,shore,shoreGLSL,terrainY} from './coast.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {createWater} from './water.js';
import {createHeightAtmosphere} from './height-atmosphere.mjs';
import {FishingLine,dynamicTube,updateTube,phaseOf} from './fishing-motion.js';
import {fishingCue} from './fishing-rhythm.mjs';
import {sampleAnglerMotion,sampleCastMotion,reelAnimationTime,shouldStandForCatch} from './angler-motion.js';
import {castFeedback,biteStrike,landingHoldBlend,lostFightRecoil} from './angler-feedback.mjs';
import {castFlight,castLineProfile,CAST_RELEASE_TIME} from './cast-flight.mjs';
import {BaitMotion} from './bait-motion.mjs';
import {fishMouthWorld,alignFishMouth,alignFloatOverMouth,attachHookToMouth} from './fish-attachment.mjs';
import {fightPerformance,fightSurfacePulse} from './fight-performance.mjs';
import {fightOutlook} from './fight-outlook.mjs';
import {isObjectCatch} from './catch-kind.mjs';
import {fightFishMotion,biteFishPose,turnFishYaw,fightEntryPosition} from './fight-fish-motion.mjs';
import {landingPose,landingDynamics,landingFishPose} from './landing-motion.mjs';
import {fishMouthApproach} from './bait-engagement.mjs';
import {cameraTransitionBlend,castCameraBeat,fightCameraReaction,landingCameraWeight,fightCameraFov,fightCameraPose,orbitFightCameraPose,reelCameraPose,lureFocusEnvelope,lureCameraPose,landedFishCameraPose} from './fishing-camera.mjs';
import {idleLookTarget} from './idle-look.mjs';
import {solveTwoBoneIK} from './two-bone-ik.mjs';
import {supportGripTarget} from './rod-grip.mjs';
import {createComposer} from './postprocessing.js';
import {introCameraPose} from './camera-intro.js';
import {cameraStage,portraitCloseFraming,cameraSettled,cameraImpulse,viewTransitionWeight,visibleCastRanges,readyWaterGesture} from './camera-interaction.mjs';
import {sharkPatrol,sharkSwimHeight} from './marine-motion.mjs';
import {CAST_AREAS,castFootprint,castPointFromWaterTouch,readyWaterTarget} from './cast-target.mjs';
import {readingBobberMotion,nibbleBobberMotion,hookedBobberMotion} from './bobber-motion.mjs';

const TAU=Math.PI*2,clamp=T.MathUtils.clamp;
// Match the unlock sequence: nearby shallows, middle bridge water, then the outer deep water.
export const WATER_SPOTS=Object.fromEntries(Object.entries(CAST_AREAS).map(([id,[x,z]])=>[id,new T.Vector3(x,.12,z)]));
import {mat,mats,organicMaterial,timberMaterial,mesh,box,rod,placeRod,line,fin,makeSpecimen} from './scene-assets.js';
export {makeSpecimen} from './scene-assets.js';

const noiseGLSL=`
float hash(float n){return fract(sin(n)*43758.5453);}float sandNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(dot(i,vec2(1.,57.))),hash(dot(i+vec2(1,0),vec2(1.,57.))),f.x),mix(hash(dot(i+vec2(0,1),vec2(1.,57.))),hash(dot(i+1.,vec2(1.,57.))),f.x),f.y);}
vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
`;
export function createWorld(host,getState,onSpot){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor('#74c7cf');renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=renderSettings.exposure;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可旋转缩放的三维钓鱼海湾');renderer.domElement.style.touchAction='none';
 const scene=new T.Scene();scene.background=new T.Color('#74c7cf');scene.fog=null;const camera=new T.PerspectiveCamera(36,1,.1,16000);let yaw=.16,pitch=1.02,closeYaw=0,closePitch=0,zoom=1,desiredZoom=1,fightViewYaw=0,fightViewPitch=0,fightZoom=1,desiredFightZoom=1,fightViewKey=null,frame=0,cameraBlend=0,actionCameraBlend=0,lastActionFov=42,lastActionWasLure=false,landingShotAt=null,landingShotFov=42,landingShotZoom=1,initializedCamera=false,aimReturnPose=null,viewTransition=null;const cameraAim=new T.Vector3(-1,0,1),aimTargetPosition=new T.Vector3(),aimTargetLook=new T.Vector3(),lastActionPosition=new T.Vector3(),lastActionAim=new T.Vector3(),landingShotPosition=new T.Vector3(),landingShotAim=new T.Vector3(),introPosition=new T.Vector3(),introAim=new T.Vector3(),viewArcSide=new T.Vector3(),viewEndOffset=new T.Vector3();let introStart=performance.now(),introActive=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!getState().pending&&!getState().casts;
 const wireMeshes=new Map(),wireOnlyMaterial=new T.MeshBasicMaterial({color:'#245154',wireframe:true,side:T.DoubleSide}),wireOverlayMaterial=new T.MeshBasicMaterial({color:'#163a39',wireframe:true,side:T.DoubleSide,transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 let shadingMode='shaded';
 function waterWireMaterial(source,overlay,patch=false){return new T.ShaderMaterial({
  uniforms:source.uniforms,vertexShader:source.vertexShader,
  fragmentShader:patch&&!overlay?'void main(){discard;}':`void main(){gl_FragColor=vec4(${patch?'0.96,0.62,0.22,0.88':overlay?'0.04,0.18,0.20,0.72':'0.08,0.28,0.31,1.0'});}`,
  wireframe:!patch,side:T.DoubleSide,transparent:overlay||patch,depthTest:!patch,depthWrite:!overlay&&!patch,
  polygonOffset:overlay,polygonOffsetFactor:-2,polygonOffsetUnits:-2
 })}
 function patchLineGeometry(geometry){const source=geometry.getAttribute('position'),{segments:count,rings}=geometry.userData,points=[];const add=(a,b)=>{points.push(source.getX(a),source.getY(a),source.getZ(a),source.getX(b),source.getY(b),source.getZ(b))};const index=(ring,segment)=>1+(ring-1)*count+(segment%count);
  for(let ring=4;ring<=rings;ring+=4)for(let segment=0;segment<count;segment++)add(index(ring,segment),index(ring,segment+1));
  for(let segment=0;segment<count;segment+=8){add(0,index(1,segment));for(let ring=1;ring<rings;ring++)add(index(ring,segment),index(ring+1,segment))}
  const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(points,3));return lines}
 function groundWireMaterial(source,overlay){const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.wireframe=true;material.color.set(overlay?'#164043':'#245154');material.transparent=overlay;material.opacity=overlay?.72:1;material.depthWrite=!overlay;material.polygonOffset=overlay;material.polygonOffsetFactor=-2;material.polygonOffsetUnits=-2;return material}
 function updateShadingMode(){
  const present=new Set();scene.traverse(object=>{if(!object.isMesh||object.isInstancedMesh||object.userData.shadingOverlay||!object.geometry)return;
   const material=wireMeshes.get(object)?.material??object.material;
   const isPatch=object===waterSystem.patch,isWater=object===waterSystem.mesh||isPatch,isGround=object===ground;
   if(!material||Array.isArray(material)||(material.isShaderMaterial&&!isWater)||(material.transparent&&!isWater))return;
   if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();if(object.geometry.boundingSphere?.radius>80&&!isWater&&!isGround)return;
   present.add(object);let entry=wireMeshes.get(object);if(!entry){entry={material,overlay:null,renderOrder:object.renderOrder,wireOnly:isWater?waterWireMaterial(material,false,isPatch):isGround?groundWireMaterial(material,false):wireOnlyMaterial,wireOverlay:isWater?waterWireMaterial(material,true,isPatch):isGround?groundWireMaterial(material,true):wireOverlayMaterial};wireMeshes.set(object,entry)}
   object.renderOrder=isPatch&&shadingMode!=='shaded'?12:entry.renderOrder;
   if(shadingMode==='wireframe'){object.material=entry.wireOnly;if(entry.overlay)entry.overlay.visible=isPatch;}
   else{object.material=entry.material;if(shadingMode==='shaded-wireframe'){
    if(!entry.overlay){entry.overlay=isPatch?new T.LineSegments(patchLineGeometry(object.geometry),entry.wireOverlay):new T.Mesh(object.geometry,entry.wireOverlay);entry.overlay.userData.shadingOverlay=true;entry.overlay.frustumCulled=false;entry.overlay.renderOrder=isPatch?12:0;object.add(entry.overlay)}
    if(!isPatch)entry.overlay.geometry=object.geometry;entry.overlay.visible=true;
   }else if(entry.overlay)entry.overlay.visible=false;}
   if(isPatch&&shadingMode==='wireframe'&&!entry.overlay){entry.overlay=new T.LineSegments(patchLineGeometry(object.geometry),entry.wireOverlay);entry.overlay.userData.shadingOverlay=true;entry.overlay.frustumCulled=false;entry.overlay.renderOrder=12;object.add(entry.overlay)}
  });
  for(const [object,entry] of wireMeshes)if(!present.has(object)){object.material=entry.material;object.renderOrder=entry.renderOrder;entry.overlay?.removeFromParent();if(object===waterSystem.patch)entry.overlay?.geometry.dispose();if(entry.wireOnly!==wireOnlyMaterial)entry.wireOnly.dispose();if(entry.wireOverlay!==wireOverlayMaterial)entry.wireOverlay.dispose();wireMeshes.delete(object)}
 }
 function setShadingMode(mode){shadingMode=['shaded','wireframe','shaded-wireframe'].includes(mode)?mode:'shaded';updateShadingMode()}
 const focusTarget=new T.Vector3(-1,0,1),focusAim=new T.Vector3(-1,0,1);let focusBlend=0,clickedWaterPoint=null,clickedWaterSpot=null,clickedWaterAt=0;const hemi=new T.HemisphereLight('#d4e8f5','#b9ae91',1.85);scene.add(hemi);const sun=new T.DirectionalLight('#fff0d6',2.65);sun.position.set(-6,14,-15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.near=.5;sun.shadow.camera.far=60;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=4;sun.shadow.intensity=.76;scene.add(sun);scene.add(new T.AmbientLight('#d9e9ef',.22));
 // The shaders and the actual directional light share one source of truth.
 const lighting={uSunDirection:{value:sun.position.clone().sub(sun.target.position).normalize()},uSunRadiance:{value:sun.color.clone().multiplyScalar(sun.intensity)}};
 const atmosphere=createHeightAtmosphere(renderSettings,lighting,camera);
 let appliedSunAzimuth=NaN,appliedSunElevation=NaN;
 function updateSunDirection(){
  if(appliedSunAzimuth===renderSettings.sunAzimuth&&appliedSunElevation===renderSettings.sunElevation)return;
  const az=renderSettings.sunAzimuth*Math.PI/180,el=renderSettings.sunElevation*Math.PI/180;
  sun.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(21.4);
  sun.updateMatrixWorld();
  lighting.uSunDirection.value.copy(sun.position).sub(sun.target.position).normalize();
  renderer.shadowMap.needsUpdate=true;
  appliedSunAzimuth=renderSettings.sunAzimuth;appliedSunElevation=renderSettings.sunElevation;
 }
 updateSunDirection();
 // Draw the finite sky dome as a background, never as a surface in front of distant water.
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthTest:false,depthWrite:false,fog:false,vertexShader:'varying vec3 vDir;void main(){vDir=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vDir;void main(){float horizon=smoothstep(-.12,.48,vDir.y);vec3 horizonCol=vec3(.58,.86,.83),zenith=vec3(.12,.51,.70);vec3 col=mix(horizonCol,zenith,horizon);float cloud=smoothstep(.76,.90,sin(vDir.x*11.+sin(vDir.z*7.))*sin(vDir.z*8.));cloud*=smoothstep(.05,.34,vDir.y)*(1.-smoothstep(.38,.68,vDir.y));col=mix(col,vec3(.93,.96,.86),cloud*.11);gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});const sky=new T.Mesh(new T.SphereGeometry(1600,48,32),skyMat);sky.frustumCulled=false;sky.renderOrder=-3;scene.add(sky);
 let seed=456;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const geo=coastGeometry(false,{stride:2,shoreDense:true});
 const surfaceLoader=new T.TextureLoader(),sandNormal=surfaceLoader.load('./assets/sand-detail-normal.png',undefined,undefined,()=>{groundMat.normalMap=null;groundMat.needsUpdate=true;});
 const initialSkyPath=normalizeSkyTexture(renderSettings.skyTexture),skyTexture=surfaceLoader.load(initialSkyPath);skyTexture.colorSpace=T.SRGBColorSpace;skyTexture.wrapS=T.RepeatWrapping;
 skyMat.uniforms.uSky={value:skyTexture};skyMat.uniforms.uSetting_skyRotation=settingsUniforms.uSetting_skyRotation;skyMat.uniforms.uSetting_skyCloudHeight=settingsUniforms.uSetting_skyCloudHeight;Object.assign(skyMat.uniforms,atmosphere.uniforms);
 skyMat.fragmentShader=`uniform sampler2D uSky;uniform float uSetting_skyRotation,uSetting_skyCloudHeight;varying vec3 vDir;${skyPanoramaGLSL}${skyRadianceGLSL}void main(){vec3 d=normalize(vDir);vec2 uv=skyPanoramaUV(d);vec3 col=skyEnvironmentRadiance(d,texture2D(uSky,uv).rgb,cameraPosition.y);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;skyMat.needsUpdate=true;
 sandNormal.wrapS=sandNormal.wrapT=T.RepeatWrapping;sandNormal.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 sandNormal.colorSpace=T.NoColorSpace;sandNormal.repeat.setScalar(1/(4*.65));
 const sandAlbedo=surfaceLoader.load('./assets/sand-albedo.png',undefined,undefined,()=>{groundMat.map=null;groundMat.needsUpdate=true;});
 sandAlbedo.colorSpace=T.SRGBColorSpace;sandAlbedo.wrapS=sandAlbedo.wrapT=T.RepeatWrapping;sandAlbedo.repeat.setScalar(1/(4*.65));sandAlbedo.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 const groundMat=mat('#ffffff',{map:sandAlbedo,normalMap:sandNormal,normalScale:new T.Vector2(.20,.20),roughness:.98});
 const time={value:0};let previewTime=null;
 groundMat.onBeforeCompile=s=>{
  s.uniforms.uTime=time;
  Object.assign(s.uniforms,lighting,settingsUniforms);
  s.vertexShader='uniform float uTime;\nvarying vec3 vGround;\n'+noiseGLSL+shoreGLSL+waterSurfaceGLSL+'\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;\nfloat waterSide=smoothstep(2.,8.,position.z-shore(position.x));\nvec2 hp=position.xz*uSetting_underwaterReliefScale*.4;\nfloat h=sandNoise(hp+vec2(.17,-.23))-.5;\nfloat bedRelief=h*uSetting_underwaterRelief*waterSide*.08;\nfloat waterY=waterLevel+waterSurface(position.xz,uTime).z;\nfloat flooded=smoothstep(-.015,.045,shoreContactDistance(position.xz,uTime));\nfloat bedY=position.y+bedRelief;\ntransformed.y=mix(bedY,min(bedY,waterY-.045),flooded);');
  s.fragmentShader='uniform float uTime;uniform vec3 uSunDirection,uSunRadiance;varying vec3 vGround;\n'+noiseGLSL+shoreGLSL+waterSurfaceGLSL+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 untexturedNormal=normal;
#include <normal_fragment_maps>
// Retain a restrained micro normal underwater; pixel footprint owns its LOD.
float submergedNormalWeight=mix(1.,.55,smoothstep(-.15,.40,vGround.z-shore(vGround.x)));
float sandFootprint=max(length(dFdx(vGround.xz)),length(dFdy(vGround.xz)));
float normalLod=1.-smoothstep(.06,.24,sandFootprint);
normal=normalize(mix(untexturedNormal,normal,submergedNormalWeight*normalLod));
vec2 reliefP=vGround.xz*uSetting_underwaterReliefScale*.4;
float reliefX=sandNoise(reliefP+vec2(.025,0.))-sandNoise(reliefP-vec2(.025,0.));
float reliefZ=sandNoise(reliefP+vec2(0.,.025))-sandNoise(reliefP-vec2(0.,.025));
float reliefGate=smoothstep(2.,8.,vGround.z-shore(vGround.x));
normal=normalize(normal+vec3(-reliefX,0.,-reliefZ)*uSetting_underwaterRelief*reliefGate*.2);`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float d=vGround.z-shore(vGround.x);
vec3 drySand=vec3(.66,.49,.28),wetSand=vec3(.40,.285,.15),bedSand=vec3(.68,.59,.42);
float currentWaterGap=waterLevel+waterSurface(vGround.xz,uTime).z-vGround.y;
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
// Sea colour belongs to the water pass, not a blue-green seabed albedo.
float bedBlend=smoothstep(.04,.75,currentWaterGap);
sand=mix(sand,bedSand,bedBlend);
float sandDetailMask=mix(1.,.70,smoothstep(.04,.75,currentWaterGap));
float broad=sandNoise(vGround.xz*.28);
float footprint=max(fwidth(vGround.x),fwidth(vGround.z));
float grain=(sandNoise(vGround.xz*48.)-.5)*.16*(1.-smoothstep(.015,.065,footprint));
float reliefNoise=sandNoise(vGround.xz*uSetting_underwaterReliefScale*.42+vec2(.17,-.23));
float submergedRelief=(1.-smoothstep(.08,.55,currentWaterGap))*uSetting_underwaterRelief;
float sandMottle=(sandNoise(vGround.xz*3.7)-.5)*.11;
float mineral=(sandNoise(vGround.xz*13.7)-.5)*.10*(1.-smoothstep(.045,.16,footprint));
float ridges=sin(vGround.z*12.+sin(vGround.x*.8)*2.5+sandNoise(vGround.xz*.7)*3.)*.018*(1.-smoothstep(.04,.15,footprint))*(1.-wetAmount);
sand*=1.+sandDetailMask*((broad-.5)*.12+sandMottle+mineral+grain+ridges);
// Sparse world-space grains: randomised positions per cell, confined to wet sand.
vec2 sparkleUV=vGround.xz*max(uSetting_sandSparkleDensity*.34,1.);
vec2 sparkleCell=floor(sparkleUV),sandColorSparkleSeed=hash2(sparkleCell+17.3);
float sparkleDistance=length(fract(sparkleUV)-(.18+.64*sandColorSparkleSeed));
float sparkleAA=max(fwidth(sparkleDistance),.018);
float sparkleDot=1.-smoothstep(.035-sparkleAA,.035+sparkleAA,sparkleDistance);
float sparkleMask=exposedWetSand*smoothstep(.08,.55,currentWaterGap);
sand+=vec3(sparkleDot*uSetting_sandSparkleStrength*.08*sparkleMask);
// Underwater caustics are applied once in the water composite using the
// captured receiver depth, so fish and seabed receive the same field.
diffuseColor.rgb*=sand;`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(mix(.99,uSetting_wetSandRoughness,exposedWetSand)+(broad-.5)*.04*sandDetailMask,.06,1.);`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
material.specularColor*=mix(1.,uSetting_wetSandSpecular,exposedWetSand)*submergedSpecularFade;`);
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
// The water composite now lights the visible underwater receiver.
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
 const seabedDetails=installSeabedDetails(scene,shore,terrainY);
 const waterSystem=createWater(renderer,scene,time,lighting,atmosphere.uniforms);const water=waterSystem.mesh;
 waterSystem.material.uniforms.uSky.value=skyTexture;
 const skyController=createSkyTextureController(initialSkyPath,skyTexture,
  path=>surfaceLoader.loadAsync(path).then(texture=>{texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;return texture}),
  texture=>{skyMat.uniforms.uSky.value=texture;waterSystem.material.uniforms.uSky.value=texture});
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

 const palms=[];let baseY;const trunkMats=[mat('#8a6037',{roughness:.96}),mat('#a57945',{roughness:.94})],frondMats=[mat('#47764b',{flatShading:true,roughness:.74,side:T.DoubleSide}),mat('#76974e',{flatShading:true,roughness:.78,side:T.DoubleSide})],coconutMat=mat('#6f5031',{roughness:.96});
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
   const geo=palmFrondGeometry(length,width);const joint=new T.Group();joint.position.copy(crown);joint.position.y+=upper?.12:0;joint.rotation.set(0,angle,upper?.48:.06);palm.add(joint);mesh(geo,frondMats[leaf%2],joint);fronds.push({joint,baseZ:joint.rotation.z,phase:leaf*.9});
  }
  for(let i=0;i<3;i++)mesh(new T.IcosahedronGeometry(.11*scale,0),coconutMat,palm,[crown.x+Math.cos(i*2.1)*.13,crown.y-.1,crown.z+Math.sin(i*2.1)*.13]);
  const growIndex=palms.length,grove=growIndex<12?0:1,local=growIndex%12;
  palm.userData={...palm.userData,fronds,sway:rand()*TAU,growDelay:.10+grove*.36+local*.135+(local%3)*.045+rand()*.055,growDuration:.58+rand()*.24,growScale:.88+rand()*.24};palms.push(palm);return palm;
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
 const coastalGarden=installCoastalGarden(scene,shore,terrainY);

 // Pier: individual timber planks, caps, supports and a rope rail.
 const pier=new T.Group();pier.position.set(-1.2,0,-2);scene.add(pier);
 for(let i=0;i<13;i++){const z=-2.6+i*.42;const plank=box([0,.65,z],[2.05,.15,.385],timberMaterial(i%3===0?'#a8733e':i%3===1?'#85572f':'#b17d47'),pier);plank.rotation.y=(rand()-.5)*.012;for(const x of [-.79,.79])mesh(new T.CylinderGeometry(.024,.024,.009,8),mat('#3d3329',{metalness:.38,roughness:.52}),pier,[x,.731,z]);for(const dz of [-.095,.085])line([[-.78,.734,z+dz],[-.21,.735,z+dz+(rand()-.5)*.025],[.34,.735,z+dz],[.78,.734,z+dz+(rand()-.5)*.018]],'#6d482b',pier)}
 for(const x of [-.88,.88]){box([x,.43,0],[.16,.22,5.75],mat('#4c3627',{roughness:.86}),pier);for(const z of [-2.85,0,2.6]){mesh(new T.CylinderGeometry(.11,.15,2.35,12),mat('#4d3527',{roughness:.88}),pier,[x,-.12,z]);mesh(new T.CylinderGeometry(.15,.15,.09,12),mat('#e4d6aa',{roughness:.78}),pier,[x,1.09,z]);const coil=mesh(new T.TorusGeometry(.145,.018,8,28),mat('#b9a476',{roughness:.92}),pier,[x,.84,z]);coil.rotation.x=Math.PI/2;}}
 for(const x of [-.83,.83])for(const z of [-2.7,2.42])rod([x,.34,z],[x,-.63,z+(z<0?.58:-.58)],.055,mat('#5a402e',{roughness:.9}),pier);
 for(const z of [-2.7,2.45])for(const x of [-.91,.91])box([x,.46,z],[.21,.31,.075],mat('#374946',{metalness:.28,roughness:.56}),pier);
 for(const x of [-.89,.89]){const points=[];for(let i=0;i<=20;i++){const z=-2.8+i/20*2.8;points.push([x,.95-Math.sin(i/20*Math.PI)*.25,z])}line(points,'#b6aa86',pier)}
 // Authored PBR rowboat from the project's Arts library, converted to a mobile web LOD.
 const boat=new T.Group();boat.position.set(-4.55,WATER_LEVEL+.13,-1.42);boat.rotation.y=-.24;scene.add(boat);
 new GLTFLoader().load('./assets/models/gf_rowboat_335_a.glb',gltf=>{const model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=.62;o.material.roughness=Math.max(.46,o.material.roughness||0)}});const bounds=new T.Box3().setFromObject(model);model.position.y-=bounds.min.y+.18;boat.add(model)},undefined,error=>console.warn('Rowboat asset could not load',error));
 rod([-.63,.42,-.72],[.82,.62,.98],.025,mats.edge,boat);const paddle=box([.91,.65,1.08],[.25,.055,.54],mat('#a97642',{roughness:.72}),boat);paddle.rotation.y=.63;
 line([[-2.05,.95,-2],[-2.75,.35,-2.2],[-3.5,.4,-2.5]],'#dacda6',scene);

 const umbrella=new T.Group();umbrella.position.set(-5.5,terrainY(-5.5,-7),-7);scene.add(umbrella);rod([0,0,0],[0,2.9,0],.045,mats.cream,umbrella);

 const umbrellaFabric=[organicMaterial('#cbb78a',true),organicMaterial('#be5837',true)];
 for(let panel=0;panel<10;panel++){const vertices=[],indices=[];for(let ring=0;ring<=6;ring++)for(let seg=0;seg<=6;seg++){const radius=ring/6*1.75,angle=(panel+seg/6)/10*TAU;vertices.push(Math.cos(angle)*radius,3.1-.72*Math.pow(radius/1.75,1.65)-.12*Math.sin(seg/6*Math.PI)*Math.pow(radius/1.75,1.2),Math.sin(angle)*radius)}for(let ring=0;ring<6;ring++)for(let seg=0;seg<6;seg++){const i=ring*7+seg;indices.push(i,i+1,i+7,i+1,i+8,i+7)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const canopy=mesh(g,umbrellaFabric[panel%2],umbrella);canopy.receiveShadow=true}mesh(new T.SphereGeometry(.09,20,12),mats.cream,umbrella,[0,3.12,0]);

 const chair=new T.Group();chair.position.set(-4.8,terrainY(-4.8,-6.6),-6.6);chair.rotation.y=.15;scene.add(chair);for(const x of [-.36,.36]){rod([x,0,-.45],[x,.8,.3],.035,mats.wood,chair);rod([x,0,.45],[x,.65,-.25],.035,mats.wood,chair);rod([x,.5,-.25],[x,1.35,-.65],.035,mats.wood,chair)}box([0,.56,0],[.66,.055,.62],mat('#95b8ab'),chair);const back=box([0,.98,-.44],[.66,.79,.05],mat('#95b8ab'),chair);back.rotation.x=-.42;
 // Authored Blender props retain the procedural versions until loading succeeds.
 const beachLoader=new GLTFLoader();
 const ferryObjects=[];
 function prepareBeachProp(model){model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){material.envMapIntensity=.65;}}});return model}
 function loadDistantFerry(route){const {name,position,scale,speed,phase,range,heading}=route;beachLoader.load(`./assets/models/${name}.glb?v=2`,gltf=>{const model=prepareBeachProp(gltf.scene);model.position.set(...position);model.rotation.y=heading;model.scale.setScalar(scale);model.userData={ferrySpeed:speed,ferryPhase:phase,range,startX:position[0],baseY:position[1],baseZ:position[2]};scene.add(model);ferryObjects.push(model)},undefined,error=>console.warn('Distant ferry could not load',name,error));}
 for(const route of FERRY_ROUTES)loadDistantFerry(route);
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
  const prototype=weatherCoastalStone(prepareBeachProp(gltf.scene));
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
 const person=new T.Group();person.position.set(-1.25,.73,.0);person.rotation.y=.08;scene.add(person);const skin=mat('#c98f68',{roughness:.82}),shirt=mat('#3e7165',{roughness:.90}),pants=mat('#29464b',{roughness:.95}),shoe=mat('#382f29',{roughness:.98});
 mesh(new T.CapsuleGeometry(.255,.45,10,24),shirt,person,[0,.50,0]);box([0,.48,-.19],[.38,.44,.08],mat('#284f4b',{roughness:.94}),person);mesh(new T.CylinderGeometry(.17,.205,.13,28),skin,person,[0,.83,0]);mesh(new T.SphereGeometry(.215,32,24),skin,person,[0,.99,0]);
 mesh(new T.SphereGeometry(.032,16,12),mats.edge,person,[-.17,1.01,.12]);mesh(new T.SphereGeometry(.032,16,12),mats.edge,person,[.17,1.01,.12]);mesh(new T.SphereGeometry(.045,16,12),skin,person,[0,.97,.205],[.8,1,1]);const mouth=line([[-.06,.90,.202],[0,.885,.218],[.06,.90,.202]],'#805f4c',person);mouth.material.opacity=.62;
 const hatStart=person.children.length;
 mesh(new T.CylinderGeometry(.36,.37,.042,48),mat('#ead99d',{roughness:.95}),person,[0,1.16,0]);mesh(new T.CylinderGeometry(.195,.25,.16,36),mat('#e7d393',{roughness:.95}),person,[0,1.25,0]);mesh(new T.TorusGeometry(.222,.018,12,40),mats.edge,person,[0,1.19,0]).rotation.x=Math.PI/2;
 const hatParts=person.children.slice(hatStart);
 const limbGeo=new T.CylinderGeometry(1,.86,1,12);const upperArms=[],foreArms=[];for(let i=0;i<2;i++){upperArms.push(mesh(limbGeo,shirt,person));foreArms.push(mesh(limbGeo,skin,person));}
 const thighs=[],shins=[],feet=[];for(const sign of [-1,1]){const hip=new T.Vector3(sign*.15,.29,.02),knee=new T.Vector3(sign*.21,.12,.35),ankle=new T.Vector3(sign*.22,-.18,.49);const thigh=mesh(limbGeo,pants,person),shin=mesh(limbGeo,pants,person);placeRod(thigh,hip,knee);thigh.scale.x=thigh.scale.z=.105;placeRod(shin,knee,ankle);shin.scale.x=shin.scale.z=.085;const foot=mesh(new T.CapsuleGeometry(.085,.19,8,16),shoe,person,[ankle.x,ankle.y-.01,ankle.z+.09]);foot.rotation.x=Math.PI/2;thighs.push(thigh);shins.push(shin);feet.push(foot);}
 const hands=[mesh(new T.CapsuleGeometry(.055,.065,6,12),skin,person),mesh(new T.CapsuleGeometry(.055,.065,6,12),skin,person)];

 const rodGeo=dynamicTube(28),fishingRod=mesh(rodGeo,mat('#6c5135',{roughness:.38}),scene);
 const lineCalmColor=new T.Color('#fff7cf'),lineAlarmColor=new T.Color('#deaa75'),lineBorderCalm=new T.Color('#164944'),lineBorderAlarm=new T.Color('#83523e');
 const lineGeo=dynamicTube(38),fishingLine=mesh(lineGeo,new T.MeshBasicMaterial({color:'#fff7cf',side:T.DoubleSide,transparent:true,opacity:.84,depthWrite:false}),scene);fishingLine.castShadow=false;fishingLine.renderOrder=8;const lineBorderGeo=dynamicTube(38),lineBorder=mesh(lineBorderGeo,new T.MeshBasicMaterial({color:'#164944',side:T.DoubleSide,transparent:true,opacity:.22,depthWrite:false}),scene);lineBorder.castShadow=false;lineBorder.renderOrder=7;
 const leaderPositions=new Float32Array(6),leaderGeo=new T.BufferGeometry();leaderGeo.setAttribute('position',new T.BufferAttribute(leaderPositions,3).setUsage(T.DynamicDrawUsage));const leaderLine=new T.Line(leaderGeo,new T.LineBasicMaterial({color:'#e1e9d1',transparent:true,opacity:.72,depthWrite:false}));leaderLine.visible=false;leaderLine.renderOrder=8;leaderLine.userData.excludeFromRefraction=true;scene.add(leaderLine);
 const caughtHook=new T.Group();line([[0,.055,0],[0,-.025,0],[.035,-.075,0],[.085,-.035,0]],'#514d3c',caughtHook);caughtHook.visible=false;scene.add(caughtHook);
 const lineAnchor=new T.Vector3(),catchEndpoint=new T.Vector3(),catchVelocity=new T.Vector3();
 fishingLine.userData.excludeFromRefraction=true;lineBorder.userData.excludeFromRefraction=true;
 // Draw sky behind all geometry; the dome must never obscure the distant seabed.
 sky.renderOrder=-1000;sky.material.depthTest=false;
 const physics=new FishingLine(38),baitMotion=new BaitMotion(),baitOffset={x:0,z:0},rodPoints=Array.from({length:28},()=>new T.Vector3()),castOrigin=new T.Vector3();let bend=0,bendVelocity=0,rodLag=0,rodLagVelocity=0,lastRodAngle=.68,lastFightRodAngle=1.2,lastLossAt=0,lossRecoilStart=null,reelPose=0,gestureSide=0,gestureLift=0,gestureLower=0,standBlend=0,lastTime=0,lastCast=null,lastPhase='idle',lastReel=false,fightSurfaceTracker=null,landed=false,castReleased=false;
 const bobber=new T.Group();mesh(new T.CylinderGeometry(.032,.040,.31,20),mats.red,bobber,[0,.24,0]);mesh(new T.SphereGeometry(.095,24,16),mats.cream,bobber,[0,.055,0],[.82,1.45,.82]);mesh(new T.CylinderGeometry(.018,.018,.18,10),mats.edge,bobber,[0,-.12,0]);const floatBead=mesh(new T.SphereGeometry(.028,12,8),mat('#967b58',{roughness:.68}),bobber,[0,-.235,0]);const hookLine=line([[0,-.20,0],[0,-.39,.01],[.055,-.48,.01],[.12,-.45,.01]],'#3f4e48',bobber);hookLine.material.linewidth=2;mesh(new T.SphereGeometry(.055,12,8),mat('#8e613d',{roughness:.82}),bobber,[.11,-.43,.01],[1.35,.78,.8]);bobber.scale.setScalar(.96);scene.add(bobber);
 const cueRing=new T.Mesh(new T.RingGeometry(.24,.275,48),new T.MeshBasicMaterial({color:'#bde8dc',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));cueRing.rotation.x=-Math.PI/2;cueRing.renderOrder=10;cueRing.visible=false;scene.add(cueRing);
 const cueCore=new T.Mesh(new T.RingGeometry(.105,.125,40),new T.MeshBasicMaterial({color:'#bde8dc',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));cueCore.rotation.x=-Math.PI/2;cueCore.renderOrder=10;cueCore.visible=false;scene.add(cueCore);
 const idleLure=new T.Group();mesh(new T.SphereGeometry(.045,12,8),mat('#e5bf68',{emissive:'#6b4b20',emissiveIntensity:.08}),idleLure);mesh(new T.ConeGeometry(.024,.11,8),mats.edge,idleLure,[0,-.075,0]);scene.add(idleLure);const idleLineGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),idleLine=new T.Line(idleLineGeo,new T.LineBasicMaterial({color:'#fff4ce',transparent:true,opacity:.7}));idleLine.renderOrder=8;scene.add(idleLine);
 const fishingArt=installFishingArt({scene,person,idleLure,bobber,caughtHook,terrainY,hatParts,hookParts:[hookLine,bobber.children[5]],upperArms,foreArms,thighs,shins,bodyParts:person.children.filter(o=>!hatParts.includes(o)&&!upperArms.includes(o)&&!foreArms.includes(o)&&!hands.includes(o)&&!thighs.includes(o)&&!shins.includes(o)&&!feet.includes(o))});
 const droplets=[];const dropGeo=new T.SphereGeometry(1,8,6),dropMat=new T.MeshBasicMaterial({color:'#d8eee2',transparent:true,opacity:.8});for(let i=0;i<48;i++){const m=mesh(dropGeo,dropMat.clone(),scene);m.visible=false;m.castShadow=false;droplets.push({m,v:new T.Vector3(),life:0})}
 function splash(pos,strength=.6){waterSystem.splash(pos.x,pos.z,strength);for(let i=0;i<Math.min(24,Math.floor(strength*14));i++){const d=droplets.find(v=>v.life<=0);if(!d)break;const angle=rand()*TAU;d.life=.5+rand()*.3;d.m.visible=true;d.m.position.copy(pos);d.m.position.y=.19;d.m.scale.setScalar(.025+rand()*.025);d.v.set(Math.cos(angle)*strength,.7+rand()*1.1*strength,Math.sin(angle)*strength)}}
 let approachFish=null,approachKey=null,approachHookRestY=-.25,preparedFish=null,preparedFishKey=null,fightFish=null,fightKey=null,fightEntryAge=1,revealFish=null,revealKey=null,releaseFish=null,releaseKey=null,releaseSplashed=false,fishMotion=null,lastFightDepth=null,lastBreachSoundAt=0;const revealOrigin=new T.Vector3(),revealHold=new T.Vector3(),revealPullDirection=new T.Vector3(),fightEntryOrigin=new T.Vector3();const revealAssets=new Map();
 function hookWorld(){bobber.updateMatrixWorld(true);return bobber.localToWorld(new T.Vector3(.11+baitOffset.x,-.43,.01+baitOffset.z))}

 const marker=new T.Mesh(new T.RingGeometry(.32,.355,48),new T.MeshBasicMaterial({color:'#ffffdf',side:T.DoubleSide,transparent:true,opacity:.8}));marker.rotation.x=-Math.PI/2;marker.position.y=.19;scene.add(marker);marker.renderOrder=5;
 const castRanges=Object.fromEntries(Object.entries(CAST_AREAS).map(([id,center])=>{
  const points=castFootprint(id),fillVertices=[],edgeVertices=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   const inset=(point,width)=>{const dx=point[0]-center[0],dz=point[1]-center[1],scale=Math.max(0,1-width/Math.max(width,Math.hypot(dx,dz)));return [center[0]+dx*scale,center[1]+dz*scale]};
   const haloA=inset(a,.68),haloB=inset(b,.68),innerA=inset(a,.075),innerB=inset(b,.075);
   fillVertices.push(a[0],.185,a[1],b[0],.185,b[1],haloA[0],.185,haloA[1],b[0],.185,b[1],haloB[0],.185,haloB[1],haloA[0],.185,haloA[1]);
   edgeVertices.push(a[0],.195,a[1],b[0],.195,b[1],innerA[0],.195,innerA[1],b[0],.195,b[1],innerB[0],.195,innerB[1],innerA[0],.195,innerA[1]);
  }
  const makeSurface=(vertices,color)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();const material=new T.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});const surface=new T.Mesh(geometry,material);surface.visible=false;surface.renderOrder=4;surface.userData.excludeFromRefraction=true;scene.add(surface);return surface};
  return [id,{fill:makeSurface(fillVertices,'#b8e9db'),edge:makeSurface(edgeVertices,'#f1f3d7')}];
 }));
 const markerCore=new T.Mesh(new T.CircleGeometry(.065,20),new T.MeshBasicMaterial({color:'#fff1b4',side:T.DoubleSide,transparent:true,opacity:.92,depthWrite:false}));markerCore.rotation.x=-Math.PI/2;markerCore.renderOrder=6;scene.add(markerCore);
 const selectionPulse=new T.Mesh(new T.RingGeometry(.36,.4,48),new T.MeshBasicMaterial({color:'#e8f5d7',side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false}));selectionPulse.rotation.x=-Math.PI/2;selectionPulse.renderOrder=7;selectionPulse.visible=false;scene.add(selectionPulse);let selectionPulseAt=-Infinity,selectionPulsePoint=null;
 const focusRing=new T.Mesh(new T.RingGeometry(.23,.26,48),new T.MeshBasicMaterial({color:'#f8edca',side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false}));focusRing.rotation.x=-Math.PI/2;focusRing.renderOrder=6;focusRing.visible=false;scene.add(focusRing);
 function castSpot(state){const point=state.pending?.castPoint||state.aimPoint;return Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)?new T.Vector3(point[0],.12,point[1]):WATER_SPOTS[state.pending?.spot||state.spot]}

 function faceVelocity(f,v){if(v.lengthSq()>1e-6)f.rotation.y=Math.atan2(v.z,-v.x)}
 function turnFishToward(f,v,dt){f.rotation.y=turnFishYaw(f.rotation.y,v,dt)}
 const submergedTint=new T.Color('#70aaa8');
 function setFishImmersion(model,amount){
  model.traverse(o=>{if(!o.isMesh||!o.material?.color)return;
   if(!o.userData.fightMaterial){o.material=o.material.clone();o.userData.fightMaterial={color:o.material.color.clone(),opacity:o.material.opacity,transparent:o.material.transparent,depthWrite:o.material.depthWrite}}
   const base=o.userData.fightMaterial;
   o.material.color.copy(base.color).lerp(submergedTint,amount*.42);
   // Water absorption happens in the surface pass. Fading the fish material
   // and disabling depth here makes the refraction capture use the seabed
   // behind the fish as its optical path length.
   o.material.opacity=base.opacity;
   o.material.transparent=base.transparent;
   o.material.depthWrite=base.depthWrite;
  });
 }
 const marineSwimmers=[],swimMotion=matchMedia('(prefers-reduced-motion: reduce)'),growthEnabled=true;let growthStart=null;
 const sharkPath=[0,0,0,0];
 for(const [name,count] of [['reef_shark',1],['shoal_fish',8],['silver_fish',5]])beachLoader.load(`./assets/models/${name}.glb?v=2`,gltf=>{
  for(let i=0;i<count;i++){
   const shark=name==='reef_shark',model=gltf.scene.clone(true),phase=shark?.8:i*.17;
   const wave={value:0};
   model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.material=o.material.clone();o.material.transparent=false;o.material.opacity=1;o.material.depthTest=true;o.material.depthWrite=true;if(shark)o.material.color.lerp(new T.Color('#167e98'),.55);o.material.onBeforeCompile=shader=>{shader.uniforms.uSwim=wave;shader.vertexShader='uniform float uSwim;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float tailWeight=(1.-smoothstep(${shark?'-1.7,0.65':'-0.42,0.16'},position.x));
transformed.y+=sin(uSwim+position.x*${shark?'3.2':'12.'})*tailWeight*tailWeight*${shark?'.13':'.045'};
`)};o.material.customProgramCacheKey=()=>shark?'shark-wave':'shoal-wave';}});
   scene.add(model);marineSwimmers.push({model,wave,shark,silver:name==='silver_fish',phase,index:i});
  }
 },undefined,error=>console.warn('Marine asset could not load',name,error));

function birdSurface(points,indices,material){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();const surface=new T.Mesh(geo,material);surface.castShadow=false;return surface}
let gullPrototype=null;
 beachLoader.load('./assets/models/angler-gull/seagull.glb?v=5',g=>{gullPrototype=g.scene},undefined,error=>console.warn('Seagull model unavailable',error));
function makeSeagull(){
 if(gullPrototype){const g=gullPrototype.clone(true);g.scale.setScalar(.75);g.userData={left:{root:g.getObjectByName('Wing_L'),wrist:g.getObjectByName('Wrist_L')},right:{root:g.getObjectByName('Wing_R'),wrist:g.getObjectByName('Wrist_R')},tail:g.getObjectByName('Gull_tail')};return g}
 const g=new T.Group(),white=mat('#f5f1e7',{roughness:.88}),grey=mat('#aeb6b3',{roughness:.9}),dark=mat('#303b3b',{roughness:.92,side:T.DoubleSide}),beakMat=mat('#e4a13a',{roughness:.72}),eyeMat=mat('#182321',{roughness:.7});
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
 function gullPath(f,q,out){q=clamp(q,0,1);const v=1-q,b0=v*v*v,b1=3*v*v*q,b2=3*v*q*q,b3=q*q*q,p0x=f.fromX,p3x=-f.fromX,p1x=p0x+f.dir*24,p2x=p3x-f.dir*24,p0z=f.startZ,p3z=f.exitZ,p1z=p0z+f.bend,p2z=p3z-f.bend*.48;return out.set(p0x*b0+p1x*b1+p2x*b2+p3x*b3,f.startY+Math.sin(q*Math.PI)*f.lift+Math.sin(q*TAU+f.wavePhase)*.14,p0z*b0+p1z*b1+p2z*b2+p3z*b3)}


 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();waterSystem.resize(w,h);postFX.resize(w,h)}
 new ResizeObserver(resize).observe(host);resize();
 function transitionView(targetBlend,duration=760){
  viewTransition={position:camera.position.clone(),aim:cameraAim.clone(),fov:camera.fov,zoom:camera.zoom,start:performance.now(),duration,targetBlend};
  cameraBlend=targetBlend;
 }
 function cameraUpdate(state,dt){
  const castPhase=phaseOf(state.pending),stage=cameraStage(state,castPhase),active=stage!=='overview'&&(stage!=='survey'||state.keepFishingView);cameraBlend=viewTransition?viewTransition.targetBlend:T.MathUtils.damp(cameraBlend,active?1:0,active?2.7:2.3,dt);
  const fightKey=state.pending?.fight?.status==='active'?(state.pending.liftedAt??state.pending.start):null;
  if(fightKey!==null&&fightViewKey!==fightKey){fightViewKey=fightKey;fightViewYaw=fightViewPitch=0;fightZoom=desiredFightZoom=1}
  else if(fightKey===null&&!state.pending?.landedFromFight)fightViewKey=null;
  fightZoom=T.MathUtils.damp(fightZoom,desiredFightZoom,5,dt);
  zoom=T.MathUtils.damp(zoom,desiredZoom,5,dt);const aspect=host.clientWidth/host.clientHeight,portrait=aspect<.8,dist=portrait?48:34,overviewTarget=portrait?new T.Vector3(2.5,0,7.0):new T.Vector3(1.0,0,7.5);
  if(state.pending&&stage==='overview')overviewTarget.lerp(castSpot(state),.66);
  else if(state.aiming&&stage==='overview')overviewTarget.lerp(WATER_SPOTS[state.spot],.55);
  const waterFocus=clickedWaterPoint?.clone().sub(overviewTarget).clampLength(0,8).add(overviewTarget),requestedFocus=waterFocus||WATER_SPOTS[state.focusSpot||state.spot],focusAge=clickedWaterPoint?Math.max(0,(performance.now()-clickedWaterAt)/1000):state.focusPulseAt?Math.max(0,(Date.now()-state.focusPulseAt)/1000):9,focusActive=!!(clickedWaterPoint||state.focusSpot)&&!state.pending&&!state.aiming,focusFrame=clickedWaterPoint?.58:.78;focusBlend=T.MathUtils.damp(focusBlend,focusActive?1:0,2.5,dt);focusTarget.lerp(requestedFocus||overviewTarget,1-Math.exp(-dt*(focusActive?3.5:3)));focusAim.lerp(requestedFocus||overviewTarget,1-Math.exp(-dt*(focusActive?3.2:3.4)));const overview=new T.Vector3(overviewTarget.x+Math.sin(yaw)*dist*Math.cos(pitch),dist*Math.sin(pitch),overviewTarget.z+Math.cos(yaw)*dist*Math.cos(pitch));overview.lerp(new T.Vector3(focusTarget.x+Math.sin(yaw)*dist*.78*Math.cos(pitch),dist*Math.sin(pitch)*.88,focusTarget.z+Math.cos(yaw)*dist*.78*Math.cos(pitch)),focusBlend*focusFrame);
  const spot=stage==='aim'?WATER_SPOTS[state.spot]:castSpot(state),origin=new T.Vector3(-1.25,1.35,.1),forward=spot.clone().sub(origin);forward.y=0;forward.normalize();forward.applyAxisAngle(new T.Vector3(0,1,0),closeYaw);const right=new T.Vector3(forward.z,0,-forward.x),bite=castPhase==='hooked'||stage==='landing',isAiming=stage==='aim';
  const castAge=state.pending?(Date.now()-state.pending.start)/1000:9;
  const castBeat=state.pending&&castAge<2.25?castCameraBeat(castAge):castCameraBeat(-1);
  const anticipate=castBeat.brace,releaseBeat=castBeat.follow;
  const reelAge=state.revealing?(Date.now()-state.revealStart)/1000:9;
  const lostFishReel=state.revealing&&state.pending?.start===state.fightLoss?.castStart,lossHold=lostFishReel&&reelAge<.62;
  const hookBeat=state.revealing&&reelAge<.30?Math.sin(reelAge/.30*Math.PI):0;
  const fishHook=stage==='landing'&&state.pending?.catch&&!isObjectCatch(state.pending.catch);
  const fishInRaw=clamp((reelAge-1.05)/.55,0,1),fishOutRaw=clamp((reelAge-2.70)/.45,0,1);
  const fishReady=T.MathUtils.smoothstep(catchEndpoint.y,.55,1.35)*(1-T.MathUtils.smoothstep(catchEndpoint.distanceTo(person.position),3.5,5.5));
  const fishFeature=fishHook*fishReady*(fishInRaw*fishInRaw*(3-2*fishInRaw))*(1-fishOutRaw*fishOutRaw*(3-2*fishOutRaw));
  const spotRange=spot.distanceTo(origin),rangeBlend=clamp((spotRange-3.4)/8.4,0,1);
  const closeDist=portrait?(isAiming?-7.3:-7.7):isAiming?-6:bite?-6.9:-6.5;
  const portraitFrame=portraitCloseFraming(rangeBlend,isAiming),closeSide=portrait?portraitFrame.side:T.MathUtils.lerp(4.2,3.4,rangeBlend);
  const reelSide=state.revealing?T.MathUtils.smoothstep(reelAge-(lostFishReel?.62:0),0,.42):0;
  const close=origin.clone().addScaledVector(forward,closeDist-anticipate*.48+releaseBeat*.82-hookBeat*.12+reelSide*.65).addScaledVector(right,closeSide-releaseBeat*.28+reelSide*(portrait?1.6:3.0));
  close.y=(portrait?(isAiming?4.65:3.9):isAiming?2.75:bite?2.95:2.85)+closePitch*1.15+anticipate*.12-releaseBeat*.09+hookBeat*.07+reelSide*.45;
  const aim=spot.clone().lerp(origin,portrait?portraitFrame.aimMix:isAiming?.23:.17);aim.y=(bite?.65:isAiming?.20:.13)+closePitch*.24;if(state.pending&&castPhase!=='casting'&&bobber.visible)aim.lerp(bobber.position,.65);
  if(isAiming&&state.aimPoint){const preview=new T.Vector3(state.aimPoint[0],.12,state.aimPoint[1]);aim.lerp(preview,.24)}
  if(isAiming){aimTargetPosition.copy(close);aimTargetLook.copy(aim)}
  if(stage==='casting'){
   if(bobber.visible)aim.lerp(bobber.position,castBeat.follow*.40);
  }
  // Action shots follow the cast line itself. A prior free-look yaw must not
  // push the fish or angler outside a narrow portrait frame.
  const shotForward=spot.clone().sub(person.position);shotForward.y=0;shotForward.normalize();
  const shotRight=new T.Vector3(shotForward.z,0,-shotForward.x);
  const fighting=stage==='fight';
  const landedWaiting=stage!=='overview'&&!!state.pending?.landedFromFight&&!state.revealing;
  const lureCueAt=state.pending?.decisionAt??(state.pending?.readyAt-2200);
  const inspectWeight=stage==='bite'&&castPhase==='reading'?cameraImpulse((Date.now()-state.inspectBiteAt)/1000,.8)*.58:0;
  const lureWeight=stage==='bite'&&!fishHook&&['reading','responding','nibble'].includes(castPhase)&&Number.isFinite(lureCueAt)?Math.max(inspectWeight,lureFocusEnvelope((Date.now()-lureCueAt)/1000)):0;
  actionCameraBlend=cameraTransitionBlend(actionCameraBlend,fighting||lossHold||landedWaiting||fishHook||lureWeight>.001,dt);
  let actionWeight=T.MathUtils.smoothstep(actionCameraBlend,0,1),cameraActionStrength=actionWeight;
  let actionFov=portrait?44:42;
  if(fighting){
   lastActionWasLure=false;
   const fishPoint=fishMotion?new T.Vector3(fishMotion.position.x,fishMotion.position.y,fishMotion.position.z):bobber.position;
   const shot=orbitFightCameraPose(fightCameraPose(person.position,fishPoint,shotForward,shotRight,portrait),fightViewYaw,fightViewPitch);
   const reaction=fightCameraReaction(state.pending?.fight);
   shot.position.addScaledVector(shotRight,reaction.pull*.23).addScaledVector(shotForward,-reaction.pull*.16);
   const lineDanger=clamp((fightOutlook(state.pending?.fight).lineRisk-.55)/.35,0,1);if(lineDanger>0){const rodFocus=person.position.clone().lerp(lineAnchor,.5);rodFocus.y=Math.max(rodFocus.y,1.7);shot.aim.lerp(rodFocus,lineDanger*.9)}
   close.lerp(shot.position,actionWeight);aim.lerp(shot.aim,actionWeight);
   actionFov=fightCameraFov(fishPoint.distanceTo(person.position),portrait)+reaction.open*1.8;
   lastActionPosition.copy(shot.position);lastActionAim.copy(shot.aim);lastActionFov=actionFov;
  }else if(landedWaiting&&fightFish){
   lastActionWasLure=false;
   const shot=orbitFightCameraPose(fightCameraPose(person.position,fightFish.position,shotForward,shotRight,portrait),fightViewYaw,fightViewPitch);
   close.lerp(shot.position,actionWeight);aim.lerp(shot.aim,actionWeight);
   actionFov=fightCameraFov(fightFish.position.distanceTo(person.position),portrait);
   lastActionPosition.copy(shot.position);lastActionAim.copy(shot.aim);lastActionFov=actionFov;
  }else if(fishHook){
   lastActionWasLure=false;
   if(state.pending?.landedFromFight&&landingShotAt!==state.revealStart){landingShotAt=state.revealStart;landingShotPosition.copy(camera.position);landingShotAim.copy(cameraAim);landingShotFov=camera.fov;landingShotZoom=camera.zoom}
   const fishFocus=revealFish?.visible?new T.Box3().setFromObject(revealFish).getCenter(new T.Vector3()):catchEndpoint;
   const shot=reelCameraPose(person.position,fishFocus,shotForward,shotRight,portrait);
   actionFov=portrait?42:39;
   if(fishFeature>.001&&revealFish?.visible){
    const detail=landedFishCameraPose(person.position,fishFocus,shotForward,shotRight,portrait);
    shot.position.lerp(detail.position,fishFeature);shot.aim.lerp(detail.aim,fishFeature);
    actionFov=T.MathUtils.lerp(actionFov,portrait?39:37,fishFeature);
   }
   if(state.pending?.landedFromFight){const revealWeight=landingCameraWeight(reelAge,true);shot.position.copy(landingShotPosition).lerp(shot.position,revealWeight);shot.aim.copy(landingShotAim).lerp(shot.aim,revealWeight);actionFov=T.MathUtils.lerp(landingShotFov,actionFov,revealWeight)}
   close.lerp(shot.position,actionWeight);aim.lerp(shot.aim,actionWeight);
   lastActionPosition.copy(shot.position);lastActionAim.copy(shot.aim);lastActionFov=actionFov;
  }else if(lureWeight>.001){
   lastActionWasLure=true;
   const shot=lureCameraPose(bobber.position,shotForward,shotRight,portrait);
   cameraActionStrength=actionWeight*lureWeight;
   close.lerp(shot.position,cameraActionStrength);aim.lerp(shot.aim,cameraActionStrength);
   actionFov=T.MathUtils.lerp(portrait?44:42,portrait?37:35,lureWeight);
   lastActionPosition.copy(shot.position);lastActionAim.copy(shot.aim);lastActionFov=actionFov;
  }else if(actionWeight>.001&&!lastActionWasLure){
   close.lerp(lastActionPosition,actionWeight);aim.lerp(lastActionAim,actionWeight);
   actionFov=lastActionFov;
   if(lostFishReel){const enter=T.MathUtils.smoothstep(reelAge,0,.12),exit=1-T.MathUtils.smoothstep(reelAge,.52,.95),weight=enter*exit*actionWeight;const raisedAim=person.position.clone().lerp(lineAnchor,.5);raisedAim.y=Math.max(raisedAim.y,1.8);aim.lerp(raisedAim,weight);actionFov=T.MathUtils.lerp(actionFov,portrait?58:48,enter*exit)}
  }else if(lastActionWasLure)cameraActionStrength=0;
  const strikeWeight=stage==='fight'?cameraImpulse((Date.now()-state.hookStrikeAt)/1000,.46):0;
  if(strikeWeight){close.addScaledVector(shotForward,strikeWeight*.26);close.y+=strikeWeight*.10;aim.lerp(bobber.position,strikeWeight*.12)}
 const desired=overview.lerp(close,cameraBlend),look=overviewTarget.clone().lerp(aim,cameraBlend).lerp(focusAim,focusBlend*.7*focusFrame);const focusNod=focusActive&&focusAge<.58?Math.sin(focusAge/.58*Math.PI)*.025:0;desired.y+=focusNod;
  let introFov=null;if(introActive){const elapsed=(performance.now()-introStart)/2400,pose=introCameraPose(elapsed,desired.toArray(),look.toArray(),aspect,portrait?44:40);introPosition.fromArray(pose.position);introAim.fromArray(pose.aim);if(pose.done)introActive=false;else{desired.copy(introPosition);look.copy(introAim);introFov=pose.fov}}
  const viewWeight=viewTransition?viewTransitionWeight(performance.now()-viewTransition.start,viewTransition.duration):null;
  if(introFov!==null){camera.position.copy(desired);cameraAim.copy(look);initializedCamera=true}else if(!initializedCamera){camera.position.copy(desired);cameraAim.copy(look);initializedCamera=true}else if(viewTransition){viewArcSide.set(viewTransition.position.z-desired.z,0,desired.x-viewTransition.position.x).normalize();viewEndOffset.copy(desired).sub(look).setY(0);if(viewArcSide.dot(viewEndOffset)<0)viewArcSide.negate();const arc=Math.min(viewTransition.targetBlend?4:1.5,Math.abs(viewTransition.position.y-desired.y)*.09)*Math.sin(Math.PI*viewWeight);camera.position.copy(viewTransition.position).lerp(desired,viewWeight).addScaledVector(viewArcSide,arc);camera.position.y+=arc*.12;cameraAim.copy(viewTransition.aim).lerp(look,viewWeight)}else{const cameraSpeed=stage==='landing'?7.5:fishFeature>.01?6.5:actionWeight>.01?4.2:active?6:focusActive?3.8:5,aimSpeed=lossHold?16:stage==='landing'?8:fishFeature>.01?7.5:actionWeight>.01?5.2:active?7:focusActive?4.2:8;camera.position.lerp(desired,1-Math.exp(-dt*cameraSpeed));cameraAim.lerp(look,1-Math.exp(-dt*aimSpeed));}
  const baseZoom=1+(zoom-1)*(1-cameraBlend*.35);
  const actionZoom=fighting||lossHold||landedWaiting?fightZoom:fishHook&&state.pending?.landedFromFight?T.MathUtils.lerp(landingShotZoom,1,landingCameraWeight(reelAge,true)):1;
  const targetZoom=T.MathUtils.lerp(baseZoom,actionZoom,cameraActionStrength);camera.zoom=viewTransition?T.MathUtils.lerp(viewTransition.zoom,targetZoom,viewWeight):T.MathUtils.damp(camera.zoom,targetZoom,6,dt);
  const baseFov=T.MathUtils.lerp(portrait?44:40,portrait?(isAiming?49:47):bite?40:42,cameraBlend)+anticipate*1.35-releaseBeat*2.25+hookBeat*.35-strikeWeight*2.2;
  const targetFov=T.MathUtils.lerp(baseFov,actionFov,cameraActionStrength);
  camera.fov=introFov??(viewTransition?T.MathUtils.lerp(viewTransition.fov,targetFov,viewWeight):T.MathUtils.damp(camera.fov,targetFov,lossHold?16:4.3,dt));
  camera.lookAt(cameraAim);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  if(viewTransition&&viewWeight>=1)viewTransition=null;
 }
 function cancelIntro(){if(!introActive)return;introActive=false;initializedCamera=true}
 const ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.15),intersection=new T.Vector3(),idleAimPoint=new T.Vector3(),idleYawAxis=new T.Vector3(0,1,0),idlePivot=new T.Vector3(0,.55,0);let drag=null,aimPointer=null,readyAimCandidate=null,pinchGap=0,idleAimActive=false,idleTorsoYaw=0,idleHeadYaw=0,idlePitch=0,actionHeadYaw=0,actionHeadPitch=0;const pointers=new Map();
 let lastWaterHit=null;
 function updateWaterInteraction(clientX,clientY,eventTime=performance.now()){
  const bounds=renderer.domElement.getBoundingClientRect();
  if(clientX<bounds.left||clientX>bounds.right||clientY<bounds.top||clientY>bounds.bottom){waterSystem.releaseInteraction();lastWaterHit=null;return false;}
  ndc.set((clientX-bounds.left)/bounds.width*2-1,-(clientY-bounds.top)/bounds.height*2+1);
  ray.setFromCamera(ndc,camera);
  if(ray.ray.intersectPlane(plane,intersection)&&intersection.z>shore(intersection.x)+.12){
   const dx=lastWaterHit?intersection.x-lastWaterHit.x:0,dz=lastWaterHit?intersection.z-lastWaterHit.z:0;
   const elapsed=lastWaterHit?Math.max(.008,Math.min(.12,(eventTime-lastWaterHit.t)*.001)):.016;
   const speed=Math.min(60,Math.hypot(dx,dz)/elapsed);
   waterSystem.setInteraction(intersection.x,intersection.z,dx,dz,speed);
   lastWaterHit={x:intersection.x,z:intersection.z,t:eventTime};
   return true;
  }
  waterSystem.releaseInteraction();lastWaterHit=null;return false;
 }
 function nearBobber(clientX,clientY,radius=58){if(!bobber.visible)return false;const r=renderer.domElement.getBoundingClientRect(),p=bobber.position.clone().project(camera),x=(p.x*.5+.5)*r.width+r.left,y=(-p.y*.5+.5)*r.height+r.top;return Math.hypot(clientX-x,clientY-y)<radius}
 function acknowledgeAim(point,force=false){
  const now=performance.now();
  if(!force&&now-selectionPulseAt<170)return;
  if(!force&&selectionPulsePoint&&Math.hypot(point[0]-selectionPulsePoint[0],point[1]-selectionPulsePoint[1])<.45)return;
  selectionPulseAt=now;selectionPulsePoint=[...point];selectionPulse.position.set(point[0],.225,point[1]);waterSystem.splash(point[0],point[1],force?.16:.09);
 }
 function waterPointAt(clientX,clientY){
  const bounds=renderer.domElement.getBoundingClientRect();
  ndc.set((clientX-bounds.left)/bounds.width*2-1,-(clientY-bounds.top)/bounds.height*2+1);
  ray.setFromCamera(ndc,camera);
  if(!ray.ray.intersectPlane(plane,intersection))return null;
  return [intersection.x,intersection.z];
 }
 function previewAimAt(clientX,clientY,announce=false){
  const water=waterPointAt(clientX,clientY);
  if(!water)return null;
  const point=castPointFromWaterTouch(getState().spot,...water);
  if(point){getState().onAimPoint?.(point);acknowledgeAim(point,announce)}
  return point;
 }
 function zoomBy(delta){
  if(!Number.isFinite(delta))return;
  const state=getState();
  if(state.pending?.fight?.status==='active'&&!state.overview)desiredFightZoom=clamp(desiredFightZoom+delta,.78,1.45);
  else desiredZoom=clamp(desiredZoom+delta,.75,1.65);
 }
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(getState().aiming){if(e.button!==0||aimPointer!==null)return;previewAimAt(e.clientX,e.clientY,true);aimPointer=e.pointerId;renderer.domElement.setPointerCapture(e.pointerId);return}
  if(e.button===0&&!e.shiftKey&&pointers.size===0){const interaction=getState(),water=waterPointAt(e.clientX,e.clientY),point=water&&readyWaterTarget(interaction,...water);if(point&&interaction.onReadyWaterTap){idleAimActive=false;readyAimCandidate={id:e.pointerId,x:e.clientX,y:e.clientY,point};pointers.set(e.pointerId,[e.clientX,e.clientY]);renderer.domElement.setPointerCapture(e.pointerId);return}}
  idleAimActive=false;
  cancelIntro();pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(readyWaterGesture(pointers.size,0)==='pinch'){readyAimCandidate=null;waterSystem.releaseInteraction();lastWaterHit=null;const [a,b]=[...pointers.values()];pinchGap=Math.hypot(a[0]-b[0],a[1]-b[1]);drag=null;renderer.domElement.setPointerCapture(e.pointerId);return}
  const waveGesture=e.button===0&&e.shiftKey&&getState().pending?.fight?.status!=='active';
  if(waveGesture){
   const wave=e.button===0&&updateWaterInteraction(e.clientX,e.clientY,e.timeStamp);
   if(wave)waterSystem.beginInteraction();
   drag={x:e.clientX,y:e.clientY,button:e.button,wave,waveGesture};
   renderer.domElement.style.cursor='crosshair';
   renderer.domElement.setPointerCapture(e.pointerId);return;
  }
  const interaction=getState(),phase=phaseOf(interaction.pending),reading=phase==='reading'&&!interaction.overview&&nearBobber(e.clientX,e.clientY,76),hookTap=phase==='hooked'&&!interaction.overview&&nearBobber(e.clientX,e.clientY,90);
  drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button,moved:false,reading,hookTap};
  renderer.domElement.setPointerCapture(e.pointerId);
 });
 renderer.domElement.addEventListener('pointermove',e=>{
  if(getState().aiming){if(aimPointer===e.pointerId)previewAimAt(e.clientX,e.clientY);return}
  if(readyAimCandidate?.id===e.pointerId){pointers.set(e.pointerId,[e.clientX,e.clientY]);if(readyWaterGesture(pointers.size,Math.hypot(e.clientX-readyAimCandidate.x,e.clientY-readyAimCandidate.y))==='select'){const point=readyAimCandidate.point;readyAimCandidate=null;pointers.delete(e.pointerId);if(getState().onReadyWaterTap?.(point)){aimPointer=e.pointerId;previewAimAt(e.clientX,e.clientY,true)}}return}
  if(e.pointerType==='mouse'&&!drag){
   const s=getState(),bounds=renderer.domElement.getBoundingClientRect();
   ndc.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
   ray.setFromCamera(ndc,camera);
   const overWater=!!ray.ray.intersectPlane(plane,intersection)&&intersection.z>shore(intersection.x)+.12;
   idleAimActive=!s.pending&&!s.aiming&&!s.overview&&overWater;
   if(idleAimActive)idleAimPoint.copy(intersection);
   renderer.domElement.style.cursor=idleAimActive||['reading','hooked'].includes(phaseOf(s.pending))&&nearBobber(e.clientX,e.clientY,76)?'pointer':'';
  }
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){waterSystem.releaseInteraction();lastWaterHit=null;const [a,b]=[...pointers.values()],gap=Math.hypot(a[0]-b[0],a[1]-b[1]);zoomBy((gap-pinchGap)*.004);pinchGap=gap;return}
  if(!drag)return;
  if(drag.waveGesture){
   if(drag.button===0){
    if(!drag.wave)waterSystem.beginInteraction();
    if(updateWaterInteraction(e.clientX,e.clientY,e.timeStamp))drag.wave=true;
   }
   drag.x=e.clientX;drag.y=e.clientY;return;
  }
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5)drag.moved=true;
  if(drag.reading||drag.hookTap){renderer.domElement.style.cursor='grabbing';drag.x=e.clientX;drag.y=e.clientY;return}
  if(drag.moved){const interaction=getState();if(interaction.pending?.fight?.status==='active'&&!interaction.overview){fightViewYaw=clamp(fightViewYaw-dx*.003,-.58,.58);fightViewPitch=clamp(fightViewPitch+dy*.0025,-.22,.28)}else if((interaction.pending||interaction.aiming||interaction.keepFishingView)&&!interaction.overview){const idleClose=!interaction.pending&&!interaction.aiming;closeYaw=clamp(closeYaw-dx*.0024,idleClose?-.35:-.65,idleClose?.35:.65);closePitch=clamp(closePitch+dy*.002,-.12,idleClose?.35:.48)}else{yaw=clamp(yaw-dx*.004,-1.2,1.2);pitch=clamp(pitch+dy*.003,.58,1.25)}}
  drag.x=e.clientX;drag.y=e.clientY;
 });
 renderer.domElement.addEventListener('pointerleave',()=>{waterSystem.releaseInteraction();lastWaterHit=null;idleAimActive=false;renderer.domElement.style.cursor=''});
 renderer.domElement.addEventListener('pointerup',e=>{
  if(aimPointer===e.pointerId){aimPointer=null;return}
  if(readyAimCandidate?.id===e.pointerId){const point=readyAimCandidate.point;readyAimCandidate=null;pointers.delete(e.pointerId);if(getState().onReadyWaterTap?.(point))acknowledgeAim(point,true);return}
  if(getState().aiming)return;
  pointers.delete(e.pointerId);
  if(drag?.waveGesture){waterSystem.releaseInteraction();lastWaterHit=null;drag=null;renderer.domElement.style.cursor='';return}
  const interaction=getState();
  if(interaction.pending?.fight?.status==='active'){drag=null;renderer.domElement.style.cursor='';return}
  if(drag?.hookTap&&drag.button===0){const distance=Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy);if(distance<20)interaction.onReel?.();drag=null;renderer.domElement.style.cursor='';return}
  if(drag?.reading&&drag.button===0){const distance=Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy);if(distance<14)interaction.onInspectBite?.();drag=null;renderer.domElement.style.cursor='';return}
  if(drag&&!drag.moved&&drag.button===0){
   const bounds=renderer.domElement.getBoundingClientRect();
   ndc.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
   ray.setFromCamera(ndc,camera);
   if(ray.ray.intersectPlane(plane,intersection)&&intersection.z>shore(intersection.x)){
    const nearest=Object.entries(WATER_SPOTS).sort((a,b)=>a[1].distanceTo(intersection)-b[1].distanceTo(intersection))[0];
    const nearSpot=nearest[1].distanceTo(intersection)<1.8;
    waterSystem.splash(intersection.x,intersection.z,.24);
    if(!interaction.pending){
     if(nearSpot)onSpot(nearest[0]);
     if(!interaction.aiming){clickedWaterPoint=intersection.clone();clickedWaterSpot=getState().spot;clickedWaterAt=performance.now()}
    }
   }
  }
  drag=null;renderer.domElement.style.cursor='';
 });
 renderer.domElement.addEventListener('pointercancel',e=>{if(aimPointer===e.pointerId){aimPointer=null;return}if(readyAimCandidate?.id===e.pointerId){readyAimCandidate=null;pointers.delete(e.pointerId);return}if(getState().aiming)return;pointers.delete(e.pointerId);waterSystem.releaseInteraction();lastWaterHit=null;drag=null;renderer.domElement.style.cursor=''});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();cancelIntro();zoomBy(-e.deltaY*.001)},{passive:false});
 const screenPos=(id)=>{const p=WATER_SPOTS[id].clone().project(camera);return{x:(p.x*.5+.5)*host.clientWidth,y:(-.5*p.y+.5)*host.clientHeight,z:p.z}},labelScreen=new Map();

 let stopped=false;function tick(ms){if(stopped)return;const t=ms*.001,dt=Math.min(.033,Math.max(.001,t-lastTime||.016));lastTime=t;time.value=previewTime??t;waterSystem.updateInteraction(dt);
  if(growthStart===null&&(!introActive||performance.now()-introStart>850))growthStart=performance.now();
  const growthTime=growthStart===null?-1:(performance.now()-growthStart)/1000;
  for(const palm of palms){const u=clamp((growthTime-palm.userData.growDelay)/palm.userData.growDuration,0,1);const eased=1-Math.pow(1-u,3);const pulse=Math.sin(Math.min(1,u)*Math.PI*1.55)*Math.pow(1-u,.42);const snap=Math.sin(Math.min(1,u)*Math.PI*3.1)*Math.pow(1-u,.8);const grow=growthEnabled&&!swimMotion.matches?Math.max(.001,eased+pulse*.42+snap*.07):1;const target=palm.userData.growScale;palm.scale.set(Math.sqrt(grow)*target,grow*target,Math.sqrt(grow)*target);const wind=swimMotion.matches?0:1,windPhase=t*.88+palm.position.x*.07+palm.position.z*.035,gust=Math.sin(windPhase+palm.userData.sway*.32)*.76+Math.sin(t*.31+palm.userData.sway)*.24;palm.rotation.x=(Math.cos(windPhase*.75+palm.userData.sway*.4)*.024+gust*.012)*wind;palm.rotation.z=(gust*.046+Math.sin(t*1.32+palm.userData.sway)*.008)*wind;for(const f of palm.userData.fronds){f.joint.rotation.z=f.baseZ+gust*.072+Math.sin(t*1.45+f.phase+palm.userData.sway)*.023*wind;f.joint.rotation.x=gust*.12+Math.sin(t*1.03+f.phase*1.7)*.032*wind}}
  for(const reef of reefObjects){const u=clamp((growthTime-(reef.userData.spawnDelay||0))/.52,0,1);const bounce=1-Math.pow(1-u,4)+Math.sin(Math.min(1,u)*Math.PI*1.55)*Math.pow(1-u,.48)*.16;const size=growthEnabled&&!swimMotion.matches?Math.max(.001,bounce):1;reef.scale.setScalar(size*(reef.userData.spawnScale||1));reef.rotation.z=Math.sin(Math.min(1,u)*Math.PI)*.035;}
  // Distant marine life swims in world space, independent of aiming and camera motion.
  sharkPatrol(t,sharkPath);
  for(const fish of marineSwimmers){
   const {model,wave,shark,silver,phase,index}=fish,speed=shark?.3:silver?.24:.17,a=t*speed+phase,rx=shark?3:silver?2.0:1.8,rz=shark?1.5:1.0;
   const orbitX=shark?sharkPath[0]:(silver?5.4:-5.4)+Math.cos(a)*rx,orbitZ=shark?sharkPath[1]:(silver?4.6:3.7)+Math.sin(a)*rz+(index%3)*.28;
   const entryDelay=(shark?.35:silver?.75:0)+index*.15,entryDuration=(shark?2.2:silver?3.6:3.2)+index*.08;
   const entry=swimMotion.matches?1:clamp((growthTime-entryDelay)/entryDuration,0,1),arrive=entry*entry*(3-2*entry);
   const fromX=shark?1:silver?17+index*.3:-18-index*.25,fromZ=shark?27.2:silver?16+index*.55:18+index*.48;
   const x=T.MathUtils.lerp(fromX,orbitX,arrive)+Math.sin(entry*Math.PI)*(silver?-.8:.7),z=T.MathUtils.lerp(fromZ,orbitZ,arrive);
   if(fish.started===undefined)fish.started=t;
   const targetDepth=silver?.31:.34;
   const y=shark?sharkSwimHeight(terrainY(x,z),t):Math.max(terrainY(x,z)+.14,.14-targetDepth);
   model.position.set(x,y,z);const dx=entry<1?(orbitX-fromX):(shark?sharkPath[2]:-Math.sin(a)*rx),dz=entry<1?(orbitZ-fromZ):(shark?sharkPath[3]:Math.cos(a)*rz);model.rotation.y=Math.atan2(-dz,dx);model.rotation.x=Math.sin(a)*.035;wave.value=t*(shark?4.8:silver?8:6)+phase;
  }


  for(const tongue of fireTongues){const flicker=fireMotionPreference.matches?0:Math.sin(t*5.1+tongue.phase)*.06+Math.sin(t*8.7+tongue.phase)*.025;tongue.mesh.scale.y=1+flicker;tongue.mesh.scale.x=1-flicker*.35;}
  if(campfireLight)campfireLight.intensity=2.8+(fireMotionPreference.matches?0:Math.sin(t*7.3)*.3+Math.sin(t*11.1)*.15);
  coastalGarden.update(t,swimMotion.matches);
  for(const ferry of ferryObjects){
   const speed=ferry.userData.ferrySpeed,phase=ferry.userData.ferryPhase;
   ferry.position.x=ferry.userData.startX+Math.sin(t*speed+phase)*ferry.userData.range;
   ferry.position.y=ferry.userData.baseY+Math.sin(t*.24+phase)*.035;
   ferry.rotation.z=Math.sin(t*.24+phase)*.006;
   if(!ferry.userData.hornAt)ferry.userData.hornAt=50+Math.random()*40;
   if(!ferry.userData.hornNext)ferry.userData.hornNext=ferry.userData.hornAt;
   if(t>ferry.userData.hornNext){ferry.userData.hornNext=t+90+Math.random()*60;const camPos=camera.position.clone();const dist=ferry.position.distanceTo(camPos);const pan=clamp((ferry.position.x-camPos.x)/30,-1,1);const vol=clamp(1-dist/40,.04,.18);window.__shipHorn?.(pan,vol)}
  }

  const state=getState(),p=state.pending,spot=castSpot(state),phase=phaseOf(p),ready=phase==='hooked'&&!p?.landedFromFight,activeFight=p?.fight?.status==='active'?p.fight:null,fightPose=activeFight?fightPerformance(activeFight,t):null;
  const shownRanges=visibleCastRanges(state,Object.keys(castRanges));
  for(const [id,range] of Object.entries(castRanges)){
   const visible=shownRanges.includes(id);
   const active=id===state.spot;
   range.fill.visible=range.edge.visible=visible;
   if(visible){range.fill.material.opacity=active?(state.aiming?.065:.038):.012;range.edge.material.opacity=active?(state.aiming?.62:.45)+Math.sin(t*1.3)*.045:.18}
  }
  const selectionAge=(ms-selectionPulseAt)/1000;selectionPulse.visible=state.aiming&&selectionAge>=0&&selectionAge<.7;if(selectionPulse.visible){selectionPulse.scale.setScalar(1+selectionAge*2.5);selectionPulse.material.opacity=.68*(1-selectionAge/.7)}
  if(p||state.aiming||clickedWaterSpot!==state.spot)clickedWaterPoint=null;
  reelPose=T.MathUtils.damp(reelPose,activeFight?.held?1:0,9,dt);
  gestureSide=T.MathUtils.damp(gestureSide,activeFight?(state.fightGesture?.side||0):0,15,dt);
  gestureLift=T.MathUtils.damp(gestureLift,activeFight?(state.fightGesture?.lift||0):0,15,dt);
  gestureLower=T.MathUtils.damp(gestureLower,activeFight?(state.fightGesture?.lower||0):0,15,dt);
  const focusRingAge=clickedWaterPoint?(ms-clickedWaterAt)/1000:9;focusRing.visible=focusRingAge>=0&&focusRingAge<1.2;if(focusRing.visible){focusRing.position.set(clickedWaterPoint.x,.21,clickedWaterPoint.z);focusRing.scale.setScalar(1+focusRingAge*3);focusRing.material.opacity=.7*(1-focusRingAge/1.2)}
  if(p?.start!==lastCast){lastCast=p?.start;landed=false;castReleased=false;fightSurfaceTracker=null;lastFightRodAngle=1.2;lossRecoilStart=null;physics.ready=false;baitMotion.reset();baitOffset.x=baitOffset.z=0;lastPhase='idle';castOrigin.copy(castTip);}
  const lossEvent=state.revealing&&p?.start===state.fightLoss?.castStart?state.fightLoss:null,lossAge=lossEvent?Math.max(0,(Date.now()-lossEvent.at)/1000):Infinity;
  if(lossEvent&&lastLossAt!==lossEvent.at){lastLossAt=lossEvent.at;lossRecoilStart={bend,angle:lastRodAngle,reason:lossEvent.reason}}
  const lossRecoil=lossRecoilStart&&lossAge<.62?lostFightRecoil(lossAge,lossRecoilStart.bend,lossRecoilStart.angle,.82,lossRecoilStart.reason):null;
  if(p?.catch&&specimenIds.has(p.catch.id)&&preparedFishKey!==p.start){const key=p.start;preparedFishKey=key;preparedFish=null;loadSpecimen(p.catch.id).then(asset=>{if(preparedFishKey===key)preparedFish=asset})}
  const standingForFish=lossRecoil?.active||shouldStandForCatch(p?.catch,{fighting:!!activeFight,landedFromFight:!!p?.landedFromFight, revealing:!!state.revealing,showingResult:!!document.querySelector('#result[open]')});
  standBlend=T.MathUtils.damp(standBlend,standingForFish?1:0,standingForFish?3.7:2.5,dt);
  const standMotion=standingForFish?sampleAnglerMotion('stand_up',standBlend*1.05):sampleAnglerMotion('sit_down',(1-standBlend)*1.15);
  const seatedForward=spot.clone().sub(new T.Vector3(-1.2,.73,.35));seatedForward.y=0;seatedForward.normalize();
  // Sit at the water-facing edge; knees and feet extend beyond the deck.
  const edgeDistance=Math.min(.76/Math.max(Math.abs(seatedForward.x),.001),.12/Math.max(Math.abs(seatedForward.z),.001));
  const idleBreath=!p&&!state.aiming?Math.sin(t*1.25)*.012:0;person.position.set(-1.2,.53+idleBreath,.35).addScaledVector(seatedForward,edgeDistance);
  person.position.y+=standMotion.rootLift;person.position.addScaledVector(seatedForward,-standMotion.action*.25);
  for(let i=0;i<2;i++){const side=i===0?-1:1,hip=new T.Vector3(side*.15,.29,.02),knee=new T.Vector3(side*.21,.12,.35).lerp(new T.Vector3(side*.18,-.16,.08),standMotion.action),ankle=new T.Vector3(side*.22,-.18,.49).lerp(new T.Vector3(side*.20,-.67,.13),standMotion.action);placeRod(thighs[i],hip,knee);thighs[i].scale.x=thighs[i].scale.z=.105;placeRod(shins[i],knee,ankle);shins[i].scale.x=shins[i].scale.z=.085;feet[i].position.set(ankle.x,ankle.y-.01,ankle.z+.09);}
  const facingPoint=spot;
  const forward=facingPoint.clone().sub(person.position);forward.y=0;forward.normalize();
  const lookEnabled=idleAimActive&&!p&&!state.aiming&&!state.overview&&!drag&&!document.querySelector('dialog[open]')&&!swimMotion.matches;
  const lookPoint=lookEnabled?idleAimPoint:!p&&!state.aiming&&clickedWaterPoint?clickedWaterPoint:null;
  const baseFacing=Math.atan2(forward.x,forward.z),lookFacing=lookPoint?Math.atan2(lookPoint.x-person.position.x,lookPoint.z-person.position.z):baseFacing;
  const desiredFacing=baseFacing+Math.atan2(Math.sin(lookFacing-baseFacing),Math.cos(lookFacing-baseFacing))*.40,facingDelta=Math.atan2(Math.sin(desiredFacing-person.rotation.y),Math.cos(desiredFacing-person.rotation.y));
  person.rotation.y+=facingDelta*(1-Math.exp(-dt*1.8));
  const bodyForward=new T.Vector3(Math.sin(person.rotation.y),0,Math.cos(person.rotation.y));
  const look=idleLookTarget(person.position,bodyForward,lookPoint,facingPoint),lookRate=lookPoint?1.8:2.3;
  idleTorsoYaw=T.MathUtils.damp(idleTorsoYaw,look.torsoYaw,lookRate,dt);
  idleHeadYaw=T.MathUtils.damp(idleHeadYaw,look.headYaw,lookRate*1.15,dt);
  idlePitch=T.MathUtils.damp(idlePitch,look.pitch,lookRate,dt);
  const age=p?(Date.now()-p.start)/1000:0,castU=clamp(age/1.85,0,1),isCast=!!p&&age<1.85,reelAge=state.revealing?(Date.now()-state.revealStart)/1000:0,reelRaw=state.revealing?clamp(reelAge/(p?.catch?3.2:2.2),0,1):0,hookU=state.revealing?clamp(reelAge/.20,0,1):0,hookEase=1-Math.pow(1-hookU,4),hookKick=state.revealing&&reelAge<.30?Math.sin(reelAge/.30*Math.PI):0,reelBeat=state.revealing&&reelAge>.24&&!p?.landedFromFight&&!isObjectCatch(p?.catch)?Math.sin((reelAge-.24)*TAU*1.25)*(1-reelRaw)*.11:0,fight=ready&&!isObjectCatch(p?.catch)&&!state.revealing&&!activeFight?1:0,fightWave=Math.sin(t*4.7)+Math.sin(t*8.3+1.7)*.48+Math.sin(t*13.1)*.2,surge=Math.pow(Math.max(0,Math.sin(t*1.17+.8)),8),tug=fight*(fightWave*.035+surge*.082),releaseAge=state.lastRelease?(Date.now()-state.lastRelease.at)/1000:9,releaseGesture=releaseAge<1.7?Math.sin(clamp(releaseAge/1.7,0,1)*Math.PI):0,biteJolt=ready&&!isObjectCatch(p?.catch)&&!state.revealing?biteStrike((Date.now()-p.readyAt)/1000):0;
  const castDistance=Math.hypot(spot.x-person.position.x,spot.z-person.position.z);
  const castResponse=isCast?castFeedback(age-CAST_RELEASE_TIME,castDistance):null,whip=castResponse?.recoil||0;
  const castMotion=isCast?sampleCastMotion(age,castDistance):null;
  const reelMotion=state.revealing?sampleAnglerMotion('reel',reelAnimationTime(reelAge,!!p?.landedFromFight)):null;
  const landing=reelMotion&&p?.catch&&!isObjectCatch(p.catch)&&!p.landedFromFight?landingDynamics(reelAge,p.catch.weight):null;
  const actionTorsoYaw=castMotion?.torsoYaw??reelMotion?.torsoYaw??0,torsoAimYaw=idleTorsoYaw+actionTorsoYaw+gestureSide*.32;
  const catchLook=state.revealing&&reelAge>.10?catchEndpoint:activeFight?bobber.position:null;
  const headPose=idleLookTarget(person.position,bodyForward,catchLook,spot);
  actionHeadYaw=T.MathUtils.damp(actionHeadYaw,catchLook?clamp(headPose.torsoYaw+headPose.headYaw-actionTorsoYaw,-.38,.38):-actionTorsoYaw*.28,5,dt);
  actionHeadPitch=T.MathUtils.damp(actionHeadPitch,catchLook?headPose.pitch:0,5,dt);
  fishingArt.setIdleLook(torsoAimYaw,idleHeadYaw+actionHeadYaw,idlePitch+actionHeadPitch);
  const action=castMotion?.action??0;
  person.position.y+=castMotion?.rootLift??reelMotion?.rootLift??0;
  person.rotation.x=T.MathUtils.damp(person.rotation.x,castMotion?.lean??reelMotion?.lean??standMotion.lean,12,dt);
  const shoulders=[new T.Vector3(-.23,.70,.02),new T.Vector3(.23,.70,.02)],elbows=[new T.Vector3(-.31,.53,.20+action*.12),new T.Vector3(.31,.52,.23+action*.11)],handLocal=[new T.Vector3(-.13,.44,.42+action*.23),new T.Vector3(.13,.43,.45+action*.24)];
  if(castMotion){for(const hand of handLocal){hand.x+=castMotion.gripSide;hand.y+=castMotion.handLift+castMotion.gripSide*.35;hand.z+=castMotion.handBack+castMotion.gripSide*.45}handLocal[1].y+=castMotion.offHandLift;handLocal[1].z+=castMotion.offHandBack;}
  if(standBlend>.001){for(const hand of handLocal){hand.y+=standMotion.handLift;hand.z+=standMotion.handBack}for(const elbow of elbows){elbow.y+=standMotion.handLift*.65;elbow.z+=standMotion.handBack*.55}}
  handLocal[0].y+=fight*.18+tug+idleBreath*.8+releaseGesture*.13;handLocal[0].z-=fight*.13-releaseGesture*.18;handLocal[1].y+=fight*.075-tug*.35+idleBreath*.5+releaseGesture*.10;handLocal[1].z+=fight*.035+releaseGesture*.15;elbows[0].y+=fight*.105+releaseGesture*.06;elbows[0].z-=fight*.08-releaseGesture*.10;elbows[1].x+=fight*.045;elbows[1].z+=fight*.035+releaseGesture*.08;
  handLocal[0].y+=whip*.09+biteJolt*.14+(castResponse?.followThrough||0)*.10;handLocal[0].z-=whip*.11+biteJolt*.10+(castResponse?.followThrough||0)*.13;handLocal[1].y+=whip*.04+biteJolt*.06;elbows[0].y+=biteJolt*.07;person.rotation.x+=whip*.025-biteJolt*.045-(castResponse?.followThrough||0)*.045;
  if(fightPose){
   const {resistance,brace,surge,lift,payout,give,recoil,shock}=fightPose,pull=reelPose*fightPose.reel,beat=fightPose.crank*pull,back=-beat;
   handLocal[0].y+=pull*.32+brace*.21+beat*.18+lift*.46;
   handLocal[1].y+=pull*.25+brace*.14+back*.15+lift*.32;
   handLocal[0].z-=pull*.26+brace*.17+beat*.13+lift*.15;
   handLocal[1].z-=pull*.17+brace*.10+back*.11+lift*.09;
   elbows[0].y+=pull*.21+brace*.14+beat*.11+lift*.31;
   elbows[1].y+=pull*.14+brace*.10+back*.09+lift*.20;
   elbows[0].z-=pull*.18+brace*.08+beat*.08;
   elbows[1].z-=pull*.12+back*.07;
   handLocal[0].y-=give*.10+shock*.10;handLocal[0].z+=give*.24+shock*.13;
   handLocal[1].y-=give*.05;handLocal[1].z+=give*.14;
   elbows[0].z+=give*.13;elbows[1].z+=give*.07;
   handLocal[0].y+=gestureLift*.20-gestureLower*.16;handLocal[1].y+=gestureLift*.11-gestureLower*.10;
   handLocal[0].z-=gestureLift*.13-gestureLower*.15;handLocal[1].z-=gestureLift*.08-gestureLower*.10;
   elbows[0].y+=gestureLift*.12-gestureLower*.09;elbows[1].y+=gestureLift*.07-gestureLower*.06;
   person.position.y+=beat*.055-brace*.075+lift*.05-shock*.035;
   person.rotation.x=T.MathUtils.damp(person.rotation.x,-brace*.30-surge*.06-shock*.08+lift*.17+payout*.03+give*.08+standMotion.lean+gestureLift*.12-gestureLower*.09,11,dt);
   person.rotation.z=beat*.08-lift*.08+recoil*.035-gestureSide*.09;
  }else person.rotation.z=T.MathUtils.damp(person.rotation.z,0,8,dt);
  if(reelMotion){const weight=isObjectCatch(p?.catch)?.48:p?.catch?1:.34,crankEnvelope=p?.landedFromFight?0:clamp((reelAge-.18)/.20,0,1)*(1-clamp((reelAge-2.55)/.55,0,1)),crankPhase=(reelAge-.18)*TAU*1.25;for(const hand of handLocal){hand.y+=(reelMotion.handLift+reelBeat*.7)*weight;hand.z+=reelMotion.handBack*weight}handLocal[1].x+=Math.cos(crankPhase)*.075*crankEnvelope;handLocal[1].y+=(reelMotion.offHandLift+Math.sin(crankPhase)*.055*crankEnvelope)*weight;handLocal[1].z+=(reelMotion.offHandBack+Math.cos(crankPhase)*.042*crankEnvelope)*weight;elbows[0].y+=reelMotion.handLift*.7*weight;elbows[1].y+=(reelMotion.handLift*.58+reelMotion.offHandLift*.45+Math.sin(crankPhase)*.03*crankEnvelope)*weight;elbows[0].z+=reelMotion.handBack*.7*weight;elbows[1].z+=(reelMotion.handBack*.58+reelMotion.offHandBack*.45)*weight;}
  if(landing){const force=p.landedFromFight?1:.72,strain=landing.strain*force,recoil=landing.recoil*force;handLocal[0].y+=strain*.22-recoil*.09;handLocal[1].y+=strain*.16-recoil*.06;handLocal[0].z-=strain*.25+recoil*.08;handLocal[1].z-=strain*.17+recoil*.05;elbows[0].y+=strain*.13;elbows[1].y+=strain*.09;person.position.y+=strain*.045-recoil*.025;person.rotation.x=T.MathUtils.damp(person.rotation.x,reelMotion.lean-strain*.26+recoil*.10,12,dt);person.rotation.z=-strain*.045+recoil*.035;}
  if(lossRecoil){const kick=lossRecoil.kick;handLocal[0].y+=kick*.23;handLocal[0].z-=kick*.16;handLocal[1].y+=kick*.12;elbows[0].y+=kick*.12;person.rotation.x-=kick*.075}
  let angle=castMotion?.rodAngle??(.68+idleBreath*1.4);if(!p&&!state.aiming)angle+=idlePitch*.50;if(state.aiming&&!p)angle=.75+Math.sin(t*1.8)*.018;if(ready&&!state.revealing)angle=1.00+tug*1.35;if(fightPose)angle=T.MathUtils.lerp(.73,1.17,reelPose*fightPose.reel)+fightPose.resistance*.29+fightPose.crank*reelPose*fightPose.reel*.10+fightPose.recoil*.09+fightPose.lift*.45-fightPose.payout*.10+standMotion.action*.13+gestureLift*.34-gestureLower*.27;if(reelMotion)angle=p?.catch&&!isObjectCatch(p.catch)?reelMotion.rodAngle+reelBeat*.72:T.MathUtils.lerp(.73,.98,reelRaw)+reelBeat*.16;if(reelMotion&&p?.landedFromFight&&p.catch)angle=T.MathUtils.lerp(lastFightRodAngle,Math.max(angle,1.64),landingHoldBlend(reelAge));if(landing)angle+=landing.strain*.25-landing.recoil*.13;if(releaseGesture)angle+=releaseGesture*.16;angle+=whip*.20+biteJolt*.13;if(lossRecoil)angle=lossRecoil.angle;
  if(phase==='responding'&&p?.reactedAt){const actionAge=(Date.now()-p.reactedAt)/1000,actionPulse=Math.sin(Math.PI*clamp(actionAge/.62,0,1));if(p.tactic==='tease')angle+=actionPulse*.30;else if(p.tactic==='shorten')angle+=actionPulse*.10}
  const elbowPoles=elbows.map(elbow=>elbow.clone());
  for(const shoulder of shoulders)shoulder.sub(idlePivot).applyAxisAngle(idleYawAxis,torsoAimYaw).add(idlePivot);
  for(const pole of elbowPoles)pole.sub(idlePivot).applyAxisAngle(idleYawAxis,torsoAimYaw).add(idlePivot);
  for(const hand of handLocal){hand.sub(idlePivot).applyAxisAngle(idleYawAxis,torsoAimYaw).add(idlePivot);hand.y+=idlePitch*.14}
  const armUpper=.34,armLower=.38,rodAxisLocal=new T.Vector3(0,Math.sin(angle),Math.cos(angle)).applyAxisAngle(idleYawAxis,torsoAimYaw);
  const primary=solveTwoBoneIK(shoulders[0],handLocal[0],elbowPoles[0],armUpper,armLower);
  elbows[0].set(primary.elbow.x,primary.elbow.y,primary.elbow.z);handLocal[0].set(primary.hand.x,primary.hand.y,primary.hand.z);
  const support=supportGripTarget(handLocal[0],shoulders[1],rodAxisLocal,armUpper+armLower-.005);
  const offHandBlend=clamp((fightPose?.reel||0)*reelPose*.92+(state.revealing&&!p?.landedFromFight?clamp((reelAge-.18)/.20,0,1)*(1-clamp((reelAge-2.55)/.55,0,1))*.85:0),0,1);
  handLocal[1].lerp(new T.Vector3(support.x,support.y,support.z),1-offHandBlend);
  const secondary=solveTwoBoneIK(shoulders[1],handLocal[1],elbowPoles[1],armUpper,armLower);
  elbows[1].set(secondary.elbow.x,secondary.elbow.y,secondary.elbow.z);handLocal[1].set(secondary.hand.x,secondary.hand.y,secondary.hand.z);
  for(let i=0;i<2;i++){placeRod(upperArms[i],shoulders[i],elbows[i]);upperArms[i].scale.x=upperArms[i].scale.z=.092;placeRod(foreArms[i],elbows[i],handLocal[i]);foreArms[i].scale.x=foreArms[i].scale.z=.062;hands[i].position.copy(handLocal[i]);hands[i].quaternion.setFromUnitVectors(new T.Vector3(0,1,0),rodAxisLocal)}
  person.updateMatrixWorld(true);const start=handLocal[0].clone().applyMatrix4(person.matrixWorld);
  const tension=lossEvent ? .025 : (fightPose?.10+(activeFight.tension*1.9+activeFight.load*.42+activeFight.surge*.20)*fightPose.taut+fightPose.lift*.48+fightPose.shock*.30:state.revealing?(p?.catch?.72:.18)+hookKick*(p?.catch?1.15:.22)+hookEase*(p?.catch?.18:.03)+Math.max(0,reelBeat)*(p?.catch?.85:.18)+(landing?landing.strain*.85+Math.abs(landing.recoil)*.35:0):ready?.65+Math.max(0,tug)*2.2:.055)+biteJolt*.50+Math.abs(whip)*.26+(activeFight?0:bobber.visible?physics.tension*.40:0);
  if(lossRecoil){bend=lossRecoil.bend;bendVelocity=0}else{bendVelocity+=(tension-bend)*30*dt;bendVelocity*=Math.exp(-6.8*dt);bend+=bendVelocity*dt}
  if(activeFight)lastFightRodAngle=angle;
  const angularSpeed=clamp((angle-lastRodAngle)/dt,-24,24);lastRodAngle=angle;
  const lagTarget=clamp(-angularSpeed*.09,-.9,.9);rodLagVelocity+=(lagTarget-rodLag)*55*dt;rodLagVelocity*=Math.exp(-8*dt);rodLag+=rodLagVelocity*dt;
  const rodForward=new T.Vector3(0,0,1).applyAxisAngle(idleYawAxis,torsoAimYaw).transformDirection(person.matrixWorld);
  const rodDirection=rodAxisLocal.clone().transformDirection(person.matrixWorld);
  const tip=start.clone().addScaledVector(rodDirection,3.55);castTip.copy(tip);
  const pull=state.revealing&&p?.catch?(lastReel?catchEndpoint:spot).clone().sub(tip).normalize():bobber.visible?bobber.position.clone().sub(tip).normalize():new T.Vector3(0,-1,0);
  for(let i=0;i<rodPoints.length;i++){const u=i/(rodPoints.length-1),flex=u*u;rodPoints[i].copy(start).lerp(tip,u).addScaledVector(pull,bend*(activeFight?1.45:state.revealing?1.3:1.0)*flex*flex).addScaledVector(rodForward,-Math.sin(angle)*rodLag*flex);rodPoints[i].y+=Math.cos(angle)*rodLag*flex+Math.sin(u*Math.PI)*.045}updateTube(rodGeo,rodPoints,.035,.14);lineAnchor.copy(rodPoints[rodPoints.length-1]);tip.copy(lineAnchor);
  fishingArt.update(p?.bait||state.bait||'grain',!p?.liftedAt&&!activeFight,!!activeFight||!!p?.landedFromFight);
  idleLure.visible=!p;idleLine.visible=!p;if(!p){const sway=state.aiming?.035:.065;idleLure.position.copy(tip).add(new T.Vector3(Math.sin(t*1.7)*sway,-.34+Math.sin(t*1.35)*.025,Math.cos(t*1.4)*sway));idleLure.rotation.z=Math.sin(t*1.7)*.16;const idlePos=idleLineGeo.attributes.position;idlePos.setXYZ(0,tip.x,tip.y,tip.z);idlePos.setXYZ(1,idleLure.position.x,idleLure.position.y,idleLure.position.z);idlePos.needsUpdate=true;idleLineGeo.computeBoundingSphere()}
  bobber.visible=!!p&&p.phase==='cast'&&(!state.revealing||!p.catch);fishingLine.visible=!!p&&(p.phase==='cast'||state.revealing);lineBorder.visible=fishingLine.visible;caughtHook.visible=!!p?.catch&&(!!activeFight||!!state.revealing||!!p.landedFromFight);marker.visible=!p;marker.position.copy(spot);marker.position.y=.215;markerCore.visible=state.aiming&&!p;markerCore.position.set(spot.x,.22,spot.z);const focusAge=state.focusPulseAt?Math.max(0,(Date.now()-state.focusPulseAt)/1000):9,focusFlash=state.focusSpot===state.spot&&focusAge<.9?Math.max(0,1-focusAge/.9):0;marker.scale.setScalar((state.aiming?1.35:1)+Math.sin(t*3)*.08+focusFlash*(.34+.18*Math.sin(t*12)));marker.material.opacity=state.aiming?.98:.62+focusFlash*.30;marker.material.color.set(state.aiming&&state.aimPoint?'#fff1b4':focusFlash>.05?'#f5d58d':'#ffffdf');
  if(fishingLine.visible){const released=age>=CAST_RELEASE_TIME;
   if(released&&!castReleased){castReleased=true;if(age<2.5)state.onCastRelease?.()}
   if(!released){bobber.position.copy(tip).add(new T.Vector3(0,-.30,0));castOrigin.copy(bobber.position);bobber.rotation.z=-.22*Math.sin(clamp(age/CAST_RELEASE_TIME,0,1)*Math.PI)}
   const trajectory=released?castFlight(age,castOrigin,new T.Vector3(spot.x,.205,spot.z)):null,flight=trajectory?.u??0;
   if(trajectory&&!trajectory.landed)state.onCastFlight?.(Math.hypot(trajectory.velocity.x,trajectory.velocity.y,trajectory.velocity.z),flight);
   if(trajectory&&!trajectory.landed){bobber.position.set(trajectory.position.x,trajectory.position.y,trajectory.position.z);bobber.rotation.z=clamp(-Math.atan2(trajectory.velocity.y,Math.hypot(trajectory.velocity.x,trajectory.velocity.z))*.55,-.48,.48)}
   else if(trajectory){bobber.position.set(spot.x,.205+.018*Math.sin(t*2.1),spot.z);bobber.rotation.z=Math.sin(t*1.6)*.05}
  if(trajectory?.landed&&!landed){landed=true;if(age<2.5)splash(spot,.58+(castResponse?.effort??1)*.48);state.onCastLand?.(age<2.5)}
   if(phase==='approach'&&lastPhase!=='approach')state.onApproach?.();
   if(phase==='reading'&&lastPhase!=='reading')state.onReading?.(p.signal?.id);
   if(phase==='nibble'&&lastPhase!=='nibble')state.onNibble?.();
   if(phase==='reading'){const motion=readingBobberMotion(p.signal?.id,(Date.now()-p.decisionAt)/1000);bobber.position.x+=motion.x;bobber.position.y+=motion.y;bobber.position.z+=motion.z;bobber.rotation.z+=motion.tilt}
   if(phase==='responding'){const actionAge=(Date.now()-p.reactedAt)/1000,actionPulse=Math.sin(Math.PI*clamp(actionAge/.7,0,1));if(p.tactic==='tease')bobber.position.y+=actionPulse*.14;else if(p.tactic==='shorten')bobber.position.addScaledVector(forward,-actionPulse*.22);}
    if(phase==='nibble'){const now=Date.now(),motion=nibbleBobberMotion(p.readyAt-now,now,p.readyAt,t);bobber.position.y+=motion.y;bobber.rotation.z+=motion.tilt}
    if(ready){const objectCatch=isObjectCatch(p.catch),motion=hookedBobberMotion(objectCatch,(Date.now()-p.readyAt)/1000,t,fightWave,surge);bobber.position.x+=motion.x;bobber.position.y+=motion.y;bobber.position.z+=motion.z;bobber.rotation.z=motion.tilt;if(lastPhase!=='hooked'){splash(spot,objectCatch?.28:1.2);state.onBite?.(objectCatch)}else if(!objectCatch&&frame%52===0)waterSystem.splash(bobber.position.x,bobber.position.z,.18+surge*.22)}
   if(activeFight){const radius=clamp(activeFight.distance/activeFight.startDistance,.16,1.3),warning=activeFight.surgeWarning||0;bobber.position.copy(person.position).lerp(spot,radius);bobber.position.x+=(activeFight.fishPosition-.5)*.7;bobber.position.z+=Math.sin(t*4.2+activeFight.seed)*(.04+activeFight.surge*.06+fightPose.struggle*.035);bobber.position.y=.11-activeFight.tension*.10-activeFight.surge*.08-fightPose.shock*.09-warning*.035+fightPose.lift*.16;bobber.rotation.z=(activeFight.held?.4:.18)+activeFight.surge*.28+fightPose.struggle*.16+warning*.10+fightPose.lift*.18;const surface=fightSurfacePulse(activeFight,fightSurfaceTracker);fightSurfaceTracker=surface.tracker;if(surface.kind==='pump')splash(bobber.position,surface.amount);else if(surface.amount>0)waterSystem.splash(bobber.position.x,bobber.position.z,surface.amount)}else fightSurfaceTracker=null;
   fishMotion=activeFight?fightFishMotion(activeFight,person.position,spot,t,fightPose.thrash):null;
   if(fishMotion&&p?.catch&&!isObjectCatch(p.catch)){
    let firstFightFrame=false;
    if(fightKey!==p.start){
     const continuing=approachKey===p.start&&!!approachFish;
     const fallback=continuing?approachFish:preparedFishKey===p.start&&preparedFish?preparedFish:makeSpecimen(p.catch.id,p.catch.variation);
     if(fightFish&&fightFish!==fallback)scene.remove(fightFish);
     fallback.scale.setScalar(clamp(.42+Math.sqrt(p.catch.weight)*.085,.42,.72));
     fightEntryOrigin.copy(fallback.position);fightEntryAge=continuing?0:1;
     fightFish=fallback;fightKey=p.start;firstFightFrame=true;if(!fallback.parent)scene.add(fallback);
    }
    const fishPosition=fightEntryAge<.4?fightEntryPosition(fightEntryOrigin,fishMotion.position,fightEntryAge):fishMotion.position;
    fightFish.position.set(fishPosition.x,fishPosition.y,fishPosition.z);fightEntryAge=Math.min(1,fightEntryAge+dt);
    const heading=new T.Vector3(fishMotion.heading.x,0,fishMotion.heading.z);
    if(firstFightFrame&&fightEntryAge>=1)faceVelocity(fightFish,heading);else turnFishToward(fightFish,heading,dt);
    fightFish.rotation.x=T.MathUtils.damp(fightFish.rotation.x,fishMotion.roll,11,dt);
    fightFish.rotation.z=T.MathUtils.damp(fightFish.rotation.z,fishMotion.pitch,11,dt);
    setFishImmersion(fightFish,clamp((-fishMotion.position.y-.04)/.65,0,1));
    if(fightFish.userData.tail)fightFish.userData.tail.rotation.y=fishMotion.tail;
    alignFloatOverMouth(bobber,fightFish);
   }else if(fishMotion){bobber.position.x=fishMotion.position.x;bobber.position.z=fishMotion.position.z}
   if(phase==='empty'){bobber.rotation.z=.26+Math.sin(t*1.2)*.04;bobber.position.y=.205+Math.sin(t*1.25)*.01;}
   if(state.revealing){
    if(!lastReel){const fromFight=!!p.landedFromFight&&!!fightFish;if(fromFight)catchEndpoint.copy(fishMouthWorld(fightFish));else{catchEndpoint.copy(spot);catchEndpoint.y=.12}revealOrigin.copy(catchEndpoint);revealHold.copy(person.position).addScaledVector(forward,.65);revealHold.y=Math.max(revealOrigin.y+1.15,2.1);revealPullDirection.subVectors(revealHold,revealOrigin).normalize();catchVelocity.copy(forward).multiplyScalar(fromFight?-1.1:isObjectCatch(p.catch)?-1.6:p.catch?-6.2:-1.4);catchVelocity.y=fromFight?.65:isObjectCatch(p.catch)?.65:p.catch?2.35:.45;if(p.catch){splash(catchEndpoint,isObjectCatch(p.catch)?.36:fromFight?.65:1.55);if(!isObjectCatch(p.catch))state.onFishLift?.()}}
    const u=clamp(reelRaw/.80,0,1),ease=u*u*(3-2*u),goal=tip.clone().add(new T.Vector3(0,-1.15,0));
    goal.lerpVectors(revealOrigin,goal,ease);goal.y=T.MathUtils.lerp(revealOrigin.y,tip.y-1.15,ease);goal.addScaledVector(forward,-hookEase*(1-clamp((reelAge-.20)/.58,0,1))*(isObjectCatch(p.catch)?.12:p.catch?.82:.12));goal.y+=hookKick*(isObjectCatch(p.catch)?.04:p.catch?.22:.03);
    if(p.catch&&p.landedFromFight){const previous=catchEndpoint.clone(),pose=landingPose(revealOrigin,revealHold,reelAge,p.catch.weight);catchEndpoint.set(pose.x,pose.y,pose.z);catchVelocity.copy(catchEndpoint).sub(previous).divideScalar(Math.max(dt,.001));if(reelAge<.38&&frame%20===0)splash(catchEndpoint,.18)}else{const resistance=(p.catch&&!isObjectCatch(p.catch)?1:0)*(1-reelRaw),fightSide=new T.Vector3(forward.z,0,-forward.x);if(landing){goal.addScaledVector(forward,-landing.strain*.20+landing.recoil*.12);goal.y+=landing.strain*.13-landing.recoil*.08}const force=goal.sub(catchEndpoint).multiplyScalar(reelAge<.24?90:58).addScaledVector(catchVelocity,reelAge<.24?-11:-8);force.addScaledVector(forward,Math.sin(t*13)*resistance*2.5);force.addScaledVector(fightSide,(Math.sin(t*8.7)+Math.sin(t*13.4+1.1)*.42)*resistance*8.5);force.y-=(.55+.45*Math.sin(t*6.2))*resistance*4.8;catchVelocity.addScaledVector(force,dt);catchEndpoint.addScaledVector(catchVelocity,dt);if(p.catch&&frame%40===0&&catchEndpoint.y<.48&&reelRaw<.78)splash(catchEndpoint,isObjectCatch(p.catch)?.08:.16+Math.abs(Math.sin(t*8.7))*.18)}
    bobber.position.copy(catchEndpoint);caughtHook.position.copy(catchEndpoint);caughtHook.rotation.z=Math.atan2(catchVelocity.x,8)*.6;
   }
   if(p.landedFromFight&&!state.revealing&&fightFish){bobber.position.copy(fishMouthWorld(fightFish));caughtHook.position.copy(bobber.position);bobber.visible=false}
   if(!released)physics.reset(lineAnchor,bobber.position);
   const castSnap=released&&flight<.16,emptyLine=phase==='empty'||state.revealing&&!p.catch,retrievingEmpty=state.revealing&&!p.catch,flightLine=released&&flight<1?castLineProfile(flight,castDistance):null,castSlack=(retrievingEmpty?1.012:emptyLine?1.08:flightLine?.slack??1.012)+(lossRecoil?.slack||0)*.18,castExtra=retrievingEmpty?.07:emptyLine?.42:flightLine?.extra??(phase==='waiting'?.32:.05);const visualLength=activeFight?lineAnchor.distanceTo(bobber.position)*activeFight.lineLength/Math.max(.1,activeFight.distance):undefined;const points=physics.update(lineAnchor,bobber.position,dt,{tight:activeFight?activeFight.held:(lossRecoil?.slack>0?false:ready||state.revealing||castSnap),slack:castSlack,extra:castExtra,reel:state.revealing||activeFight?.held,length:visualLength,load:activeFight?.tension,impulse:fightPose?.shock});points[0].copy(lineAnchor);updateTube(lineGeo,points,.0055+(fightPose?.resistance||0)*.0018);updateTube(lineBorderGeo,points,.009+(fightPose?.resistance||0)*.002);fishingLine.material.opacity=activeFight?.63+fightPose.taut*.29:emptyLine?.50:.84;lineBorder.material.opacity=activeFight?.16+fightPose.resistance*.20:.22;const lineRisk=activeFight?fightOutlook(activeFight).lineRisk:0;fishingLine.material.color.copy(lineCalmColor).lerp(lineAlarmColor,lineRisk);lineBorder.material.color.copy(lineBorderCalm).lerp(lineBorderAlarm,lineRisk);
  }
  if(bobber.visible){const offset=baitMotion.update(bobber.position,dt,fightPose?.resistance||0);baitOffset.x=offset.x;baitOffset.z=offset.z;fishingArt.setBaitMotion(offset.x,offset.z);const leader=hookLine.geometry.attributes.position;leader.setXYZ(0,0,-.20,0);leader.setXYZ(1,offset.x*.32,-.39,offset.z*.32);leader.setXYZ(2,.055+offset.x*.72,-.48,.01+offset.z*.72);leader.setXYZ(3,.12+offset.x,-.45,.01+offset.z);leader.needsUpdate=true;hookLine.geometry.computeBoundingSphere()}
  const cue=fishingCue(phase),cueVisible=bobber.visible&&!state.revealing&&!activeFight&&age>1.85&&cue.intensity>0;cueRing.visible=cueCore.visible=cueVisible;if(cueVisible){const pulse=.5+.5*Math.sin(t*TAU/cue.period),size=1+cue.scale*pulse;cueRing.position.set(bobber.position.x,.24,bobber.position.z);cueCore.position.copy(cueRing.position);cueRing.scale.setScalar(size);cueCore.scale.setScalar(.9+pulse*.18);cueRing.material.color.set(cue.color);cueCore.material.color.set(cue.color);cueRing.material.opacity=cue.intensity*(.3+.7*pulse);cueCore.material.opacity=cue.intensity*(.45+.4*pulse);bobber.scale.setScalar(.96+cue.intensity*pulse*.09)}else bobber.scale.setScalar(.96);
  lastReel=state.revealing;lastPhase=phase;
  const fishApproaches=p?.catch&&!p.landedFromFight&&!isObjectCatch(p.catch)&&['approach','reading','responding','nibble','hooked'].includes(phase)&&!state.revealing&&!activeFight;
  if(fishApproaches){const hooked=phase==='hooked';let firstApproach=false;if(approachKey!==p.start){if(approachFish){scene.remove(approachFish);if(fightFish===approachFish)fightFish=null}approachFish=preparedFishKey===p.start&&preparedFish?preparedFish:makeSpecimen(p.catch.id,p.catch.variation);approachFish.scale.setScalar(clamp(.42+Math.sqrt(p.catch.weight)*.085,.42,.72));scene.add(approachFish);approachKey=p.start;approachHookRestY=hookWorld().y;firstApproach=true}
   const reading=phase==='reading',signal=p.signal?.id;
   const readingAge=Math.max(0,(Date.now()-(p.decisionAt??p.readyAt-2200))/1000),biteAge=(Date.now()-p.readyAt)/1000,hook=hookWorld();
   const mouthGoal=fishMouthApproach(hook,biteAge,t,signal,phase,readingAge,approachHookRestY);
   approachFish.visible=true;
   const pose=biteFishPose(forward,biteAge,t,(p.catch.weight*13.7)%6.28,hooked),heading=new T.Vector3(pose.heading.x,0,pose.heading.z);
   if(firstApproach)faceVelocity(approachFish,heading);else turnFishToward(approachFish,heading,dt);
   approachFish.rotation.x=firstApproach?pose.roll:T.MathUtils.damp(approachFish.rotation.x,pose.roll,12,dt);
   approachFish.rotation.z=firstApproach?pose.pitch:T.MathUtils.damp(approachFish.rotation.z,pose.pitch,12,dt);
   alignFishMouth(approachFish,new T.Vector3(mouthGoal.x,mouthGoal.y,mouthGoal.z));
   setFishImmersion(approachFish,clamp((-approachFish.position.y-.04)/.65,0,1));
   if(approachFish.userData.tail)approachFish.userData.tail.rotation.y=pose.tail;
   if((reading&&frame%(signal==='dart'?28:65)===0)||(phase==='nibble'&&frame%60===0)||(hooked&&frame%95===0))waterSystem.splash(approachFish.position.x,approachFish.position.z,hooked?.13:signal==='broad'?.16:.08);
  }else if(approachFish)approachFish.visible=false;
  if(p?.landedFromFight&&!state.revealing&&!fightFish&&p.catch&&!isObjectCatch(p.catch)){
   fightFish=makeSpecimen(p.catch.id,p.catch.variation);fightFish.scale.setScalar(clamp(.42+Math.sqrt(p.catch.weight)*.085,.42,.72));fightFish.position.copy(person.position).addScaledVector(forward,1.65);fightFish.position.y=-.16;faceVelocity(fightFish,forward.clone().negate());fightKey=p.start;scene.add(fightFish);
  }
  if(activeFight&&p?.catch&&!isObjectCatch(p.catch)){
   const motion=fishMotion||fightFishMotion(activeFight,person.position,spot,t,fightPose?.thrash);
   fightFish.visible=true;
   const mouth=attachHookToMouth(fightFish,caughtHook);
   bobber.updateMatrixWorld(true);
   const leaderStart=bobber.localToWorld(new T.Vector3(0,-.20,0));
   leaderPositions.set([leaderStart.x,leaderStart.y,leaderStart.z,mouth.x,mouth.y,mouth.z]);
   leaderGeo.attributes.position.needsUpdate=true;leaderGeo.computeBoundingSphere();leaderLine.visible=true;
   if(lastFightDepth!==null&&lastFightDepth<-.10&&motion.position.y>=-.10){splash(fightFish.position,.46+motion.struggle*.25);if(ms-lastBreachSoundAt>1400){state.onFishBreach?.();lastBreachSoundAt=ms}}
   lastFightDepth=motion.position.y;
   if(frame%13===0&&motion.position.y>-.20&&motion.struggle>.4)waterSystem.splash(fightFish.position.x,fightFish.position.z,.14+motion.struggle*.18);
  }else if(p?.landedFromFight&&!state.revealing&&fightFish){fightFish.visible=true;leaderLine.visible=false;lastFightDepth=null}
  else{if(fightFish)fightFish.visible=false;leaderLine.visible=false;lastFightDepth=null}
  if(state.revealing&&p?.catch){
   if(revealKey!==p.start){
    if(revealFish&&revealFish!==fightFish)scene.remove(revealFish);
    const shared=fightKey===p.start&&fightFish;
    revealFish=shared||makeSpecimen(p.catch.id,p.catch.variation);
    if(!shared){revealFish.scale.setScalar(.5);scene.add(revealFish)}
    revealKey=p.start;
    if(!shared&&specimenIds.has(p.catch.id)){
     if(!revealAssets.has(p.catch.id))revealAssets.set(p.catch.id,loadSpecimen(p.catch.id));
     const fallback=revealFish,key=p.start;
     revealAssets.get(p.catch.id).then(asset=>{if(!asset||revealKey!==key||revealFish!==fallback)return;asset.position.copy(fallback.position);asset.quaternion.copy(fallback.quaternion);asset.scale.copy(fallback.scale);scene.remove(fallback);revealFish=asset;scene.add(asset)});
    }
   }
   revealFish.visible=true;
   const objectCatch=isObjectCatch(p.catch),resistance=(objectCatch?0:1)*(1-reelRaw),horizontalPull=forward.clone().negate().setY(0).normalize();
   const hanging=objectCatch?null:landingFishPose(reelAge,catchEndpoint.y,p.catch.weight,t,horizontalPull);
   const pullDirection=hanging?new T.Vector3(hanging.direction.x,hanging.direction.y,hanging.direction.z):horizontalPull.clone().lerp(p.landedFromFight?revealPullDirection:tip.clone().sub(catchEndpoint).normalize(),T.MathUtils.smoothstep(reelAge,.55,2.35)).normalize();
   const targetRotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(-1,0,0),pullDirection);
   const bodyFight=new T.Quaternion().setFromEuler(new T.Euler(Math.sin(t*11.7)*.10*resistance+(hanging?.struggle||0)*.14,Math.sin(t*8.9+1.2)*.16*resistance,Math.sin(t*17)*.09*(hanging?.airborne||0)*resistance));
   targetRotation.multiply(bodyFight);revealFish.quaternion.slerp(targetRotation,1-Math.exp(-dt*14));alignFishMouth(revealFish,catchEndpoint);
   setFishImmersion(revealFish,clamp((-revealFish.position.y-.04)/.65,0,1));
   if(revealFish.userData.tail)revealFish.userData.tail.rotation.y=hanging?hanging.tail:Math.sin(t*21)*(.28+resistance*.42);
  }else if(revealFish)revealFish.visible=false;
  // The fish and landing endpoint must be updated before the camera follows
  // them; otherwise the first reveal frame looks at the previous catch.
  cameraUpdate(state,dt);
  const auraEl=document.querySelector('#rhythmAura');if(auraEl&&!auraEl.hidden&&bobber.visible){const bp=bobber.position.clone().project(camera),rr=renderer.domElement.getBoundingClientRect();auraEl.style.left=clamp((bp.x*.5+.5)*rr.width,32,rr.width-32)+'px';auraEl.style.top=clamp((-bp.y*.5+.5)*rr.height,32,rr.height-32)+'px'}
  if(state.lastRelease&&releaseAge<2.05){if(releaseKey!==state.lastRelease.at){if(releaseFish)scene.remove(releaseFish);releaseFish=makeSpecimen(state.lastRelease.id,state.lastRelease.variation);releaseFish.scale.setScalar(.42);scene.add(releaseFish);releaseKey=state.lastRelease.at;releaseSplashed=false}const u=clamp(releaseAge/1.55,0,1),ease=u*u*(3-2*u),releaseStart=person.position.clone().add(new T.Vector3(0,1.05,.25).applyAxisAngle(new T.Vector3(0,1,0),person.rotation.y)),releaseEnd=WATER_SPOTS[state.lastRelease.spot||state.spot].clone().lerp(person.position,.56);releaseEnd.y=.12;releaseFish.visible=u<1;releaseFish.position.lerpVectors(releaseStart,releaseEnd,ease);releaseFish.position.y+=Math.sin(u*Math.PI)*1.35;const releaseVelocity=releaseEnd.clone().sub(releaseStart);releaseVelocity.y=(1-2*u)*2.7;faceVelocity(releaseFish,releaseVelocity);releaseFish.rotation.z=Math.sin(u*Math.PI)*.28+Math.sin(t*15)*.05*(1-u);if(releaseFish.userData.tail)releaseFish.userData.tail.rotation.y=Math.sin(t*18)*.38*(1-u);if(u>.91&&!releaseSplashed){splash(releaseEnd,.72);state.onReleaseLand?.();releaseSplashed=true}}else if(releaseFish)releaseFish.visible=false;
  droplets.forEach(d=>{if(d.life<=0)return;d.life-=dt;d.v.y-=3.5*dt;d.m.position.addScaledVector(d.v,dt);d.m.material.opacity=clamp(d.life*2,0,.8);d.m.visible=d.life>0&&d.m.position.y>.14});
  boat.rotation.z=Math.sin(t*.8)*.018;boat.position.y=WATER_LEVEL+.2+Math.sin(t*.9)*.026;plants.forEach((p,i)=>{p.rotation.z=Math.sin(t*.9+i)*.04});
  if(seagullFlocks.length<1&&t>nextFlockAt){nextFlockAt=t+16+rand()*18;const route=gullRoute(rand),{dir,fromX,startY,startZ,exitZ,dur}=route,count=3+Math.floor(rand()*4),members=[];for(let mi=0;mi<count;mi++){const gull=makeSeagull();gull.visible=false;scene.add(gull);const row=Math.ceil(mi/2),side=mi===0?0:(mi%2?1:-1);members.push({gull,row,side,jitterX:(rand()-.5)*.20,jitterZ:(rand()-.5)*.22,jitterY:(rand()-.5)*.18,cycle:2.8+rand()*1.7,burst:.9+rand()*.35,flaps:2+Math.floor(rand()*2),phaseOffset:rand()*2.5,cried:false,cryAt:.22+rand()*.46})}seagullFlocks.push({members,fromX,dir,startY,startZ,exitZ,dur,t0:t,bend:route.bend,lift:route.lift,wavePhase:route.wavePhase})}
  for(let fi=seagullFlocks.length-1;fi>=0;fi--){const f=seagullFlocks[fi];const age=t-f.t0;if(age<0){f.members.forEach(m=>m.gull.visible=false);continue}const u=age/f.dur;if(u>1){f.members.forEach(m=>scene.remove(m.gull));seagullFlocks.splice(fi,1);continue}
  const pos=new T.Vector3(),ahead=new T.Vector3(),behind=new T.Vector3(),velocity=new T.Vector3(),normal=new T.Vector3(),v0=new T.Vector3(),v1=new T.Vector3();
  f.members.forEach(m=>{const delay=m.row*.035;if(u<delay){m.gull.visible=false;return}m.gull.visible=true;const q=clamp(u-delay+m.jitterX*.003,0,1);gullPath(f,q,pos);gullPath(f,Math.min(1,q+.006),ahead);gullPath(f,Math.max(0,q-.006),behind);velocity.copy(ahead).sub(behind).normalize();normal.set(-velocity.z,0,velocity.x).normalize();const yaw=-Math.atan2(velocity.z,velocity.x),pitch=Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z));v0.copy(pos).sub(behind).normalize();v1.copy(ahead).sub(pos).normalize();const turn=v0.x*v1.z-v0.z*v1.x,turnBank=clamp(turn*14,-.46,.46),lateral=m.side*m.row*.72+m.jitterZ,flapClock=(age+m.phaseOffset+m.row*.13)%m.cycle,flapping=flapClock<m.burst,flapPhase=flapping?flapClock/m.burst:0,flap=flapping?Math.sin(flapPhase*Math.PI*2*m.flaps)*.68:.035+Math.sin(age*.65+m.phaseOffset)*.018,downstroke=flapping?Math.max(0,-Math.cos(flapPhase*Math.PI*2*m.flaps)):.0;m.gull.position.copy(pos).addScaledVector(normal,lateral);m.gull.position.y+=m.jitterY+downstroke*.045;m.gull.rotation.order='YXZ';m.gull.rotation.set(turnBank+m.side*.025,yaw,pitch,'YXZ');m.gull.userData.left.root.rotation.x=-flap;m.gull.userData.right.root.rotation.x=flap;m.gull.userData.left.wrist.rotation.x=-flap*.32-.035;m.gull.userData.right.wrist.rotation.x=flap*.36+.04;m.gull.userData.left.wrist.rotation.y=flapping?-.05:-.13;m.gull.userData.right.wrist.rotation.y=flapping?.05:.13;m.gull.userData.tail.rotation.y=turnBank*.42+Math.sin(age*1.8+m.phaseOffset)*.025;if(!m.cried&&q>m.cryAt&&rand()<.012){m.cried=true;const camPos=camera.position,distToCam=m.gull.position.distanceTo(camPos),pan=clamp((m.gull.position.x-camPos.x)/14,-1,1),vol=clamp(1-distToCam/65,.025,.24);window.__seagullCry?.(pan,vol,m.gull.position)}})}
  updateSunDirection();
  renderer.toneMappingExposure=renderSettings.exposure;
  renderer.toneMapping=({aces:T.ACESFilmicToneMapping,neutral:T.NeutralToneMapping,agx:T.AgXToneMapping,reinhard:T.ReinhardToneMapping,linear:T.LinearToneMapping,none:T.NoToneMapping})[renderSettings.toneMapping]??T.ACESFilmicToneMapping;
  sun.color.set(renderSettings.sunColor);lighting.uSunRadiance.value.copy(sun.color).multiplyScalar(sun.intensity);
  if(shadingMode!=='shaded'&&frame%30===0)updateShadingMode();renderer.shadowMap.needsUpdate ||= frame%8===0;atmosphere.install(scene);atmosphere.beginCapture();try{waterSystem.capture(camera);}finally{atmosphere.endCapture()}postFX.composer.render();const labelBoxes=[];for(const id of Object.keys(WATER_SPOTS)){const el=document.querySelector(`[data-spot="${id}"]`);if(el){const projected=screenPos(id),maxY=host.clientHeight-(host.clientHeight<760?160:190),visible=projected.z>-1&&projected.z<1&&projected.x>(host.clientWidth<700?70:88)&&projected.x<host.clientWidth-(host.clientWidth<700?70:88)&&projected.y>110&&projected.y<maxY;el.style.visibility=visible?'visible':'hidden';if(!visible){labelScreen.delete(id);continue}const tx=projected.x,baseY=projected.y-24;let targetY=baseY;for(const box of labelBoxes){if(Math.abs(tx-box.x)<(host.clientWidth<700?100:162)&&Math.abs(targetY-box.targetY)<(host.clientWidth<700?38:54))targetY=box.targetY+(host.clientWidth<700?42:56)}let tracked=labelScreen.get(id);if(!tracked){tracked={x:tx,y:targetY};labelScreen.set(id,tracked)}tracked.x=T.MathUtils.damp(tracked.x,tx,10,dt);tracked.y=T.MathUtils.damp(tracked.y,targetY,10,dt);labelBoxes.push({x:tx,targetY});el.style.left=tracked.x.toFixed(2)+'px';el.style.top=tracked.y.toFixed(2)+'px'}}frame++;requestAnimationFrame(tick);
 }
 cameraUpdate(getState(),.016);requestAnimationFrame(tick);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;document.querySelector('#renderError').hidden=false});
 return {renderer,scene,camera,setShadingMode,setSkyTexture:skyController.select,setWaterNormal:waterSystem.setNormalPreset,setWaterNormalTexture:waterSystem.setNormalTexture,setInteractionRadius:waterSystem.setInteractionRadius,setPreviewTime(value){previewTime=value;},cancelIntro,prepareCast(){cancelIntro();aimReturnPose={yaw,pitch,closeYaw,closePitch,desiredZoom};clickedWaterPoint=null;focusBlend=0;closeYaw=closePitch=0;transitionView(1,cameraBlend>.9?380:760)},cancelCastAim(){if(aimReturnPose){({yaw,pitch,closeYaw,closePitch,desiredZoom}=aimReturnPose);aimReturnPose=null}const s=getState();transitionView(s.overview||!s.keepFishingView?0:1)},commitCastAim(){aimReturnPose=null},isAimReady(){return getState().aiming&&!viewTransition&&cameraSettled(camera.position,cameraAim,aimTargetPosition,aimTargetLook,cameraBlend)},finishAimTransition(){viewTransition=null;camera.position.copy(aimTargetPosition);cameraAim.copy(aimTargetLook);camera.lookAt(cameraAim);camera.updateMatrixWorld();cameraBlend=1},reset(){cancelIntro();clickedWaterPoint=null;yaw=.16;pitch=1.02;closeYaw=closePitch=0;desiredZoom=1;transitionView(getState().keepFishingView?1:0)},topView(){cancelIntro();clickedWaterPoint=null;pitch=1.47;closeYaw=closePitch=0;desiredZoom=1;transitionView(0)},zoom(delta){cancelIntro();zoomBy(delta)},resetFightView(){fightViewYaw=fightViewPitch=0;desiredFightZoom=1},waitingRipple(){const state=getState(),spot=castSpot(state),side=new T.Vector3(Math.sin(time.value*.73)*.75,0,Math.cos(time.value*.61)*.55);waterSystem.splash(spot.x+side.x,spot.z+side.z,.16)},tacticResponse(success,id){const state=getState(),spot=castSpot(state);if(id==='tease'){waterSystem.splash(spot.x,spot.z,success?.28:.15);waterSystem.splash(spot.x+.12,spot.z-.08,.16)}else if(id==='shorten')waterSystem.splash(spot.x,spot.z,success?.25:.12)},setWeather(id){sun.intensity=id==='rain'?1.45:id==='mist'?2.05:2.65;hemi.intensity=id==='mist'?2.05:1.85;lighting.uSunRadiance.value.copy(sun.color).multiplyScalar(sun.intensity);atmosphere.setWeather(id);waterSystem.setWeather(id);postFX.setWeather(id);},getStats(){return{triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries}},dispose(){stopped=true;atmosphere.dispose();seabedDetails.dispose();sandAlbedo.dispose();sandNormal.dispose();ground.geometry.dispose();groundMat.dispose();skyController.dispose(texture=>texture.dispose());sky.geometry.dispose();skyMat.dispose();for(const [object,entry] of wireMeshes){object.material=entry.material;entry.overlay?.removeFromParent();if(entry.wireOnly!==wireOnlyMaterial)entry.wireOnly.dispose();if(entry.wireOverlay!==wireOverlayMaterial)entry.wireOverlay.dispose()}wireOnlyMaterial.dispose();wireOverlayMaterial.dispose();waterSystem.dispose();postFX.dispose()}};
}

export function createSpecimenViewer(host){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(320,210,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,320/210,.1,20);camera.position.set(-.5,.58,3.45);camera.lookAt(0,0,0);scene.add(new T.HemisphereLight('#fffbea','#a0bdaf',1.9));const light=new T.DirectionalLight('#fff2d8',2.6);light.position.set(-3,4,4);scene.add(light);
 let model=null,visible=false,request=0,viewerFrame=0;const cache=new Map(),assets=new Map();
 function set(id,variation=''){
  const token=++request;if(model)scene.remove(model);const key=id+'|'+variation;
  if(!cache.has(key))cache.set(key,makeSpecimen(id,variation));model=cache.get(key);model.rotation.y=.18;scene.add(model);renderer.render(scene,camera);
  if(specimenIds.has(id)){
   if(!assets.has(id))assets.set(id,loadSpecimen(id));
   assets.get(id).then(asset=>{if(!asset||token!==request)return;scene.remove(model);model=asset;model.rotation.y=.18;scene.add(model);renderer.render(scene,camera)});
  }
 }
 function frame(t){if(!visible){viewerFrame=0;return}if(model){model.rotation.y=.18+Math.sin(t*.0006)*.18;model.position.y=Math.sin(t*.0015)*.035;if(model.userData.tail)model.userData.tail.rotation.y=Math.sin(t*.003)*.12;renderer.render(scene,camera)}viewerFrame=requestAnimationFrame(frame)}
 return{set,show(v){visible=v;if(v&&!viewerFrame)viewerFrame=requestAnimationFrame(frame);else if(!v&&viewerFrame){cancelAnimationFrame(viewerFrame);viewerFrame=0}},thumbnail(id){return specimenIds.has(id)?'./assets/models/specimens/'+id+'.png?v=art4':(set(id),renderer.domElement.toDataURL('image/png'))},renderer};
}

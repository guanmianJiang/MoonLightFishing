import {renderSettings as settings,glslNumber,settingsUniforms} from './render-settings.js';
import {skyPanoramaGLSL,skyRadianceGLSL,skyReflectionGLSL} from './sky-settings.mjs';
import {waterOpticsGLSL} from './water-optics.mjs';
import {waterNormalsGLSL} from './water-normals.mjs';
import {waterContactGLSL} from './water-contact.mjs';
import {waterCapturedDepthGLSL} from './water-captured-depth.mjs';
import * as T from './three.module.js';
import {coastGeometry,shoreGLSL,shore} from './coast.js';
import {waterSurfaceGLSL} from './water-surface.js';
import {causticsGLSL} from './caustics.js';
import {createWaterFlow,interactionDriveFromSpeed,sampleInteractionStroke} from './water-flow.js';

export function createWater(renderer,scene,time,lighting,atmosphereUniforms){
 const loader=new T.TextureLoader();
 const waterNormal07=loader.load(settings.normalTexture);
 const waterNormal03=loader.load('./assets/water-normal-03.jpg');
 const waterNormal06=loader.load('./assets/water-normal-06.jpg');
 const originalNormalA=loader.load('./assets/water-normal-raider-07.jpg'),originalNormalB=loader.load('./assets/water-normal-raider-01.png'),blueNoise=loader.load('./assets/water-blue-noise.jpg');
 for(const texture of [waterNormal07,waterNormal03,waterNormal06,originalNormalA,originalNormalB,blueNoise]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.NoColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8)}
 const comparisonNormals=new Map();let normalRequest=0;
 async function setNormalPreset(preset){
  const request=++normalRequest;
  if(preset==='07'){material.uniforms.uNormalA.value=waterNormal07;material.uniforms.uNormalB.value=waterNormal07;return;}
  if(preset==='03'){material.uniforms.uNormalA.value=waterNormal03;material.uniforms.uNormalB.value=waterNormal03;return;}
  if(preset==='original'){material.uniforms.uNormalA.value=originalNormalA;material.uniforms.uNormalB.value=originalNormalB;return;}
  if(preset==='06'){material.uniforms.uNormalA.value=waterNormal06;material.uniforms.uNormalB.value=waterNormal06;return;}
  if(!['06','07'].includes(preset))throw new Error('Unknown water normal preset');
  if(!comparisonNormals.has(preset))comparisonNormals.set(preset,loader.loadAsync(`./assets/water-normal-${preset}.png`).then(texture=>{
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.NoColorSpace;
   texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return texture;
  }));
  const texture=await comparisonNormals.get(preset);
  // Both flow layers use the candidate; leaving the old secondary normal would
  // hide its character. UV scale, strength, lighting and flow stay identical.
  if(request===normalRequest){material.uniforms.uNormalA.value=texture;material.uniforms.uNormalB.value=texture;}
 }
 const customNormals=new Map([[settings.normalTexture,waterNormal07]]);
 async function setNormalTexture(path){
  const request=++normalRequest;
  let texture=customNormals.get(path);
  if(!texture){texture=await loader.loadAsync(path);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.NoColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);customNormals.set(path,texture);}
  if(request===normalRequest){material.uniforms.uNormalA.value=texture;material.uniforms.uNormalB.value=texture;}
 }
 const captureTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});
 captureTarget.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 captureTarget.texture.colorSpace=T.NoColorSpace;
 const events=Array.from({length:12},()=>new T.Vector4(100,100,-100,0));let cursor=0;
 const interactionGridSize=112,interactionRadius={value:2.2};
 const interactionLayers=Array.from({length:3},()=>{
  const flow=createWaterFlow(interactionGridSize);
  const texture=new T.DataTexture(flow.pixels,flow.size,flow.size,T.RGBAFormat,T.FloatType);
  texture.minFilter=texture.magFilter=T.LinearFilter;
  texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  const center=new T.Vector2(),direction=new T.Vector2(1,0);
  return {flow,texture,center,direction,uniforms:{uInteractionCenter:{value:center},uInteractionDirection:{value:direction},uInteractionRadius:interactionRadius,uInteractionActive:{value:0},uInteractionGain:{value:0},uInteractionBreak:{value:0},uInteractionStart:{value:0},uInteractionField:{value:texture}},mesh:null};
 });
 const interactionUniforms=interactionLayers[0].uniforms;
 const interactionTargetCenter=new T.Vector2(),interactionTargetDirection=new T.Vector2(1,0),interactionLastDeposit=new T.Vector2();
 let interactionTarget=0,interactionHasHeading=false,interactionNeedsAnchor=false,activeLayer=null,nextLayer=0;
 const interactionWaveGLSL=`
  uniform sampler2D uInteractionField;
  vec3 interactionWave(vec2 q){
   vec2 d=q-uInteractionCenter;
   float radius=max(uInteractionRadius,.7);
   vec2 uv=clamp(d/radius*.5+.5,vec2(.001),vec2(.999));
   vec3 field=texture2D(uInteractionField,uv).rgb;
   // The solver absorbs waves at its outer cells. No circular shader envelope
   // is applied to the height or the resulting normal and lighting.
   float raw=field.r*min(radius*.76,1.38)*uInteractionGain;
   // The solver already soft-limits its height. Preserve the crest and trough
   // cross-section here; a second tight limit flattened the top of the wave.
   float lift=raw*inversesqrt(1.+raw*raw/(.18*.18));
   return vec3(0.,lift,0.);
  }
  float interactionHeight(vec2 q){
   return interactionWave(q).y;
  }
  `;
 const material=new T.ShaderMaterial({
  // The moving contact SDF owns wet pixels. Always pass the sand depth but
  // keep depth testing enabled: otherwise WebGL never writes sea depth and
  // submerged fish render a second, unabsorbed copy over the composite.
  depthTest:true,depthFunc:T.AlwaysDepth,depthWrite:true,
  uniforms:{...settingsUniforms,...atmosphereUniforms,...interactionUniforms,uPatchMode:{value:0},uGridCenter:{value:new T.Vector2()},uInvProjection:{value:new T.Matrix4()},uInvView:{value:new T.Matrix4()},uViewProjection:{value:new T.Matrix4()},uTime:time,uScene:{value:captureTarget.texture},uDepth:{value:captureTarget.depthTexture},uNormalA:{value:waterNormal07},uNormalB:{value:waterNormal07},uNoise:{value:blueNoise},uNear:{value:.1},uFar:{value:1800},uEvents:{value:events},uWeather:{value:0}},
  vertexShader:`
   uniform float uTime,uPatchMode,uInteractionRadius,uInteractionGain,uInteractionStart;
   uniform vec2 uInteractionCenter,uInteractionDirection,uGridCenter;
   varying vec3 vWorld;varying vec4 vClip;
   ${shoreGLSL}
   ${waterSurfaceGLSL}
   ${interactionWaveGLSL}
   void main(){
    vec3 p=position;
    if(uPatchMode>.5)p.xz=p.xz*uInteractionRadius+uInteractionCenter;
    else {
     // Fixed topology, camera-focused along shore and contact-focused across it.
     // The linear inner spans guarantee sub-metre tangent sampling and several
     // rows through the 40 cm meniscus; exponential tails still reach the horizon.
     vec2 q=position.xz;
     float sx=sign(q.x);
     float ax=abs(q.x);
     float tangentMetres=ax<=.65?ax*(12./.65)
       :12.+2.*(exp((ax-.65)/.35*log(5995.))-1.);
     p.x=uGridCenter.x+sx*tangentMetres;
     // Put fine rows on both the moving contact and the camera-visible sea.
     // Spend almost every row on visible sea: a 15 cm guard strip starts the
     // mesh just shoreward of contact, with 56 rows in the first 2 metres.
     // The middle span resolves nearby waves; only the tail reaches horizon.
     float nearEnd=clamp(max(14.,uGridCenter.y+8.),14.,40.);
     float normalMetres=q.y<=-.3?-.15+(q.y+1.)/.7*2.15
       :q.y<=.6?2.+(q.y+.3)/.9*(nearEnd-2.)
       :nearEnd+exp((q.y-.6)/.4*log(12001.-nearEnd))-1.;
     float contactD=-shoreRunupReach(p.x,uTime)*sqrt(1.+pow(shoreSlope(p.x),2.));
     float d=contactD+normalMetres;
     p.z=shore(p.x)+d;
    }
    float contact=shoreContactDistance(p.xz,uTime);
    float width=max(uSetting_meniscusWidth,.005);
    vec2 curve=shoreMeniscusCurve(contact/width,uSetting_meniscusCrown);
    float lift=.060*uSetting_meniscusBulge*uSetting_meniscusStrength*curve.x;
    if(uPatchMode>.5){
     vec3 wave=interactionWave(p.xz);
     p.y+=wave.y;
    }
    p.y+=waterLevel+waterSurface(p.xz,uTime).z+lift;
    vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vClip=projectionMatrix*viewMatrix*world;gl_Position=vClip;
   }`,
  fragmentShader:`
   uniform float uTime,uNear,uFar,uWeather,uPatchMode,uInteractionRadius,uInteractionActive,uInteractionGain,uInteractionBreak,uInteractionStart;
   uniform vec2 uInteractionCenter,uInteractionDirection;
   uniform vec3 uGradientColors[8];uniform float uGradientDepths[8];uniform int uGradientCount;
   uniform vec3 uSunDirection,uSunRadiance;
   uniform sampler2D uScene,uDepth,uNormalA,uNormalB,uNoise,uSky;uniform vec4 uEvents[12];
   uniform mat4 uInvProjection,uInvView,uViewProjection;
   varying vec3 vWorld;varying vec4 vClip;
   ${shoreGLSL}
   ${skyPanoramaGLSL}
   ${skyRadianceGLSL}
   ${waterOpticsGLSL}
   ${waterNormalsGLSL}
   ${waterContactGLSL}
   ${waterCapturedDepthGLSL}
   ${skyReflectionGLSL}
   ${waterSurfaceGLSL}
   ${causticsGLSL}
   ${interactionWaveGLSL}
   float linearDepth(float d){return waterLinearEyeDepth(d,uNear,uFar);}
   vec3 receiverWorldPosition(vec2 uv,float depth){
    vec4 view=uInvProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
    return (uInvView*vec4(view.xyz/max(view.w,.00001),1.)).xyz;
   }
   vec4 localEnvironmentReflection(vec3 origin,vec3 direction){
    if(uSetting_reflectionSceneStrength<=0.||direction.y<=.015)return vec4(0.);
    vec3 start=origin+vec3(0.,.04,0.);
    float previousTravel=0.,travel=0.;
    for(int i=0;i<12;i++){
     travel=travel*1.52+.0936;
     vec3 probe=start+direction*travel;
     vec4 clip=uViewProjection*vec4(probe,1.);
     if(clip.w<=0.)break;
     vec2 hitUV=clip.xy/clip.w*.5+.5;
     if(any(lessThan(hitUV,vec2(.001)))||any(greaterThan(hitUV,vec2(.999))))break;
     float raw=texture2D(uDepth,hitUV).r;
     float gap=-(viewMatrix*vec4(probe,1.)).z-linearDepth(raw);
     if(raw<.9999&&gap>=0.){
      float lo=previousTravel,hi=travel;
      vec3 hitWorld=receiverWorldPosition(hitUV,raw);
      for(int j=0;j<3;j++){
       float mid=(lo+hi)*.5;
       vec3 point=start+direction*mid;
       vec4 midClip=uViewProjection*vec4(point,1.);
       vec2 midUV=midClip.xy/midClip.w*.5+.5;
       float midRaw=texture2D(uDepth,midUV).r;
       float midGap=-(viewMatrix*vec4(point,1.)).z-linearDepth(midRaw);
       if(midRaw<.9999&&midGap>=0.){hi=mid;hitUV=midUV;hitWorld=receiverWorldPosition(midUV,midRaw);}else lo=mid;
      }
      vec3 hitPoint=start+direction*hi;
      float edge=min(min(hitUV.x,hitUV.y),min(1.-hitUV.x,1.-hitUV.y));
      float confidence=waterReflectionHit(edge,hitWorld.y-origin.y,length(hitPoint-hitWorld),hi);
      return vec4(texture2D(uScene,hitUV).rgb,confidence);
     }
     previousTravel=travel;
    }
    return vec4(0.);
   }
   vec3 unpackWaterNormal(vec3 c){vec3 n=c*2.-1.;return normalize(vec3(n.xy,max(n.z,.16)));}
   void main(){
   vec2 p=vWorld.xz,uv=vClip.xy/vClip.w*.5+.5;
    // Each fine patch covers its signed crest and trough. Empty pixels stay
    // transparent so older wake patches remain visible under newer ones.
    if(uPatchMode>.5&&abs(interactionHeight(p))<.002)discard;
    float contactDistance=shoreContactDistance(p,uTime);
    // Rasterize the moving shoreline from its continuous world-space SDF.
    // Clipping against interpolated vertex height exposed individual triangles
    // as long straight wedges whenever the mesh crossed the sloped sand.
    float contactClipAA=max(fwidth(contactDistance),.005);
    if(contactDistance<-contactClipAA)discard;
    float shoreFade=smoothstep(0.,1.8,contactDistance),distanceToEye=length(cameraPosition-vWorld);
    float pixelFootprint=max(length(dFdx(p)),length(dFdy(p)));
    vec3 view=normalize(cameraPosition-vWorld);
    // This fade controls only water-body colour detail. Normal-map filtering
    // follows its own UV pixel footprint; never erase it by world distance.
    float bodyDetailFade=1.-smoothstep(.07,.32,pixelFootprint);
    float shoreN=shoreSlope(p.x);
    vec2 shoreFlow=normalize(vec2(-shoreN,1.));
    vec2 shoreTangent=vec2(shoreFlow.y,-shoreFlow.x);
    float shoreCoord=dot(p,shoreTangent);
    float eventPhase=shoreEventPhase(p.x,uTime);
    vec2 macroSlope=waterSurface(p,uTime).xy;
    vec2 baseMacroSlope=macroSlope,localWaveSlope=vec2(0.);
    float localWaveHeight=0.,localWaveCurvature=0.;
    if(uPatchMode>.5){
     float h=max(.018,uInteractionRadius*2./${interactionGridSize-1}.);
     localWaveHeight=interactionHeight(p);
     float heightRight=interactionHeight(p+vec2(h,0.));
     float heightLeft=interactionHeight(p-vec2(h,0.));
     float heightUp=interactionHeight(p+vec2(0.,h));
     float heightDown=interactionHeight(p-vec2(0.,h));
     localWaveSlope=vec2(heightRight-heightLeft,heightUp-heightDown)/(2.*h);
     localWaveSlope*=min(1.,1.2/max(length(localWaveSlope),.001));
     localWaveCurvature=max(0.,4.*localWaveHeight-heightRight-heightLeft-heightUp-heightDown)/max(h*.8,.025);
     macroSlope+=localWaveSlope;
    }
    // Normal 07 supplies the water detail. Sample it slightly larger
    // and at restrained amplitude so the sun breaks into coherent glints.
    // Both octaves follow one broad flow, but breathe sideways at different
    // spatial frequencies. This prevents the old conveyor-belt cross slide.
    float normalTimeA=uTime*uSetting_normalSpeedA;
    vec2 flowA=vec2(.006,.014)*normalTimeA;
    flowA+=vec2(sin(p.y*.075+normalTimeA*.23),cos(p.x*.060-normalTimeA*.19))*.010;
    vec2 uvA=p*uSetting_normalScaleA+flowA;
    mat2 detailRotation=mat2(.8,.6,-.6,.8);
    float normalTimeB=uTime*uSetting_normalSpeedB;
    vec2 flowB=vec2(-.004,.009)*normalTimeB;
    flowB+=vec2(sin(p.x*.052-normalTimeB*.17+2.1),cos(p.y*.068+normalTimeB*.21+1.3))*.013;
    vec2 uvB=detailRotation*p*uSetting_normalScaleB+flowB;
    vec3 normalA=unpackWaterNormal(texture2DGradEXT(uNormalA,uvA,dFdx(uvA),dFdy(uvA)).rgb);
    vec3 normalB=unpackWaterNormal(texture2DGradEXT(uNormalB,uvB,dFdx(uvB),dFdy(uvB)).rgb);
    normalB.xy=transpose(detailRotation)*normalB.xy;
    float breakup=texture2D(uNoise,p*.018+vec2(uTime*.0015,0.)).r;
    // Add partial derivatives, not blue-channel products (which inflated slope).
    vec2 detailSlope=(vec2(waterNormalSlope(normalA.x,normalA.z),waterNormalSlope(normalA.y,normalA.z))*uSetting_normalStrengthA
     +vec2(waterNormalSlope(normalB.x,normalB.z),waterNormalSlope(normalB.y,normalB.z))*uSetting_normalStrengthB)*shoreFade;
    float rings=0.;vec2 interactionSlope=vec2(0.);
    for(int i=0;i<12;i++){
     vec4 e=uEvents[i];float age=uTime-e.z;vec2 q=p-e.xy;float r=length(q),front=r-age*.54;
     float envelope=exp(-front*front*30.)*exp(-age*.72)*step(0.,age)*step(age,4.5)*e.w;
     float wave=sin(r*24.-age*12.96);vec2 rippleSlope=normalize(q+vec2(.001))*wave*envelope*.20;
     interactionSlope+=rippleSlope;macroSlope+=rippleSlope;rings+=max(wave,0.)*envelope;
    }
    vec3 normal=normalize(vec3(-(macroSlope.x+detailSlope.x),1.,-(macroSlope.y+detailSlope.y)));
    vec3 baseNormal=normalize(vec3(-(baseMacroSlope.x+detailSlope.x),1.,-(baseMacroSlope.y+detailSlope.y)));
    vec3 specNormal=normal;
    float rawSceneDepth=texture2D(uDepth,uv).r;
    float surfaceDepth=-(viewMatrix*vec4(vWorld,1.)).z;
    vec3 originalReceiver=receiverWorldPosition(uv,rawSceneDepth);
    float originalValid=waterCapturedReceiverValid(rawSceneDepth,linearDepth(rawSceneDepth),surfaceDepth,vWorld.y-originalReceiver.y,uNear,uFar);
    float originalColumn=waterCapturedColumn(vWorld.y,originalReceiver.y,originalValid);
    // Geometry and optical profile must share one real-world width. Pixel
    // derivatives below soften minified views without moving the curve.
    float meniscusWidth=max(uSetting_meniscusWidth,.005);
    float liquidRipple=(sin(shoreCoord*6.1-uTime*1.7)+.45*sin(shoreCoord*11.3+uTime*1.1))*.009;
    float rippleEnvelope=smoothstep(0.,.09,contactDistance)
      *(1.-smoothstep(meniscusWidth*.72,meniscusWidth,contactDistance));
    float normalizedContact=max(0.,contactDistance+liquidRipple*rippleEnvelope)/meniscusWidth;
    float normalizedAA=min(fwidth(contactDistance)/meniscusWidth,.28);
    // The same cross-section lifts the actual nearshore mesh and drives
    // its optical normal, refraction and lighting.
    float lensX=clamp(normalizedContact,0.,1.);
    float crown=clamp(uSetting_meniscusCrown,.12,.55);
    vec2 curve=shoreMeniscusCurve(lensX,crown);
    float meniscusLensProfile=curve.x*uSetting_meniscusBulge;
    float meniscusLensSlope=clamp(curve.y*uSetting_meniscusBulge,-2.2,3.2);
    float ridgeExtent=.105;
    float meniscusOuterRidge=1.-smoothstep(max(0.,ridgeExtent-normalizedAA),ridgeExtent+normalizedAA,normalizedContact);
    float meniscusInnerRidge=smoothstep(crown*.55-normalizedAA,crown+normalizedAA,normalizedContact)
      *(1.-smoothstep(crown+.12-normalizedAA,min(.95,crown+.40)+normalizedAA,normalizedContact));
    float contactWaterMask=smoothstep(-contactClipAA,contactClipAA,contactDistance);
    // Keep the sea-contact lens present throughout every runup phase.
    float seamMeniscus=1.;
    meniscusLensProfile*=contactWaterMask*seamMeniscus;
    meniscusOuterRidge*=contactWaterMask*seamMeniscus;
    meniscusInnerRidge*=contactWaterMask*seamMeniscus;
    meniscusLensSlope*=contactWaterMask*seamMeniscus;
    // Project the normal perturbation into camera space, not world XZ into screen XY.
    vec2 refrSlope=(viewMatrix*vec4(normal-vec3(0.,1.,0.),0.)).xy;
    float distortionMask=waterDepthRefractionGate(originalColumn)*originalValid;
    vec2 offset=refrSlope*.009*distortionMask;
    vec2 towardShore=normalize(vec2(shoreSlope(p.x),-1.));
    // Project a local world-space bend. Fixed UV shifts stretched the beach
    // across the contact at distant/overhead views and changed with viewport size.
    float bendLimit=waterContactRefractionLimit(meniscusWidth,uSetting_meniscusStrength);
    float bendMetres=clamp(meniscusLensSlope*.025*uSetting_meniscusRefraction*uSetting_meniscusStrength,-bendLimit,bendLimit);
    vec4 bentClip=uViewProjection*vec4(vWorld+vec3(towardShore.x,0.,towardShore.y)*bendMetres,1.);
    vec2 bendUV=bentClip.xy/max(bentClip.w,.00001)*.5+.5;
    if(bentClip.w>0.)offset+=(bendUV-uv)*distortionMask;
    offset*=min(1.,.004/max(length(offset),.00001));
    vec2 refrUV=uv+offset;
    bool refrInside=all(greaterThanEqual(refrUV,vec2(0.)))&&all(lessThanEqual(refrUV,vec2(1.)));
    float receiverRawDepth=texture2D(uDepth,clamp(refrUV,0.,1.)).r;
    vec3 receiverWorld=receiverWorldPosition(refrUV,receiverRawDepth);
    float receiverValid=waterCapturedReceiverValid(receiverRawDepth,linearDepth(receiverRawDepth),surfaceDepth,vWorld.y-receiverWorld.y,uNear,uFar);
    // Colour, depth and world position fall back together. A UV outside the
    // image or hitting foreground/dry land must never drag it into the sea.
    if(!refrInside||receiverValid<.5||originalValid<.5){
     refrUV=uv;receiverRawDepth=rawSceneDepth;receiverWorld=originalReceiver;receiverValid=originalValid;
    }
    vec3 source=texture2D(uScene,refrUV).rgb;
    source*=receiverValid;
    float receiverSubmersion=waterCapturedColumn(vWorld.y,receiverWorld.y,receiverValid);
    float waterDepth=receiverSubmersion;
    // One captured column drives every optical contribution, including a fish
    // suspended above the seabed. No coastline or procedural bed substitution.
    float opticalDepth=waterOpticalPath(waterDepth,view.y);
    // The captured depth is the visible receiver, whether sand, reef or fish.
    // Reconstruct its world position and project the refracted sun onto it
    // before the receiver colour travels back through the absorbing water.
    vec3 receiverNormal=cross(dFdx(receiverWorld),dFdy(receiverWorld));
    receiverNormal/=max(length(receiverNormal),.00001);
    receiverNormal*=dot(receiverNormal,cameraPosition-receiverWorld)<0.?-1.:1.;
    vec3 refractedSun=refract(-uSunDirection,vec3(0.,1.,0.),.7502);
    vec3 receiverProjection=receiverWorld-refractedSun*(receiverSubmersion/max(-refractedSun.y,.08));
    float receiverBlur=smoothstep(.9,4.5,receiverSubmersion)*.32;
    vec3 causticPos=receiverProjection*uSetting_causticScale+vec3(0.,uTime*.075*uSetting_causticSpeed,0.);
    float causticRaw=waterReceiverCaustics(causticPos,receiverBlur);
    float causticAA=max(fwidth(causticRaw),.025);
    float causticFocus=exp(clamp(causticRaw*2.8-1.7,-8.,1.2))/(1.+causticAA*5.);
    float causticDepthMask=smoothstep(uSetting_causticMinDepth,uSetting_causticFadeInDepth,receiverSubmersion)
      *(1.-smoothstep(uSetting_causticFadeOutDepth,uSetting_causticDepth,receiverSubmersion))*exp(-receiverSubmersion*.32);
    float causticFacing=mix(.30,1.,smoothstep(-.12,.65,dot(receiverNormal,-refractedSun)));
    float depthEdge=max(abs(dFdx(receiverRawDepth)),abs(dFdy(receiverRawDepth)));
    float causticContinuity=1.-smoothstep(.001,.006,depthEdge);
    float causticFootprint=max(length(dFdx(receiverWorld.xz)),length(dFdy(receiverWorld.xz)));
    float causticResolution=1.-smoothstep(.12,.60,causticFootprint);
    float causticBrightness=mix(.35,1.25,smoothstep(-.65,.65,lowFrequencyDepthNoise(receiverProjection.xz,uTime*.35)));
    float causticLight=causticFocus*causticDepthMask*causticFacing*causticContinuity*causticResolution*causticBrightness;
    // A soft light accent must leave sand texture and scattered shells readable.
    float causticGain=min(.32,causticLight*uSetting_causticStrength*.18)
      *smoothstep(.15,.75,contactDistance)*receiverValid;
    source*=1.+causticGain;
    // Receiver depth controls both legs of light transport, including fish
    // suspended above a deep bed. The gradient only supplies scattered light.
    float absorptionStrength=max(uSetting_waterAbsorption,0.);
    // Keep the full 0-10x control useful at ordinary 1-3 m receiver depths.
    // The previous coefficients saturated transmission around 3-4x, so the
    // upper half of the slider appeared to do almost nothing.
    vec3 absorption=absorptionStrength*vec3(.28,.065,.025);
    vec3 scattering=vec3(.035,.085,.10);
    // Preserve warm shallow receivers; gradually build a cooler water column
    // offshore instead of pre-tinting the sand into a uniform teal plane.
    scattering*=mix(1.,2.4,smoothstep(.4,5.,receiverSubmersion));
    vec3 waterBody=uGradientColors[0];
    for(int i=1;i<8;i++){
     if(i>=uGradientCount)break;
     float blend=clamp((waterDepth-uGradientDepths[i-1])/max(uGradientDepths[i]-uGradientDepths[i-1],.001),0.,1.);
     waterBody=mix(waterBody,uGradientColors[i],blend);
    }
    float sunPath=waterOpticalPath(waterDepth,uSunDirection.y);
    vec3 refracted=vec3(
     waterChannelRadiance(source.r,waterBody.r,absorption.r,scattering.r,opticalDepth,sunPath),
     waterChannelRadiance(source.g,waterBody.g,absorption.g,scattering.g,opticalDepth,sunPath),
     waterChannelRadiance(source.b,waterBody.b,absorption.b,scattering.b,opticalDepth,sunPath));
    // Water-body grading belongs to transmission; never recolour the sky mirror.
    float waterLuminance=dot(refracted,vec3(.2126,.7152,.0722));
    refracted=max(vec3(0.),mix(vec3(waterLuminance),refracted,1.17)*vec3(.94,.99,1.075));
    float meniscusTilt=clamp(meniscusLensSlope*.32,-.56,.86);
    vec2 glintSlope=normalA.xy*.075*meniscusLensProfile;
    vec3 meniscusNormal=normalize(vec3(towardShore.x*meniscusTilt+glintSlope.x,1.,
      towardShore.y*meniscusTilt+glintSlope.y));
    // Reuse the decoded/composed water normal; retain the shoreline curvature.
    vec3 reflectionNormal=normalize(mix(normal,meniscusNormal,clamp(meniscusLensProfile*uSetting_meniscusStrength,0.,1.)));
    float reflectionNdotV=dot(reflectionNormal,view);
    float reflectionWeight=waterReflectionWeight(reflectionNdotV,uSetting_reflectionFresnelMin,uSetting_reflectionFresnelPower,uSetting_reflectionStrength);
    vec3 reflectedDir=reflect(-view,reflectionNormal);
    // Reflect the same environment radiance that the sky dome displays.
    vec3 skyDirection=skyReflectionDirection(reflectedDir);
    vec3 reflectedSky=skyEnvironmentRadiance(skyDirection,skyReflectionSample(uSky,skyDirection),vWorld.y);
    if(reflectionWeight>.025){
     vec4 localReflection=localEnvironmentReflection(vWorld,reflectedDir);
     reflectedSky=mix(reflectedSky,localReflection.rgb,localReflection.a*clamp(uSetting_reflectionSceneStrength,0.,1.));
    }
    // Direct solar glints are handled once by the toon highlight below.
    reflectedSky*=waterReflectionGain(uSetting_reflectionStrength);
    float crest=clamp(length(macroSlope)*3.0,0.,1.);
    vec3 color=refracted;
    color*=.985+(breakup-.5)*.035;
    float broadLight=clamp(.5+macroSlope.x*1.35-macroSlope.y*.95,0.,1.);
    color*=mix(.975,1.025,mix(.5,broadLight,bodyDetailFade));
    float rippleLight=clamp(.5+dot(interactionSlope,vec2(1.25,-.85))*2.2,0.,1.);
    color*=mix(1.,mix(.94,1.07,rippleLight),clamp(length(interactionSlope)*4.5,0.,1.));
    vec3 lightA=uSunDirection;
    // Light follows the simulated slope; the crest receives a narrow lit face.
    float localSunChange=dot(normal,lightA)-dot(baseNormal,lightA);
    color*=1.+clamp(localSunChange*.82,-.13,.30);
    float troughShade=smoothstep(.025,.18,-localWaveHeight)
      *(1.-clamp(dot(normal,lightA),0.,1.))*.055;
    color*=1.-troughShade;
    // Slope lighting shapes transmitted water, not the environment mirror.
    color=mix(color,reflectedSky,reflectionWeight);
    // RaiderShader_Water: power lobe -> toon threshold, without GGX/BRDF.
    vec3 halfDir=normalize(lightA+view);
    float nh=max(dot(specNormal,halfDir),0.);
    float rawSpecular=pow(nh,uSetting_specularPower);
    float specularAA=max(fwidth(rawSpecular)*.5,.0001);
    float toonSpecular=smoothstep(uSetting_specularThreshold-specularAA,
      uSetting_specularThreshold+uSetting_specularSoftness+specularAA,rawSpecular);
    // Do not paint deep-water sparkle onto a nearly transparent water film.
    // The separate meniscus catchlight below still traces the contact edge.
    float specularDepthGate=mix(.20,1.,smoothstep(.055,.36,waterDepth));
    float wetFade=smoothstep(.03,.72,contactDistance)
      *(.55+.45*smoothstep(.25,3.5,waterDepth))*specularDepthGate;
    float localSpecScale=mix(1.,.48,smoothstep(.10,.42,length(localWaveSlope)));
    color+=uSunRadiance*toonSpecular*uSetting_specularStrength*wetFade*localSpecScale;
    // Transmission belongs on a thin, steep, backlit crest face. Curvature
    // alone lit the top of the former round mound as a circular bright spot.
    float thinCrest=smoothstep(.012,.095,localWaveHeight)
      *smoothstep(.08,.32,length(localWaveSlope));
    vec3 crestFacing=normalize(vec3(localWaveSlope.x,.12,localWaveSlope.y));
    float transmittedSun=smoothstep(.05,.75,dot(crestFacing,lightA));
    float localSSS=thinCrest*transmittedSun*(1.-smoothstep(.30,.76,reflectionWeight));
    color+=uSunRadiance*vec3(.052,.18,.145)*localSSS*wetFade;
    // Only the advancing, curved lip breaks into small flecks. Using the
    // signed slope keeps the trailing trough clear and avoids a white ring.
    float advancingFace=smoothstep(.04,.25,-dot(localWaveSlope,uInteractionDirection));
    float breakingLip=advancingFace*smoothstep(.016,.065,localWaveHeight)
      *smoothstep(.012,.075,localWaveCurvature)*shoreFade;
    vec2 sprayUV=p*vec2(4.3,6.1)+vec2(uTime*.035,-uTime*.02);
    float sprayGrain=texture2D(uNoise,sprayUV).r;
    float sprayPatch=texture2D(uNoise,p*vec2(1.6,2.1)+vec2(.37,.61)).r;
    float breakingFoam=breakingLip*smoothstep(.43,.72,sprayGrain)
      *smoothstep(.36,.72,sprayPatch)*.58*uInteractionBreak;
    // Keep the signed inward bend: clamping negative slope to zero used to
    // flatten half the liquid lens and removed its sun-facing highlights.
    float meniscusNdotH=max(dot(meniscusNormal,halfDir),0.);
    float lipGlintRise=smoothstep(0.,max(.10,normalizedAA),normalizedContact);
    float glintReach=clamp(uSetting_meniscusGlintReach,.15,.70);
    float lipGlintFall=1.-smoothstep(glintReach*.42,glintReach,normalizedContact);
    float lipGlintProfile=lipGlintRise*lipGlintFall*contactWaterMask;
    float glintAA=max(fwidth(meniscusNdotH)*1.5,.012);
    float broadGlint=smoothstep(.76-glintAA,.96+glintAA,meniscusNdotH);
    float sharpGlint=pow(meniscusNdotH,72.);
    float glintNoise=texture2D(uNoise,p*vec2(2.3,3.7)+vec2(uTime*.026,-uTime*.018)).r;
    float glintFlecks=smoothstep(.57,.81,glintNoise);
    float meniscusCatchlight=lipGlintProfile*(broadGlint*.32+sharpGlint*.78*glintFlecks)
      +meniscusLensProfile*broadGlint*.055;
    float meniscusLightFacing=pow(max(dot(meniscusNormal,lightA),0.),4.)*lipGlintProfile;
    float meniscusInnerShadow=meniscusInnerRidge*(1.-meniscusOuterRidge*.65);
    // Foam and the lens use the same moving front and horizontal metre scale.
    float foamSdf=contactDistance;
    float foamAA=max(fwidth(foamSdf),.008);
    float foamWidth=max(uSetting_foamWidth,.01);
    float foamBand=(1.-smoothstep(foamWidth-foamAA,foamWidth+foamAA,foamSdf))
      *smoothstep(0.,foamAA,foamSdf);
    float foamMask=1.-clamp(foamSdf/foamWidth,0.,1.);
    // Keep texture metric in world metres. SDF only clips the band: dividing
    // its UV by band width previously stretched every cell into shore stripes.
    vec2 foamUV=p*uSetting_foamScale;
    vec2 warp=vec2(texture2D(uNoise,p*.17+vec2(.31,.73)).r,
                   texture2D(uNoise,p*.17+vec2(.81,.13)).r)-.5;
    foamUV+=warp*uSetting_foamWarp;
    // The moving reach is a bounded displacement, so the texture reverses on retreat.
    vec2 foamDrift=shoreFlow*shoreRunupReach(p.x,uTime)*uSetting_foamSpeed*uSetting_foamScale;
    mat2 foamRotation=mat2(.8,.6,-.6,.8);
    float foamNoiseA=texture2D(uNoise,foamUV+foamDrift).r;
    float foamNoiseB=texture2D(uNoise,foamRotation*(foamUV+foamDrift)*1.37+vec2(.37,.19)).r;
    float patches=texture2D(uNoise,(p+foamDrift/max(uSetting_foamScale,.01))*.43).r;
    float foamSignal=mix(foamNoiseA,foamNoiseB,.45)*mix(.65,1.15,patches);
    foamSignal*=smoothstep(0.,.65,foamMask);
    float foamEdge=max(fwidth(foamSignal),uSetting_foamSoftness);
    float foamTexture=smoothstep(uSetting_foamCutoff-foamEdge,uSetting_foamCutoff+foamEdge,foamSignal);
    float foamLife=mix(.20,1.,shoreFoamLife(eventPhase));
    float foam=foamTexture*foamBand*uSetting_shoreFoam*foamLife*(1.-smoothstep(.3,1.2,pixelFootprint));
    vec3 undistortedSource=texture2D(uScene,uv).rgb;
    color=mix(color,vec3(.91,.91,.82),clamp(rings*.12,0.,.34));
    // Only antialias the contact pixel. Water depth already controls physical
    // transmission; a second half-metre colour fade erased the water surface.
    float contactCoverage=waterContactCoverage(contactDistance,fwidth(contactDistance));
    // Apply aerial perspective after every water-lighting contribution.  This
    // is deliberately last: no specular, foam or grading may redraw a seam on
    // top of the atmospheric veil at the horizon.
    // Air transmission shares the adjustable source colour and solar phase.
    vec3 horizonAir=heightAtmosphereRadiance(-view);
    float aerialHaze=heightAtmosphereScatter(distanceToEye,cameraPosition.y,vWorld.y,uHeightFogParams.x,uHeightFogParams.y,uHeightFogWeather);
    color=mix(color,horizonAir,aerialHaze);
    // Composite last: grading and haze must not tint exposed sand at zero depth.
    color=mix(undistortedSource,color,contactCoverage);
    // Curvature already participates in the unified Fresnel. Keep only a
    // restrained rim shade; never mix bare sand or a second sky layer back in.
    float meniscusShade=clamp(meniscusInnerShadow*uSetting_meniscusShadow*uSetting_meniscusStrength,0.,1.);
    color*=1.-meniscusShade*.08;
    float rimLighting=.30+.70*meniscusLightFacing;
    float rimBreakup=mix(.38,1.,smoothstep(.20,.78,breakup));
    float glassRim=(meniscusOuterRidge*(.012+.065*rimLighting)+meniscusInnerRidge*.018)
      *rimBreakup*(1.-aerialHaze);
    vec3 glassRimColor=mix(vec3(.54,.82,.88),uSunRadiance,.62);
    color+=(glassRimColor*glassRim
      +uSunRadiance*meniscusCatchlight*uSetting_meniscusHighlightStrength*.62)*(1.-aerialHaze)*uSetting_meniscusStrength;
    // Foam has independent contact coverage: the sea's depth fade must not erase it.
    vec3 litFoam=uSetting_foamColor*(vec3(.4)+uSunRadiance*.22);
    color=mix(color,mix(litFoam,horizonAir,aerialHaze),clamp(foam,0.,1.));
    color=mix(color,mix(vec3(.73,.90,.86),horizonAir,aerialHaze),breakingFoam*(1.-aerialHaze));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
  material.uniforms.uSky={value:null};
  Object.assign(material.uniforms,lighting);
  const geo=new T.PlaneGeometry(2,2,128,160);
  geo.rotateX(-Math.PI/2);
  const water=new T.Mesh(geo,material);
  water.renderOrder=-1;
  water.frustumCulled=false;
  scene.add(water);
  // The independent radial interaction grid is allocated once and only drawn
  // while the pointer has a valid water hit.
  const rings=32,segments=96,patchPositions=[],patchIndices=[];
  patchPositions.push(0,0,0);
  for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){
   const a=i*Math.PI*2/segments,r=ring/rings*1.10;
   patchPositions.push(Math.cos(a)*r,0,Math.sin(a)*r);
  }
  for(let i=0;i<segments;i++)patchIndices.push(0,1+(i+1)%segments,1+i);
  for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
   const a=1+(ring-1)*segments+i,b=1+(ring-1)*segments+(i+1)%segments;
   const c=a+segments,d=b+segments;
   patchIndices.push(a,b,c,b,d,c);
  }
  const patchGeo=new T.BufferGeometry();patchGeo.setAttribute('position',new T.Float32BufferAttribute(patchPositions,3));patchGeo.setIndex(patchIndices);patchGeo.userData={rings,segments};
  for(const [index,layer] of interactionLayers.entries()){
   const patchMaterial=new T.ShaderMaterial({vertexShader:material.vertexShader,fragmentShader:material.fragmentShader,uniforms:{...material.uniforms,...layer.uniforms,uPatchMode:{value:1}},side:T.DoubleSide,depthTest:true,depthFunc:T.AlwaysDepth,depthWrite:true});
   layer.mesh=new T.Mesh(patchGeo,patchMaterial);
   layer.mesh.visible=false;layer.mesh.renderOrder=-.5+index*.01;layer.mesh.frustumCulled=false;scene.add(layer.mesh);
  }
  function activateInteractionLayer(x,z){
   const layer=interactionLayers[nextLayer++%interactionLayers.length];
   layer.flow.clear();layer.texture.needsUpdate=true;
   layer.center.set(x,z);layer.direction.copy(interactionTargetDirection);
   layer.uniforms.uInteractionStart.value=time.value;
   // A fresh empty field cannot pop; show its first deposited crest at full
   // strength instead of fading in after the cursor has moved on.
   layer.uniforms.uInteractionGain.value=1;
   layer.uniforms.uInteractionBreak.value=1;
   layer.uniforms.uInteractionActive.value=1;
   layer.mesh.visible=true;activeLayer=layer;
   return layer;
  }
  const runupMaterial=new T.ShaderMaterial({
   uniforms:{...settingsUniforms,...atmosphereUniforms,...lighting,uTime:time,uNoise:{value:blueNoise},uSky:material.uniforms.uSky,uWeather:{value:0}},
   transparent:true,depthWrite:false,side:T.DoubleSide,
   vertexShader:`
    varying vec3 vRunupWorld;
    void main(){
     // The same terrain vertices as the receiving sand, with a millimetre bias.
     vec3 p=position;p.y+=.003;
     vRunupWorld=(modelMatrix*vec4(p,1.)).xyz;
     gl_Position=projectionMatrix*viewMatrix*vec4(vRunupWorld,1.);
    }`,
   fragmentShader:`
    uniform float uTime,uWeather;uniform sampler2D uNoise,uSky;varying vec3 vRunupWorld;
    uniform vec3 uSunDirection,uSunRadiance;
    ${shoreGLSL}
    ${skyPanoramaGLSL}
    ${skyRadianceGLSL}
    ${waterOpticsGLSL}
    ${skyReflectionGLSL}
    void main(){
     vec2 p=vRunupWorld.xz;
     float phase=shoreEventPhase(p.x,uTime);
     float footprint=max(length(dFdx(p)),length(dFdy(p)));
     float distanceToSea=shoreRunupDistance(p);
     float behindFront=shoreRunupReach(p.x,uTime)-distanceToSea;
     float coverage=shoreRunupCoverage(p,uTime,footprint);
     // Wetness keeps its broad feather, but the optical sheet needs a tighter
     // leading edge or its 68 cm travel dissolves into one static gradient.
     float visualEdge=max(.17,footprint*1.15);
     float visualCoverage=smoothstep(-.025,visualEdge,behindFront);
     float draining=1.-smoothstep(.50,.94,phase);
     // Cross-fade through the static sea intersection in horizontal shore
     // distance. The old 9 mm height gate made a visible cut across the beach.
     float exposed=smoothstep(-.16,.12,distanceToSea);
     float film=visualCoverage*draining*exposed;
     vec3 n=normalize(cross(dFdx(vRunupWorld),dFdy(vRunupWorld)));
     n*=n.y<0.?-1.:1.;
     vec3 view=normalize(cameraPosition-vRunupWorld);
     vec3 light=uSunDirection;
     // Meniscus is a spatial contact property, not an event-life effect. It
     // remains on the current film edge through advance, hold and retreat.
     float curve=exp(-pow((behindFront-.040)/.060,2.))*visualCoverage;
     float shoreGradient=shoreSlope(p.x);
     // The liquid rises toward dry sand: its outward normal tilts seaward.
     vec3 lipN=normalize(n+normalize(vec3(-shoreGradient,0.,1.))*curve*.52);
     float fresnel=waterReflectionWeight(dot(lipN,view),uSetting_reflectionFresnelMin,uSetting_reflectionFresnelPower,uSetting_reflectionStrength);
     vec3 reflected=reflect(-view,lipN);
     vec3 skyDirection=skyReflectionDirection(reflected);
     vec3 reflection=skyEnvironmentRadiance(skyDirection,skyReflectionSample(uSky,skyDirection),vRunupWorld.y)*waterReflectionGain(uSetting_reflectionStrength);
     float spec=pow(max(dot(lipN,normalize(view+light)),0.),72.);
     float noise=texture2D(uNoise,p*vec2(1.7,3.1)+vec2(uTime*.018,-uTime*.026)).r;
     float alongShore=p.x+shoreGradient*p.y;
     float sectionNoise=texture2D(uNoise,vec2(alongShore*.19+uTime*.006,phase*1.7)).r;
     float flecks=smoothstep(.47,.72,noise)*smoothstep(.28,.66,sectionNoise);
     float foam=curve*flecks*shoreFoamLife(phase)*exposed*uSetting_shoreFoam;
     float reflectionAlpha=0.;
     float bodyAlpha=0.;
     float lipLight=pow(max(dot(lipN,normalize(view+light)),0.),36.)*curve*exposed;
     float highlightAlpha=lipLight*flecks*uSetting_shoreLip;
     float frontAlpha=0.;
     float lensAlpha=0.;
     float alpha=bodyAlpha+reflectionAlpha+foam+highlightAlpha+frontAlpha+lensAlpha;
     if(alpha<.001)discard;
     vec3 sheetColor=mix(vec3(.10,.34,.44),reflection,.32+.38*fresnel);
     vec3 col=(sheetColor*bodyAlpha+reflection*reflectionAlpha+vec3(.96,.92,.80)*foam+uSunRadiance*highlightAlpha+vec3(.72,.88,.90)*frontAlpha+mix(sheetColor,reflection,.72)*lensAlpha)/max(alpha,.001);
     col=heightAtmosphereComposite(col,vRunupWorld-cameraPosition,cameraPosition.y,vRunupWorld.y);
     gl_FragColor=vec4(col,alpha*(1.-uWeather*.20));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
  });
  // Legacy sand overlay stays disabled; displaced sea now owns the moving contact.
  const runupGeo=coastGeometry(false,{shoreMin:-1,shoreMax:.25}),runup=new T.Mesh(runupGeo,runupMaterial);runup.visible=false;runup.renderOrder=3;runup.userData.excludeFromRefraction=true;scene.add(runup);
 function resize(w,h){const dpr=Math.min(devicePixelRatio,1.5),rw=Math.min(1600,Math.floor(w*dpr));captureTarget.setSize(rw,Math.max(1,Math.floor(rw*h/w)));}
 function capture(camera,focus){
  const focusX=focus?.x??camera.position.x,focusZ=focus?.z??camera.position.z;
  material.uniforms.uGridCenter.value.set(focusX,Math.max(0,focusZ-shore(focusX)));
  const target=renderer.getRenderTarget(),tone=renderer.toneMapping,xr=renderer.xr.enabled;
  material.uniforms.uNear.value=camera.near;material.uniforms.uFar.value=camera.far;
  material.uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
  material.uniforms.uInvView.value.copy(camera.matrixWorld);
  material.uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  water.visible=false;for(const layer of interactionLayers)layer.mesh.visible=false;
  renderer.toneMapping=T.NoToneMapping;renderer.xr.enabled=false;
  const excluded=[];
  scene.traverse(o=>{if(o.visible&&o.userData.excludeFromRefraction){excluded.push(o);o.visible=false;}});
  try{renderer.setRenderTarget(captureTarget);renderer.clear();renderer.render(scene,camera);}
  finally{for(const o of excluded)o.visible=true;renderer.setRenderTarget(target);renderer.toneMapping=tone;renderer.xr.enabled=xr;water.visible=true;for(const layer of interactionLayers)layer.mesh.visible=layer.uniforms.uInteractionActive.value>.5;}
 }
  return {mesh:water,patch:interactionLayers[0].mesh,runup,material,runupMaterial,resize,capture,setNormalPreset,setNormalTexture,
   beginInteraction(){interactionTarget=1;interactionHasHeading=false;interactionNeedsAnchor=false;interactionLastDeposit.copy(interactionTargetCenter);activateInteractionLayer(interactionTargetCenter.x,interactionTargetCenter.y);},
   setInteraction(x,z,dx=0,dz=0,speed=0){
    if(!Number.isFinite(x)||!Number.isFinite(z)){interactionTarget=0;return;}
    interactionTargetCenter.set(x,z);
    if(interactionNeedsAnchor){interactionLastDeposit.set(x,z);interactionNeedsAnchor=false;}
    // Accumulate tiny pointer events instead of dropping every sub-threshold
    // displacement. The next stamp covers the complete path since the last one.
    const strokeX=x-interactionLastDeposit.x,strokeZ=z-interactionLastDeposit.y;
    const distance=Math.hypot(strokeX,strokeZ);
    // A pointer that briefly leaves the sea may resume the same gesture.
    if(activeLayer)interactionTarget=1;
    if(interactionTarget&&activeLayer&&distance>.006){
     const radius=interactionRadius.value;
     const {samples,dirX,dirZ,step}=sampleInteractionStroke(x,z,strokeX,strokeZ,radius);
     interactionTargetDirection.set(dirX,dirZ);
     if(!interactionHasHeading){activeLayer.direction.copy(interactionTargetDirection);interactionHasHeading=true;}
     const drive=interactionDriveFromSpeed(Math.min(60,speed));
     for(const point of samples){
      if(activeLayer.center.distanceToSquared(point)>Math.pow(radius*.48,2))activateInteractionLayer(point.x,point.z);
      activeLayer.flow.inject((point.x-activeLayer.center.x)/radius,(point.z-activeLayer.center.y)/radius,
       dirX,dirZ,step/5,drive);
     }
     interactionLastDeposit.set(x,z);
    }
   },
   releaseInteraction(){interactionTarget=0;interactionNeedsAnchor=true;},
   updateInteraction(dt){
    for(const layer of interactionLayers){
     const {flow,texture,center,direction,uniforms}=layer;
     const target=interactionTarget&&layer===activeLayer?1:0;
     const gain=uniforms.uInteractionGain;
     if(target){
      const currentAngle=Math.atan2(direction.y,direction.x);
      const targetAngle=Math.atan2(interactionTargetDirection.y,interactionTargetDirection.x);
      const angleDelta=Math.atan2(Math.sin(targetAngle-currentAngle),Math.cos(targetAngle-currentAngle));
      const turn=T.MathUtils.clamp(angleDelta*(1-Math.exp(-dt*7)),-dt*4.5,dt*4.5);
      direction.set(Math.cos(currentAngle+turn),Math.sin(currentAngle+turn));
     }
     // An older patch still contains an outbound wave after the cursor has
     // entered a new patch. Let the solver's damping carry that wave through.
     gain.value+=(target-gain.value)*(1-Math.exp(-dt*(target?12:.45)));
     const breaking=uniforms.uInteractionBreak;
     breaking.value+=(target-breaking.value)*(1-Math.exp(-dt*(target?14:9)));
     if(uniforms.uInteractionActive.value<.5)continue;
     const steps=Math.max(1,Math.ceil(dt/.012)),step=dt/steps;
     for(let i=0;i<steps;i++)flow.step(step);
     flow.writePixels();texture.needsUpdate=true;
     if(!target&&gain.value<.012){gain.value=0;uniforms.uInteractionActive.value=0;layer.mesh.visible=false;}
    }
   },
   setInteractionRadius(value){interactionRadius.value=T.MathUtils.clamp(Number(value)||2.2,.7,4);},
   splash(x,z,strength=.6){events[cursor++%events.length].set(x,z,time.value,strength)},setWeather(id){const v=id==='rain'?1:id==='mist'?.25:0;material.uniforms.uWeather.value=v;runupMaterial.uniforms.uWeather.value=v},dispose(){for(const t of customNormals.values())if(t!==waterNormal07)t.dispose();geo.dispose();patchGeo.dispose();runupGeo.dispose();material.dispose();for(const layer of interactionLayers){layer.mesh.material.dispose();layer.texture.dispose();}runupMaterial.dispose();captureTarget.dispose();waterNormal07.dispose();waterNormal03.dispose();waterNormal06.dispose();originalNormalA.dispose();originalNormalB.dispose();blueNoise.dispose();for(const texture of comparisonNormals.values())texture.then(t=>t.dispose(),()=>{})}};
}

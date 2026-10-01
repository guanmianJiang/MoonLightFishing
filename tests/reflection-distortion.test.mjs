import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {waterOpticsGLSL} from '../src/water-optics.mjs';
import {reflectionDefaults,applyReflectionSettings} from '../src/reflection-settings.mjs';
import {defaultRenderSettings,settingsUniforms} from '../src/render-settings.js';
import {validDefaults} from '../vite.config.js';
const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
const retired=['reflectionWaveStrength','reflectionNormalStrength','reflectionFarRetention'];

// Execute the actual vector expressions extracted from the shader, using Three
// for the vector operations. This validates wiring without a GPU or UI session.
function shaderVector(name,values){
 const expression=water.match(new RegExp(`vec3 ${name}=([^;]+);`))?.[1];
 assert.ok(expression,`Missing shader vector ${name}`);
 const scope={vec3:(x,y,z)=>new Vector3(x,y,z),normalize:v=>v.clone().normalize(),mix:(a,b,t)=>a.clone().lerp(b,t),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),...values};
 return new Function(...Object.keys(scope),`return ${expression};`)(...Object.values(scope));
}
function reflectionNormal(macroSlope,detailSlope,weight=0){
 const normal=shaderVector('normal',{macroSlope,detailSlope});
 return {normal,reflected:shaderVector('reflectionNormal',{normal,meniscusNormal:new Vector3(.3,1,-.2).normalize(),meniscusLensProfile:weight,uSetting_meniscusStrength:1})};
}

test('reflection uses actual composed water normal and responds directly to normal-map slopes',()=>{
 const incident=new Vector3(.2,-.3,-1).normalize();
 for(const macroSlope of [{x:0,y:0},{x:.03,y:-.08}]){
  const flatDetail=reflectionNormal(macroSlope,{x:0,y:0});
  assert.ok(flatDetail.reflected.distanceTo(flatDetail.normal)<1e-12);
  for(const detailSlope of [{x:.15,y:.06},{x:-.3,y:.08}]){
   const result=reflectionNormal(macroSlope,detailSlope);
   assert.ok(result.reflected.distanceTo(result.normal)<1e-12);
   assert.ok(incident.clone().reflect(result.reflected).distanceTo(incident.clone().reflect(flatDetail.reflected))>.01);
   assert.ok(Math.abs(result.reflected.length()-1)<1e-12);
  }
 }
 assert.ok(water.includes('dot(reflectionNormal,view)'));assert.ok(water.includes('reflect(-view,reflectionNormal)'));
 assert.doesNotMatch(waterOpticsGLSL,/waterReflectionSlope|waterReflectionDistanceScale/);
 for(const key of retired)assert.ok(!water.includes('uSetting_'+key));
});

test('shore curve remains normalized at zero/full/intermediate weights and mirror obeys equal angles',()=>{
 const meniscus=new Vector3(.3,1,-.2).normalize();
 for(const weight of [-1,0,.5,1,2]){
  const {normal,reflected}=reflectionNormal({x:.03,y:-.08},{x:.15,y:.06},weight);
  assert.ok(Math.abs(reflected.length()-1)<1e-12);
  if(weight<=0)assert.ok(reflected.distanceTo(normal)<1e-12);
  if(weight>=1)assert.ok(reflected.distanceTo(meniscus)<1e-12);
  for(const y of [-1,-.02,.1]){
   const incident=new Vector3(.2,y,-1).normalize(),ray=incident.clone().reflect(reflected);
   assert.ok(Math.abs(ray.length()-1)<1e-12);
   assert.ok(Math.abs(ray.dot(reflected)+incident.dot(reflected))<1e-12);
   assert.ok(ray.clone().sub(incident).cross(reflected).length()<1e-12);
  }
 }
});

test('capture reuses original main camera without a planar reflection camera',()=>{
 const capture=water.slice(water.indexOf('function capture(camera,focus)'),water.indexOf('return {mesh:water'));
 assert.ok(capture.includes('renderer.render(scene,camera)'));
 assert.ok(capture.includes('camera.projectionMatrix'));assert.ok(capture.includes('camera.matrixWorldInverse'));
 assert.doesNotMatch(water,/new T\.(?:PerspectiveCamera|OrthographicCamera)|Reflector|virtualCamera|mirrorCamera|oblique/i);
 assert.ok(water.includes('localEnvironmentReflection(vWorld,reflectedDir)'));
 assert.ok(water.includes('skyReflectionSample(uSky,skyDirection)'));
});

test('retired reflection normal overrides do not become settings or uniforms or published fields',()=>{
 const settings=applyReflectionSettings({...reflectionDefaults},{reflectionStrength:.69,reflectionSceneStrength:.3,...Object.fromEntries(retired.map(key=>[key,.15]))});
 assert.equal(settings.reflectionStrength,.69);assert.equal(settings.reflectionSceneStrength,.3);
 for(const key of retired){
  assert.equal(Object.hasOwn(settings,key),false);assert.equal(Object.hasOwn(defaultRenderSettings,key),false);
  assert.equal(settingsUniforms['uSetting_'+key],undefined);assert.equal(validDefaults({...defaultRenderSettings,[key]:.15}),false);
 }
 assert.ok(validDefaults(defaultRenderSettings));
});

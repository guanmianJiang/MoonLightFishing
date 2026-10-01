import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {heightAtmosphereGLSL,heightAtmosphereRadianceGLSL,createHeightAtmosphere,patchHeightAtmosphereShader,atmosphereColorLinear} from '../src/height-atmosphere.mjs';
import {skyRadianceGLSL} from '../src/sky-settings.mjs';
import {atmosphereDefaults} from '../src/atmosphere-settings.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const mean=glslScalar(heightAtmosphereGLSL,'heightAtmosphereMean',['startHeight','endHeight','layerHeight']);
const scatter=glslScalar(heightAtmosphereGLSL,'heightAtmosphereScatter',['rayLength','startHeight','endHeight','layerHeight','strength','weatherScale'],{heightAtmosphereMean:mean});
const rayleigh=glslScalar(heightAtmosphereGLSL,'heightRayleighPhase',['cosine']);
const mie=glslScalar(heightAtmosphereGLSL,'heightMiePhase',['cosine']);

test('height density integral agrees with numerical air-layer integration in both directions',()=>{
 for(const [a,b,h] of [[.14,.14,12],[2,3,12],[2,100,12],[100,2,12],[80,120,12],[0,0,1],[.14,2000,120],[-2,40,12],[40,-2,12],[-100,100,12]]){
  let numerical=0;const samples=20000;
  for(let i=0;i<samples;i++)numerical+=Math.exp(-Math.max(a+(b-a)*(i+.5)/samples-.14,0)/h)/samples;
  assert.ok(Math.abs(mean(a,b,h)-numerical)<1e-7,`${a} to ${b} / ${h}`);
  assert.ok(Math.abs(mean(a,b,h)-mean(b,a,h))<1e-12);
 }
});

test('equal distance is not equal haze: both observer altitude and target altitude matter',()=>{
 const low=scatter(800,2,2,12,.45,1),high=scatter(800,82,82,12,.45,1),up=scatter(800,2,100,12,.45,1);
 assert.ok(low>.16);assert.ok(high<low*.002);assert.ok(up<low*.2);
 assert.ok(scatter(800,2,2,1,.45,1)<scatter(800,2,2,40,.45,1));
});

test('sky paths leave the dense layer when looking up; raising layer height broadens the horizon band',()=>{
 const sky=(sine,h=12,origin=2)=>scatter(12000,origin,origin+Math.abs(sine)*12000,h,.45,1);
 assert.ok(sky(0)>.9);assert.ok(sky(.1)<.04);assert.ok(sky(1)<.004);
 assert.ok(sky(.03,40)>sky(.03,4)*8);
 assert.ok(sky(0,12,100)<sky(0)*.002);
 for(let y=0;y<1;y+=.01)assert.ok(sky(y)>=sky(y+.01));
});

test('nearly horizontal, below-sea, short and extreme paths stay finite, continuous and genuinely off',()=>{
 for(const height of [1,12,120])for(const start of [-100,.14,2,100,10000])for(const delta of [-.00001,0,.00001,1,200]){
  const density=mean(start,start+delta,height);assert.ok(Number.isFinite(density)&&density>=0&&density<=1);
  const weight=scatter(12000,start,start+delta,height,2,1.45);assert.ok(Number.isFinite(weight)&&weight>=0&&weight<=.985);
 }
 assert.equal(mean(-100,-20,12),1);
 for(const length of [-1,0,100,1e10,Infinity])assert.equal(scatter(length,2,0,12,0,1.45),0);
 assert.equal(scatter(-50,2,2,12,.45,1),0);
 assert.equal(scatter(Infinity,2,2,12,.45,1),scatter(12000,2,2,12,.45,1));
 assert.ok(Math.abs(mean(2,2,12)-mean(2,2.00001,12))<1e-6);
 assert.ok(Math.abs(mean(2,2.011999,12)-mean(2,2.012001,12))<1e-7);
});

test('single-scattering phase is bounded, uses the real sun and never injects an unbounded white boost',()=>{
 assert.equal(rayleigh(0),.75);assert.equal(rayleigh(1),1.5);assert.equal(rayleigh(-1),1.5);
 assert.ok(Math.abs(mie(1)-1)<1e-12);assert.ok(mie(-1)<.01);
 for(let mu=-1;mu<=1;mu+=.01){assert.ok(rayleigh(mu)>=.75&&rayleigh(mu)<=1.5);assert.ok(mie(mu)>0&&mie(mu)<=1.000001)}
 assert.match(heightAtmosphereRadianceGLSL,/uHeightFogSunDirection/);
 assert.match(heightAtmosphereRadianceGLSL,/heightAtmosphereChannel\(uHeightFogColor.r,uHeightFogSunRadiance.r/);
 assert.doesNotMatch(heightAtmosphereRadianceGLSL,/sunTint|SunRadiance\/energy|vec3\(\.1812/);
});

const makeShader=()=>({uniforms:{},vertexShader:'#include <fog_pars_vertex>\nvoid main(){vec4 mvPosition=vec4(0.);#include <fog_vertex>}',fragmentShader:'#include <fog_pars_fragment>\nvoid main(){gl_FragColor=vec4(1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>\n}'});
const rootOf=materials=>({traverseVisible(fn){for(const material of materials)fn({material})}});

test('material patch uses animated world positions and composes before tone mapping without global shader edits',()=>{
 const shader=makeShader();assert.equal(patchHeightAtmosphereShader(shader),true);
 assert.match(shader.vertexShader,/uHeightFogCameraWorld\*mvPosition/);
 assert.doesNotMatch(shader.fragmentShader,/#include <fog_fragment>|vFogDepth/);
 assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb=heightAtmosphereComposite')<shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
 const once=structuredClone(shader);assert.equal(patchHeightAtmosphereShader(shader),false);assert.deepEqual(shader,once);
});

test('installation preserves previous hooks and cache keys, finds late materials, skips opted-out shaders and restores on disposal',()=>{
 let originalCalls=0;
 const previous=function(shader){originalCalls++;assert.equal(this,material);shader.uniforms.original={value:7};};
 const cache=()=> 'animated-fabric';const material={onBeforeCompile:previous,customProgramCacheKey:cache,fog:true};
 const lighting={uSunDirection:{value:[1,1,0]},uSunRadiance:{value:[2,1,1]}};
 const camera={matrixWorld:{id:'camera-matrix'}};
 const atmosphere=createHeightAtmosphere({...atmosphereDefaults},lighting,camera),excluded={fog:false},shaderMaterial={isShaderMaterial:true};
 atmosphere.install(rootOf([material,excluded,shaderMaterial]));const wrapper=material.onBeforeCompile;
 atmosphere.install(rootOf([material]));assert.equal(material.onBeforeCompile,wrapper);
 assert.equal(excluded.onBeforeCompile,undefined);assert.equal(shaderMaterial.onBeforeCompile,undefined);
 const shader=makeShader();material.onBeforeCompile(shader);assert.equal(originalCalls,1);assert.equal(shader.uniforms.original.value,7);
 assert.equal(shader.uniforms.uHeightFogSunDirection,lighting.uSunDirection);assert.equal(shader.uniforms.uHeightFogCameraWorld.value,camera.matrixWorld);
 assert.equal(material.customProgramCacheKey(),'animated-fabric|height-atmosphere-v1');
 const late={fog:true,onBeforeCompile(){},customProgramCacheKey(){return 'fish'}};atmosphere.install(rootOf([late]));assert.equal(late.customProgramCacheKey(),'fish|height-atmosphere-v1');
 atmosphere.dispose();assert.equal(material.onBeforeCompile,previous);assert.equal(material.customProgramCacheKey,cache);assert.equal(late.customProgramCacheKey(),'fish');
});

test('height parameters and weather update without recompiling, and underwater capture suppresses double air transmission',()=>{
 const settings={...atmosphereDefaults},system=createHeightAtmosphere(settings,{uSunDirection:{value:[]},uSunRadiance:{value:[]}}, {matrixWorld:{}});
 const buffer=system.uniforms.uHeightFogParams.value;assert.equal(buffer[0],12);assert.ok(Math.abs(buffer[1]-.45)<1e-6);
 settings.atmosphereHeight=40;settings.atmosphereStrength=0;assert.equal(system.uniforms.uHeightFogParams.value,buffer);assert.equal(buffer[0],40);assert.equal(buffer[1],0);
 system.setWeather('mist');assert.equal(system.uniforms.uHeightFogWeather.value,1.45);
 system.beginCapture();assert.equal(system.uniforms.uHeightFogCapture.value,1);system.endCapture();assert.equal(system.uniforms.uHeightFogCapture.value,0);
 assert.match(heightAtmosphereRadianceGLSL,/uHeightFogCapture>\.5&&targetHeight<\.14\)amount=0\./);
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');assert.match(scene,/atmosphere.beginCapture\(\);try\{waterSystem.capture\(camera\);\}finally\{atmosphere.endCapture\(\)\}/);
});

test('dome, reflected environment and observer-to-water rays share height density but use the right origins',()=>{
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 assert.ok(skyRadianceGLSL.includes(heightAtmosphereGLSL));assert.ok(skyRadianceGLSL.includes(heightAtmosphereRadianceGLSL));
 assert.match(scene,/skyEnvironmentRadiance\(d,texture2D\(uSky,uv\)\.rgb,cameraPosition.y\)/);
 assert.ok(scene.includes('vDir=(modelMatrix*vec4(position,1.)).xyz-cameraPosition'));
 assert.ok(scene.includes('new T.PerspectiveCamera(36,1,.1,16000)'));
 assert.match(water,/skyEnvironmentRadiance\(skyDirection,skyReflectionSample\(uSky,skyDirection\),vWorld.y\)/);
 assert.match(water,/skyEnvironmentRadiance\(skyDirection,skyReflectionSample\(uSky,skyDirection\),vRunupWorld.y\)/);
 assert.match(water,/heightAtmosphereScatter\(distanceToEye,cameraPosition.y,vWorld.y/);
 assert.doesNotMatch(scene+water,/FogExp2|waterAerialHaze|uSetting_waterFogDensity|uSetting_skyFogStrength/);
});

test('air colour is linear once, adjustable live, and the forward source retains solar energy',()=>{
 const channel=glslScalar(heightAtmosphereGLSL,'heightAtmosphereChannel',['base','sun','rayleighPhase','miePhase','sunStrength']);
 assert.deepEqual(atmosphereColorLinear('#000000'),[0,0,0]);assert.deepEqual(atmosphereColorLinear('#ffffff'),[1,1,1]);
 assert.ok(Math.abs(atmosphereColorLinear('#808080')[0]-.2158605)<1e-7);
 for(const invalid of [undefined,null,'#bad','cyan','#gg0000'])assert.deepEqual(atmosphereColorLinear(invalid),atmosphereColorLinear('#9fb9d3'));
 const cold=atmosphereColorLinear('#9fb9d3');assert.ok(cold[2]>cold[1]&&cold[1]>cold[0]);
 for(const base of [0,.4,1])for(const mu of [-1,0,1]){
  const ambient=channel(base,0,rayleigh(mu),mie(mu),.15);
  assert.equal(channel(base,2.65,rayleigh(mu),mie(mu),0),ambient);
  const bright=channel(base,2.65,rayleigh(mu),mie(mu),.15),rain=channel(base,1.45,rayleigh(mu),mie(mu),.15);
  assert.ok(bright>=rain&&rain>=ambient);assert.ok(bright<=1.1227);
  assert.ok(Math.abs((bright-ambient)/(rain-ambient)-2.65/1.45)<1e-10);
 }
 assert.ok(channel(.4,2.65,rayleigh(1),mie(1),.15)>channel(.4,2.65,rayleigh(-1),mie(-1),.15));
 const settings={...atmosphereDefaults,atmosphereColor:'#9fb9d3'},system=createHeightAtmosphere(settings,{uSunDirection:{value:[]},uSunRadiance:{value:[]}}, {matrixWorld:{}});
 const buffer=system.uniforms.uHeightFogColor.value;settings.atmosphereColor='#ff0000';assert.equal(system.uniforms.uHeightFogColor.value,buffer);assert.deepEqual([...buffer],[1,0,0]);
});

test('reviewed published strength preserves horizon texture while the prior strength saturates it',()=>{
 const old=scatter(12000,2,2,22,1.35,1),now=scatter(12000,2,2,22,.15,1);
 assert.equal(old,.985);assert.ok(now>.62&&now<.64);assert.ok(1-now>.36);
 assert.ok(scatter(800,2,.14,22,.15,1)<.07);
});

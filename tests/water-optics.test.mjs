import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {waterOpticsGLSL} from '../src/water-optics.mjs';
import {skyRadianceGLSL} from '../src/sky-settings.mjs';
import {defaultRenderSettings,settingsUniforms} from '../src/render-settings.js';
import publishedDefaults from '../src/render-defaults.js';
import {validReflectionSetting} from '../src/reflection-settings.mjs';

// Execute the actual scalar shader helpers, rather than a second CPU formula.
function scalar(name,args){
 const start=waterOpticsGLSL.indexOf(`float ${name}(`),open=waterOpticsGLSL.indexOf('{',start),end=waterOpticsGLSL.indexOf('}',open);
 assert.ok(start>=0&&open>start&&end>open);
 const body=waterOpticsGLSL.slice(open+1,end).replace(/\bfloat\b/g,'let');
 return new Function(...args,`const {sqrt,abs,min,max,pow,exp}=Math;const clamp=(x,a,b)=>max(a,min(b,x));const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};${body}`);
}
const path=scalar('waterOpticalPath',['depth','airCosine']);
const radiance=scalar('waterChannelRadiance',['source','body','absorption','scattering','viewPath','sunPath']);
const reflection=scalar('waterReflectionWeight',['cosine','base','power','strength']);
const hit=scalar('waterReflectionHit',['edge','height','error','travel']);
test('water air transmission uses actual height endpoints and has no depth-only haze or forced desaturation',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 assert.ok(water.includes('heightAtmosphereScatter(distanceToEye,cameraPosition.y,vWorld.y,uHeightFogParams.x,uHeightFogParams.y,uHeightFogWeather)'));
 assert.doesNotMatch(water,/waterAerialHaze|distanceHaze|grazingHaze|aerialHaze\*\.14/);
 assert.ok(water.includes('heightAtmosphereRadiance(-view)'));
 assert.ok(water.includes('color=mix(color,horizonAir,aerialHaze)'));
});

test('refracted paths stay continuous, bounded and monotonic at grazing and deep water',()=>{
 assert.equal(path(0,0),0);assert.equal(path(-1,.4),0);assert.equal(path(1,1),1);assert.equal(path(100,0),24);
 for(let cosine=0;cosine<=1;cosine+=.001){
  const p=path(1,cosine);assert.ok(p>=1&&p<1.514);
  assert.ok(p>=path(1,cosine+.001));assert.ok(Math.abs(p-path(1,cosine+.00001))<.00002);
  assert.equal(path(1,-cosine),p);
 }
 for(let depth=0;depth<=30;depth+=.05)assert.ok(path(depth,.4)<=path(depth+.05,.4));
});
test('two transport legs preserve a clear film and preferentially attenuate red light',()=>{
 assert.equal(radiance(.8,.4,.3,.1,0,0),.8);
 assert.ok(radiance(.8,.4,.3,.1,.02,.02)>.78);
 const red=radiance(1,0,.28*1.36,.035,path(2,.4),path(2,.6));
 const blue=radiance(1,0,.025*1.36,.1,path(2,.4),path(2,.6));
 assert.ok(blue>red*2);
 assert.ok(radiance(.8,.4,.3,.1,2,0)>radiance(.8,.4,.3,.1,2,2));
 assert.ok(radiance(.8,.4,.3,.1,2,path(2,.9))>radiance(.8,.4,.3,.1,2,path(2,.1)));
});
test('zero absorption retains scattering and same-colour objects respond across the slider',()=>{
 assert.ok(radiance(0,.5,0,.1,2,2)>0);
 for(const depth of [.02,.3,1,3,12,24])for(const [a,s] of [[.28,.035],[.065,.085],[.025,.10]]){
  const values=[0,1.36,3,10].map(strength=>radiance(.5,.5,a*strength,s,path(depth,.3),path(depth,.6)));
  assert.ok(values.every(v=>Number.isFinite(v)&&v>=0&&v<=.5));
  for(let i=1;i<values.length;i++)assert.ok(values[i]<values[i-1]);
 }
 assert.ok(Number.isFinite(radiance(.5,.5,0,0,24,24)));
});
test('reflection has water Fresnel at normal view and becomes dominant at grazing',()=>{
 assert.equal(reflection(1,0,5,1),.0204);
 assert.ok(reflection(.4,0,5,1)>.09);
 assert.ok(reflection(.15,0,5,1)>.45);
 assert.equal(reflection(0,0,5,1),1);
 assert.equal(reflection(-.001,0,5,1),1);
 assert.equal(reflection(-.4,0,5,1),1);
 assert.equal(reflection(-.4,0,5,0),0);
 assert.equal(reflection(.1,0,5,0),0);
 assert.equal(reflection(.1,0,5,-1),0);
 assert.equal(reflection(.1,2,.1,2),1);
 let previous=0;
 for(let i=100;i>=0;i--){const r=reflection(i/100,0,5,1);assert.ok(r>=previous);previous=r;}
});
test('local reflection rejects submerged receivers, screen edges and false depth intersections',()=>{
 assert.equal(hit(.4,-.1,0,1),0);assert.equal(hit(.4,0,0,1),0);assert.equal(hit(0,1,0,1),0);
 assert.equal(hit(.4,1,2,1),0);assert.equal(hit(.4,1,0,1),1);
 assert.ok(hit(.05,1,0,1)>0&&hit(.05,1,0,1)<1);
 assert.ok(hit(.4,.06,0,1)>0&&hit(.4,.06,0,1)<1);
});
test('reflection reuses capture, keeps its bounded trace and shares sky radiance',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 assert.equal(water.match(/new T.WebGLRenderTarget/g).length,1);
 assert.ok(water.includes('for(int i=0;i<12;i++)'));assert.ok(water.includes('for(int j=0;j<3;j++)'));
 assert.ok(water.includes('uSetting_reflectionSceneStrength<=0.'));
 assert.ok(water.includes('material.uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)'));
 assert.equal(water.split('${skyRadianceGLSL}').length-1,2);
 assert.ok(scene.includes('${skyRadianceGLSL}'));
 assert.ok(skyRadianceGLSL.includes('heightAtmosphereMean'));
 assert.ok(!water.includes('vec3(.74,.94,1.12)'));
 assert.ok(water.includes('waterReflectionWeight(reflectionNdotV'));
 assert.ok(water.includes('color=mix(color,reflectedSky,reflectionWeight);'));
 assert.ok(!water.includes('liquidSheen'));
 assert.ok(validReflectionSetting('reflectionSceneStrength',defaultRenderSettings.reflectionSceneStrength));
 assert.equal(defaultRenderSettings.reflectionSceneStrength,publishedDefaults.reflectionSceneStrength);
 assert.equal(settingsUniforms.uSetting_reflectionSceneStrength.value,defaultRenderSettings.reflectionSceneStrength);
});

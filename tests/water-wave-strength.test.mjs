import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {waterSurfaceGLSL,waterWaveFields,waterWaveDefaults,applyWaterWaveSettings,validWaterWaveSetting} from '../src/water-surface.js';
import {renderSettings,defaultRenderSettings,settingsUniforms,settingsGLSL} from '../src/render-settings.js';
import {lookControlHints,clearWaterWaves,restoreLookGroup} from '../src/render-look-controls.mjs';
import {validDefaults} from '../vite.config.js';

const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a*(1-t)+b*t;
const scaleExpression=waterSurfaceGLSL.match(/w\*=([^;]*uSetting_waterWaveStrength[^;]*);/)[1];
const scale=new Function('uSetting_waterWaveStrength','clamp',`return ${scaleExpression};`);
const waveBody=waterSurfaceGLSL.match(/vec3 waveSample\([^]*?\{([^]*?)\}/)[1];
const phaseExpression=waveBody.match(/float a=([^;]+);/)[1];
const [,slopeExpression,heightExpression]=waveBody.match(/return vec3\(k\*([^,]+),([^;]+)\);/);
const wave=new Function('p','k','speed','phase','amplitude','t',`const {sin,cos}=Math;const dot=(p,k)=>p.x*k.x+p.y*k.y;const a=${phaseExpression};return {height:${heightExpression},x:k.x*(${slopeExpression}),y:k.y*(${slopeExpression})};`);

test('actual wave height and gradient share a multiplier and remain derivatives at 0/0.35/1/2',()=>{
 for(const strength of [0,.35,1,2])for(const k of [{x:.31,y:.14},{x:1.12,y:-.72}])for(const t of [0,3,12]){
  const gain=scale(strength,clamp),p={x:12.4,y:38.2},base=wave(p,k,.48,1.7,.078,t);
  for(const axis of ['x','y']){
   const h=1e-4,left=wave({...p,[axis]:p[axis]-h},k,.48,1.7,.078,t).height*gain;
   const right=wave({...p,[axis]:p[axis]+h},k,.48,1.7,.078,t).height*gain;
   assert.ok(Math.abs((right-left)/(2*h)-base[axis]*gain)<1e-8);
  }
  if(strength===0)assert.ok(base.height*gain===0);
  if(strength===1)assert.equal(base.height*gain,base.height);
 }
 assert.equal(scale(-1,clamp),0);assert.equal(scale(3,clamp),2);
 const index=waterSurfaceGLSL.indexOf('w*=clamp(uSetting_waterWaveStrength,0.,2.)');
 assert.ok(index>waterSurfaceGLSL.indexOf('w.z+=.014*sin(a)*e;'));
 assert.ok(index<waterSurfaceGLSL.indexOf('w.z+=shoreWaterHeight(p,t);'));
 assert.ok(index<waterSurfaceGLSL.indexOf('w.xy+=vec2(shoreWaterHeight'));
});

test('normal-map detail uses UV footprint sampling without a separate world-distance cutoff',()=>{
 const expression=water.match(/vec2 detailSlope=([^;]+);/)[1];
 assert.doesNotMatch(expression,/detailFade|bodyDetailFade|distanceToEye|pixelFootprint|grazing/);
 for(const layer of ['A','B'])assert.ok(water.includes(`texture2DGradEXT(uNormal${layer},uv${layer},dFdx(uv${layer}),dFdy(uv${layer}))`));
 assert.ok(water.includes('distanceToEye=length(cameraPosition-vWorld)'));
 assert.ok(water.includes('heightAtmosphereScatter(distanceToEye,'));
});

test('wave field bounds are shared by import/defaults/publishing and preserve other tuning',()=>{
 assert.deepEqual(waterWaveFields[0],['waterWaveStrength','海面波浪强度',0,2,.01,.35]);
 const target={...waterWaveDefaults,reflectionStrength:.69,normalStrengthA:1.67};
 for(const value of [null,undefined,'0',NaN,Infinity]){applyWaterWaveSettings(target,{waterWaveStrength:value});assert.equal(target.waterWaveStrength,.35);}
 for(const [value,expected] of [[-1,0],[3,2],[1.2,1.2]]){applyWaterWaveSettings(target,{waterWaveStrength:value});assert.equal(target.waterWaveStrength,expected);}
 assert.equal(target.reflectionStrength,.69);assert.equal(target.normalStrengthA,1.67);
 for(const value of [0,.35,1,2])assert.ok(validWaterWaveSetting('waterWaveStrength',value)&&validDefaults({...defaultRenderSettings,waterWaveStrength:value}));
 for(const value of [-.01,2.01,null,'1',NaN,Infinity])assert.equal(validDefaults({...defaultRenderSettings,waterWaveStrength:value}),false);
 assert.equal(defaultRenderSettings.waterWaveStrength,.35);
 assert.equal(JSON.parse(JSON.stringify(target)).waterWaveStrength,1.2);
});

test('close/reset only wave control and immediately update shared dynamic uniform',()=>{
 const before=structuredClone(renderSettings);
 try{
  clearWaterWaves(renderSettings);assert.equal(settingsUniforms.uSetting_waterWaveStrength.value,0);
  assert.deepEqual({...renderSettings,waterWaveStrength:before.waterWaveStrength},before);
  restoreLookGroup(renderSettings,{waterWaveStrength:.61},'海面波浪');assert.equal(settingsUniforms.uSetting_waterWaveStrength.value,.61);
  restoreLookGroup(renderSettings,{},'海面波浪');assert.equal(settingsUniforms.uSetting_waterWaveStrength.value,.35);
  restoreLookGroup(renderSettings,{waterWaveStrength:4},'海面波浪');assert.equal(settingsUniforms.uSetting_waterWaveStrength.value,2);
 }finally{Object.assign(renderSettings,before);}
});

test('sea vertex/fragment and flooded sand use the same wave function and uniform; panel is touch accessible',()=>{
 assert.ok(settingsGLSL.includes('uniform float uSetting_waterWaveStrength;'));
 assert.ok(water.includes('p.y+=waterLevel+waterSurface(p.xz,uTime).z+lift;'));
 assert.ok(water.includes('vec2 macroSlope=waterSurface(p,uTime).xy;'));
 assert.ok(scene.includes('Object.assign(s.uniforms,lighting,settingsUniforms)'));
 assert.ok(scene.includes('float waterY=waterLevel+waterSurface(position.xz,uTime).z;'));
 assert.ok(scene.includes('float currentWaterGap=waterLevel+waterSurface(vGround.xz,uTime).z-vGround.y;'));
 assert.ok(water.includes('mix(normal,meniscusNormal'));
 assert.ok(panel.includes("['海面波浪',waterWaveFields]"));assert.ok(panel.includes("title==='海面波浪'"));
 assert.ok(panel.includes('clearWaterWaves(settings)'));assert.ok(panel.includes('restoreLookGroup(settings,defaults,title)'));
 assert.ok(panel.includes('applyWaterWaveSettings(settings,values)'));assert.ok(lookControlHints.waterWaveStrength);
 assert.ok(panel.includes('aria-describedby'));assert.ok(panel.includes('已关闭默认波浪并自动保存'));
});

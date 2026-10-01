import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atmosphereFields,atmosphereDefaults,applyAtmosphereSettings,clearAtmosphereFog,validAtmosphereSetting} from '../src/atmosphere-settings.mjs';
import {renderSettings,defaultRenderSettings,settingsUniforms,settingsGLSL} from '../src/render-settings.js';
import {skyPanoramaGLSL} from '../src/sky-settings.mjs';
import {atmosphereWeatherScale} from '../src/height-atmosphere.mjs';
import {validDefaults} from '../vite.config.js';

function scalar(source,name,args){
 const start=source.indexOf(`float ${name}(`),open=source.indexOf('{',start),end=source.indexOf('}',open);
 assert.ok(start>=0&&end>open);
 return new Function(...args,`const {abs,asin,atan,sqrt,max,min,exp}=Math;const clamp=(v,a,b)=>max(a,min(b,v));const mix=(a,b,t)=>a*(1-t)+b*t;${source.slice(open+1,end).replace(/\bfloat\b/g,'let')}`);
}
const latitude=scalar(skyPanoramaGLSL,'skyCloudLatitude',['vertical','height']);

test('atmosphere defaults, finite boundaries and partial old saves use the same contract',()=>{
 assert.deepEqual(atmosphereDefaults,{skyCloudHeight:.5,atmosphereHeight:12,atmosphereStrength:.45,atmosphereSunStrength:.15});
 const target={...atmosphereDefaults,skyRotation:82,waterAbsorption:1.36};
 applyAtmosphereSettings(target,{skyCloudHeight:-1,atmosphereStrength:99,atmosphereHeight:NaN,atmosphereSunStrength:'0'});
 assert.equal(target.skyCloudHeight,.25);assert.equal(target.atmosphereStrength,2);
 assert.equal(target.atmosphereHeight,12);assert.equal(target.atmosphereSunStrength,.15);
 for(const value of [undefined,null,Infinity,-Infinity,'1'])applyAtmosphereSettings(target,{atmosphereHeight:value});
 assert.equal(target.atmosphereHeight,12);
 applyAtmosphereSettings(target,{atmosphereStrength:0});assert.equal(target.atmosphereStrength,0);
 assert.equal(target.skyRotation,82);assert.equal(target.waterAbsorption,1.36);
 assert.deepEqual(applyAtmosphereSettings({...atmosphereDefaults},{skyRotation:205}),atmosphereDefaults);
});

test('clear all fog survives JSON save, does not change sky placement or other tuning, and restores defaults',()=>{
 const target=structuredClone(defaultRenderSettings);target.skyCloudHeight=.75;
 const before=structuredClone(target);clearAtmosphereFog(target);
 for(const key of Object.keys(before))assert.equal(JSON.stringify(target[key]),JSON.stringify(key==='atmosphereStrength'?0:before[key]));
 const saved=JSON.parse(JSON.stringify(target)),restored={...atmosphereDefaults};applyAtmosphereSettings(restored,saved);
 const published=Object.fromEntries(atmosphereFields.map(([key])=>[key,defaultRenderSettings[key]]));
 assert.deepEqual(restored,{...published,skyCloudHeight:.75,atmosphereStrength:0});
 applyAtmosphereSettings(restored,defaultRenderSettings);assert.deepEqual(restored,published);
});

test('publishing validates every atmosphere bound and uniforms follow edits without rebuilding',()=>{
 assert.ok(validDefaults(defaultRenderSettings));
 for(const [key,,min,max] of atmosphereFields){
  for(const value of [min,max])assert.ok(validAtmosphereSetting(key,value));
  for(const value of [min-.01,max+.01,NaN,Infinity,'0',null]){
   assert.equal(validAtmosphereSetting(key,value),false);
   assert.equal(validDefaults({...defaultRenderSettings,[key]:value}),false);
  }
  const old=renderSettings[key];try{renderSettings[key]=min;assert.equal(settingsUniforms['uSetting_'+key].value,min);renderSettings[key]=max;assert.equal(settingsUniforms['uSetting_'+key].value,max)}finally{renderSettings[key]=old}
  assert.ok(settingsGLSL.includes('uniform float uSetting_'+key+';'));
 }
});

test('cloud height lowers clouds with no equator shift, hemisphere crossing or pole wrapping',()=>{
 assert.equal(latitude(0,.25),0);
 const original=Math.sin(12*Math.PI/180),lowered=Math.sin(Math.atan(Math.tan(12*Math.PI/180)*.5));
 assert.ok(Math.abs(latitude(original,1)-latitude(lowered,.5))<1e-9);
 for(const height of [.25,.5,1,2])for(let y=-1;y<=1;y+=.01){
  const value=latitude(y,height);assert.ok(Number.isFinite(value)&&Math.abs(value)<=1.57079633);
  assert.ok(value*y>=0);assert.ok(Math.abs(value+latitude(-y,height))<1e-9);
 }
 for(const height of [.25,.5,1,2]){
  assert.equal(latitude(1,height),1.57079633);assert.equal(latitude(-1,height),-1.57079633);
  assert.ok(latitude(.999,height)>1.48); // Every height reaches the existing uniform pole cap.
  for(let y=-.99;y<.99;y+=.01)assert.ok(latitude(y,height)<latitude(y+.01,height));
 }
 assert.equal(latitude(.3,0),latitude(.3,.25));assert.equal(latitude(.3,99),latitude(.3,2));
});

test('old depth fog settings cannot revive the model and all-off migration preserves intent',()=>{
 const target={...atmosphereDefaults};
 applyAtmosphereSettings(target,{skyFogStrength:0,sceneFogStrength:0,waterFogDensity:0});assert.equal(target.atmosphereStrength,0);
 assert.equal(target.atmosphereHeight,12);assert.equal(target.atmosphereSunStrength,.15);
 applyAtmosphereSettings(target,{atmosphereStrength:.6,skyFogStrength:0,sceneFogStrength:0,waterFogDensity:0});assert.equal(target.atmosphereStrength,.6);
 const missing={...atmosphereDefaults};applyAtmosphereSettings(missing,{skyFogStrength:2,sceneFogStrength:2,waterFogDensity:2});assert.deepEqual(missing,atmosphereDefaults);
 for(const key of ['skyFogStrength','sceneFogStrength','waterFogDensity'])assert.equal(Object.hasOwn(defaultRenderSettings,key),false);
});

test('all weather modes update a single height-layer multiplier without ordinary fog',()=>{
 assert.equal(atmosphereWeatherScale('sun'),1);assert.equal(atmosphereWeatherScale('rain'),.9);assert.equal(atmosphereWeatherScale('mist'),1.45);
 for(const id of [null,undefined,'unknown'])assert.equal(atmosphereWeatherScale(id),1);
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 assert.match(scene,/scene.fog=null/);assert.doesNotMatch(scene,/FogExp2|fog.density|weatherFogDensity/);
 assert.match(scene,/atmosphere.setWeather\(id\)/);
 assert.ok(scene.includes('Object.assign(skyMat.uniforms,atmosphere.uniforms)'));
});

test('real panel offers height-layer live, saved controls and an explicit all-off action',()=>{
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
 assert.match(panel,/\['地平线大气',atmosphereFields.slice\(1\)\]/);
 assert.match(panel,/title==='地平线大气'\|\|title==='光照'/);
 assert.match(panel,/clear.textContent='关闭散射'/);
 assert.match(panel,/clearAtmosphereFog\(settings\);syncRows\(\);try\{localStorage.setItem\(storageKey,JSON.stringify\(settings\)\)/);
 assert.match(panel,/Object.assign\(settings,structuredClone\(defaults\)\)/);
 assert.match(panel,/if\(input.type==='number'\)input.onblur=input.onchange/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lookControlHints,restoreLookGroup,clearReflection} from '../src/render-look-controls.mjs';
import {atmosphereFields,clearAtmosphereFog,DEFAULT_ATMOSPHERE_COLOR} from '../src/atmosphere-settings.mjs';
import {reflectionFields} from '../src/reflection-settings.mjs';
import {renderSettings,defaultRenderSettings,settingsUniforms} from '../src/render-settings.js';
import {validDefaults} from '../vite.config.js';

const atmosphereKeys=[...atmosphereFields.slice(1).map(([key])=>key),'atmosphereColor'];
const reflectionKeys=reflectionFields.map(([key])=>key);
function assertOnlyChanged(before,after,keys){
 assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([key])=>!keys.includes(key))),Object.fromEntries(Object.entries(before).filter(([key])=>!keys.includes(key))));
}

test('restore either group uses published values and preserves sky, water, lighting and the other group',()=>{
 for(const [title,keys] of [['地平线大气',atmosphereKeys],['环境反射',reflectionKeys]]){
  const target={...structuredClone(defaultRenderSettings),skyCloudHeight:.75,skyRotation:205,waterAbsorption:3,exposure:.8,atmosphereColor:'#abc123',atmosphereStrength:.03,reflectionStrength:.2};
  const before=structuredClone(target);
  assert.equal(restoreLookGroup(target,defaultRenderSettings,title),true);
  for(const key of keys)assert.deepEqual(target[key],defaultRenderSettings[key]);
  assertOnlyChanged(before,target,keys);
  assert.ok(validDefaults(JSON.parse(JSON.stringify(target))));
 }
});

test('restore reads a newly published snapshot each time instead of module fallback or a cached copy',()=>{
 const defaults={...defaultRenderSettings},target={...defaults};
 defaults.atmosphereStrength=.02;defaults.atmosphereColor='#879fbc';defaults.reflectionSceneStrength=.07;
 restoreLookGroup(target,defaults,'地平线大气');restoreLookGroup(target,defaults,'环境反射');
 assert.equal(target.atmosphereStrength,.02);assert.equal(target.atmosphereColor,'#879fbc');assert.equal(target.reflectionSceneStrength,.07);
 defaults.atmosphereStrength=.04;defaults.reflectionStrength=.75;
 restoreLookGroup(target,defaults,'地平线大气');restoreLookGroup(target,defaults,'环境反射');
 assert.equal(target.atmosphereStrength,.04);assert.equal(target.reflectionStrength,.75);
});

test('missing or malformed numeric defaults fall back safely and finite outliers clamp to shared bounds',()=>{
 for(const [title,fields] of [['地平线大气',atmosphereFields.slice(1)],['环境反射',reflectionFields]]){
  for(const [key,,min,max,,fallback] of fields){
   for(const [value,expected] of [[undefined,fallback],[null,fallback],['0',fallback],[NaN,fallback],[Infinity,fallback],[-Infinity,fallback],[min-1,min],[max+1,max],[0,Math.max(min,0)]]){
    const target={};restoreLookGroup(target,{[key]:value},title);assert.equal(target[key],expected,`${key}: ${value}`);
   }
  }
  const target={};restoreLookGroup(target,undefined,title);
  assert.ok(Object.values(target).every(value=>typeof value==='string'||Number.isFinite(value)));
 }
});

test('air colour reset rejects malformed colours and unknown groups do not mutate',()=>{
 for(const color of ['#fff','white','#zz0000',0,null,undefined]){
  const target={};restoreLookGroup(target,{atmosphereColor:color},'地平线大气');assert.equal(target.atmosphereColor,DEFAULT_ATMOSPHERE_COLOR);
 }
 const target={atmosphereColor:'#000000'};restoreLookGroup(target,{atmosphereColor:'#ABC123'},'地平线大气');assert.equal(target.atmosphereColor,'#ABC123');
 for(const title of ['天空','reflectionRoughness','toString','__proto__',undefined]){
  const before=structuredClone(target);assert.equal(restoreLookGroup(target,defaultRenderSettings,title),false);assert.deepEqual(target,before);
 }
});

test('close actions persist exactly one zero strength and group reset immediately updates live uniforms',()=>{
 const before=structuredClone(renderSettings);
 try{
  assert.equal(clearReflection(renderSettings),renderSettings);
  assertOnlyChanged(before,renderSettings,['reflectionStrength']);
  assert.equal(settingsUniforms.uSetting_reflectionStrength.value,0);
  assert.equal(JSON.parse(JSON.stringify(renderSettings)).reflectionStrength,0);
  clearAtmosphereFog(renderSettings);
  assertOnlyChanged(before,renderSettings,['reflectionStrength','atmosphereStrength']);
  assert.equal(settingsUniforms.uSetting_atmosphereStrength.value,0);
  restoreLookGroup(renderSettings,{...defaultRenderSettings,reflectionStrength:.7},'环境反射');
  assert.equal(settingsUniforms.uSetting_reflectionStrength.value,.7);
  assert.equal(renderSettings.atmosphereStrength,0);
  restoreLookGroup(renderSettings,{...defaultRenderSettings,atmosphereStrength:.01,atmosphereColor:'#808080'},'地平线大气');
  assert.equal(settingsUniforms.uSetting_atmosphereStrength.value,.01);
  assert.ok(Math.abs(settingsUniforms.uSetting_atmosphereColor.value.r-.2158605)<1e-7);
 }finally{Object.assign(renderSettings,before)}
});

test('panel exposes both adjacent expanded groups, touch descriptions, per-group restore and fine scatter steps',()=>{
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
 assert.match(panel,/\['地平线大气',atmosphereFields.slice\(1\)\],\s*\['环境反射',reflectionFields\]/);
 assert.match(panel,/section.open=.*title==='环境反射'/);
 assert.ok(panel.includes('restoreLookGroup(settings,defaults,title);sync();saveLookChange('));
 assert.ok(panel.includes('clearReflection(settings);syncRows();saveLookChange('));
 assert.ok(panel.includes('aria-describedby'));assert.ok(panel.includes('lookControlHints[key]'));
 for(const key of [...atmosphereKeys,...reflectionKeys])assert.ok(lookControlHints[key]);
 for(const key of ['atmosphereStrength','atmosphereSunStrength'])assert.equal(atmosphereFields.find(([name])=>name===key)[4],.01);
 assert.ok(!panel.includes('reflectionRoughness'));
 const css=readFileSync(new URL('../src/casual-ui.css',import.meta.url),'utf8');
 assert.match(css,/\.render-look-row input[^}]+min-height:44px/);
 assert.match(css,/\.render-look-actions button\{flex:1;min-width:0\}/);
});

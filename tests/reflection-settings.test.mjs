import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reflectionFields,reflectionDefaults,validReflectionSetting,applyReflectionSettings} from '../src/reflection-settings.mjs';
import {renderSettings,defaultRenderSettings,settingsUniforms,colorSettingKeys} from '../src/render-settings.js';
import {validDefaults} from '../vite.config.js';
import {waterOpticsGLSL} from '../src/water-optics.mjs';
import {skyReflectionGLSL} from '../src/sky-settings.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const reflection=glslScalar(waterOpticsGLSL,'waterReflectionWeight',['cosine','base','power','strength']);
const gain=glslScalar(waterOpticsGLSL,'waterReflectionGain',['strength']);
const wrapped=glslScalar(skyReflectionGLSL,'skyWrappedDerivative',['delta']);

test('Fresnel power actually changes mid angles; normal-incidence water reflectance stays fixed',()=>{
 for(const power of [.1,3,5,7.8,12,24])assert.equal(reflection(1,0,power,1),.0204);
 for(const c of [.15,.4,.8]){
  assert.ok(reflection(c,0,3,1)>reflection(c,0,5,1));
  assert.ok(reflection(c,0,5,1)>reflection(c,0,7.8,1));
  assert.ok(reflection(c,0,7.8,1)>reflection(c,0,12,1));
 }
 assert.ok(Math.abs(reflection(.4,0,5,1)-.096573696)<1e-10);
 assert.ok(reflection(.4,.2,5,1)>reflection(.4,0,5,1));
 assert.equal(reflection(-.01,0,5,1),1);assert.equal(reflection(0,0,5,1),1);
 for(const power of [.1,5,24])for(let c=0;c<=1;c+=.002){const f=reflection(c,0,power,1);assert.ok(f>=.0204&&f<=1)}
});

test('above-one strength boosts radiance without flattening Fresnel or losing transmission',()=>{
 for(const c of [.02,.15,.4,.8,1]){
  const one=reflection(c,0,5,1);
  assert.equal(reflection(c,0,5,1.13),one);assert.equal(reflection(c,0,5,2),one);
  assert.ok(1-one>0);assert.equal(reflection(c,0,5,.5),one*.5);
  assert.equal(reflection(c,0,5,0),0);assert.equal(reflection(c,0,5,-1),0);
 }
 assert.equal(gain(1),1);assert.equal(gain(1.13),1.13);assert.equal(gain(2),2);assert.equal(gain(99),2);
});

test('reflection samples the real pixel footprint and never forces a blurred mip level',()=>{
 assert.ok(Math.abs(wrapped(.999)-wrapped(-.001))<1e-12);
 assert.ok(Math.abs(wrapped(-.999)-wrapped(.001))<1e-12);
 for(const delta of [-2,-1.1,-.49,0,.49,1.1,2])assert.ok(wrapped(delta)>=-.5&&wrapped(delta)<.5);
 assert.ok(skyReflectionGLSL.includes('texture2DGradEXT(panorama,uv,dx,dy)'));
 assert.doesNotMatch(skyReflectionGLSL,/roughness|texture2DLodEXT|textureSize|footprint|maxMip/);
 assert.ok(!waterOpticsGLSL.includes('waterReflectionLod'));
});

test('reflection controls share saved/published bounds, retain old tuning and ignore invalid saves',()=>{
 assert.equal(Object.hasOwn(reflectionDefaults,'reflectionRoughness'),false);
 const target={...reflectionDefaults};applyReflectionSettings(target,{reflectionStrength:1.13,reflectionSceneStrength:.19});
 assert.equal(target.reflectionStrength,1.13);assert.equal(target.reflectionSceneStrength,.19);assert.equal(Object.hasOwn(target,'reflectionRoughness'),false);
 applyReflectionSettings(target,{reflectionRoughness:99,reflectionStrength:NaN,reflectionFresnelPower:'5'});
 assert.equal(Object.hasOwn(target,'reflectionRoughness'),false);assert.equal(target.reflectionStrength,1.13);assert.equal(target.reflectionFresnelPower,5);
 assert.equal(Object.hasOwn(defaultRenderSettings,'reflectionRoughness'),false);assert.equal(settingsUniforms.uSetting_reflectionRoughness,undefined);
 assert.ok(validDefaults(defaultRenderSettings));
 for(const [key,,min,max] of reflectionFields){
  for(const value of [min,max])assert.ok(validReflectionSetting(key,value));
  for(const value of [min-.01,max+.01,Infinity,NaN,'0',null])assert.equal(validDefaults({...defaultRenderSettings,[key]:value}),false);
  const old=renderSettings[key];try{renderSettings[key]=max;assert.equal(settingsUniforms['uSetting_'+key].value,max)}finally{renderSettings[key]=old}
 }
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
 assert.ok(panel.includes("['环境反射',reflectionFields]"));assert.ok(panel.includes('倒影直接使用水面法线；水纹强度在法线设置中统一调整'));
});

test('air base colour survives JSON/defaults, is linear once, and rejects malformed publishing',()=>{
 assert.ok(colorSettingKeys.includes('atmosphereColor'));
 for(const colour of ['#000000','#ffffff','#9fb9d3'])assert.ok(validDefaults({...defaultRenderSettings,atmosphereColor:colour}));
 for(const colour of ['#fff','#gg0000','white',0,null])assert.equal(validDefaults({...defaultRenderSettings,atmosphereColor:colour}),false);
 const old=renderSettings.atmosphereColor;
 try{renderSettings.atmosphereColor='#808080';assert.ok(Math.abs(settingsUniforms.uSetting_atmosphereColor.value.r-.2158605)<1e-7)}finally{renderSettings.atmosphereColor=old}
 const saved=JSON.parse(JSON.stringify({...defaultRenderSettings,atmosphereColor:'#abc123'}));assert.equal(saved.atmosphereColor,'#abc123');
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');assert.ok(panel.includes("[['atmosphereColor','散射基色']]"));
});

test('sky mirror uses one unbiased texture query, a horizon fallback and no water colour grading',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8'),engine=readFileSync(new URL('../src/three.module.js',import.meta.url),'utf8');
 assert.equal(water.split('${skyReflectionGLSL}').length-1,2);
 assert.equal(skyReflectionGLSL.match(/texture2DGradEXT\(/g).length,1);assert.ok(engine.includes('#define texture2DGradEXT textureGrad'));
 assert.ok(skyReflectionGLSL.includes('max(direction.y,0.)'));assert.ok(skyReflectionGLSL.includes('skyWrappedDerivative(dx.x)'));
 assert.ok(water.includes('skyReflectionDirection(reflectedDir)'));assert.ok(water.includes('localEnvironmentReflection(vWorld,reflectedDir)'));
 assert.ok(water.indexOf('refracted=max(vec3(0.),mix(vec3(waterLuminance),refracted')<water.indexOf('color=mix(color,reflectedSky,reflectionWeight'));
 assert.ok(water.indexOf('color*=1.-troughShade;')<water.indexOf('color=mix(color,reflectedSky,reflectionWeight'));
 assert.ok(!water.includes('dot(color,vec3(.2126,.7152,.0722))'));assert.ok(!water.includes('reflectedSun'));
});

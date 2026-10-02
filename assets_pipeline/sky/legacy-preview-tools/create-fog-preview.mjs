import {readFile,writeFile} from 'node:fs/promises';
const baseline=JSON.parse(await readFile(new URL('../docs/validation/fog-light-2026-10-01/baseline.json',import.meta.url),'utf8'));
const waterPreview=await readFile(new URL('./create-water-optics-preview.mjs',import.meta.url),'utf8');
const modes=waterPreview.slice(waterPreview.indexOf('const mode=name=>'),waterPreview.indexOf('for(const button of document.querySelectorAll'));
await writeFile(new URL('../src/__fog-preview.html',import.meta.url),`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>减雾对照</title>
<style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}nav{position:fixed;top:8px;left:8px;right:8px;z-index:10;background:#fff7e4e8;padding:8px;border-radius:12px;font:12px sans-serif}button{min-height:44px;margin:2px;border:0;border-radius:8px;background:#cbe4db;padding:8px}output{display:block}</style>
<div id="world"></div><nav>同贴图 · 同光照 · 固定波相位<br>
<button id="before">减雾前</button><button id="after">减雾后</button><br>
${Array.from({length:6},(_,i)=>'<button data-sky="0'+(i+1)+'">天空 0'+(i+1)+'</button>').join('')}<br>
<button id="close">近景</button><button id="top">俯瞰</button><button id="aim">瞄准</button><button id="wait">等待</button><button id="bite">咬钩预览</button><button id="fight">收线预览</button><button id="landing">出水预览</button><br>
<button data-weather="sun">晴天</button><button data-weather="rain">雨后</button><button data-weather="mist">雾天</button><button id="hide">收起验证栏</button><output id="stats"></output></nav>
<button id="show" hidden style="position:fixed;top:4px;left:4px;z-index:10;font:10px sans-serif;min-height:24px;background:#fff7e4b0">验证</button>
<script type="module">
import {createWorld} from './scene.js';import {newSave,makeCast} from './engine.mjs';import {createFight} from './reference-loop.mjs';
import {renderSettings,defaultRenderSettings} from './render-settings.js';import {skyRadianceGLSL} from './sky-settings.mjs';
Object.assign(renderSettings,structuredClone(defaultRenderSettings));
const state={...newSave(),casts:1,overview:false,keepFishingView:true,aiming:false,aimPoint:[-7.8,4.6],pending:null};
const world=createWorld(document.querySelector('#world'),()=>state,()=>{});world.cancelIntro();world.setPreviewTime(8);
const materials=new Map();world.scene.traverse(object=>{for(const material of [object.material].flat())if(material?.uniforms?.uSky)materials.set(material,material.fragmentShader);});
const baseline=${JSON.stringify(baseline)};
let before=false,weather='sun',id='02';
const stats=()=>document.querySelector('#stats').textContent=(before?'减雾前':'减雾后')+' · 天空 '+id+' · '+weather;
function apply(){renderSettings.skyCloudHeight=before?1:defaultRenderSettings.skyCloudHeight;renderSettings.skyFogStrength=defaultRenderSettings.skyFogStrength;renderSettings.waterFogDensity=defaultRenderSettings.waterFogDensity;renderSettings.sceneFogStrength=before?(weather==='mist'?baseline.mistDensity/.0028:baseline.normalDensity/.00125):defaultRenderSettings.sceneFogStrength;world.setWeather(weather);
 for(const [material,shader] of materials){material.fragmentShader=before?shader.replace(skyRadianceGLSL,baseline.skyRadianceGLSL)
 .replace('float aerialHaze=waterAerialHaze(distanceToEye,uSetting_waterFogDensity);','float distanceHaze=smoothstep(24.,118.,distanceToEye);float grazingHaze=1.-smoothstep(.025,.34,ndv);float aerialHaze=clamp(distanceHaze*(.38+.62*grazingHaze),0.,.965);')
 .replace('1.-aerialHaze*.14','1.-aerialHaze*.42'):shader;material.needsUpdate=true;}stats();}
document.querySelector('#before').onclick=()=>{before=true;apply();};document.querySelector('#after').onclick=()=>{before=false;apply();};
for(const button of document.querySelectorAll('[data-sky]'))button.onclick=async()=>{document.querySelector('#stats').textContent='加载中';try{await world.setSkyTexture('./assets/sky-toon-'+button.dataset.sky+'.png');id=button.dataset.sky;stats();}catch(error){document.querySelector('#stats').textContent='加载失败 '+error.message;console.error(error);}};
for(const button of document.querySelectorAll('[data-weather]'))button.onclick=()=>{weather=button.dataset.weather;apply();};
${modes}
document.querySelector('#hide').onclick=()=>{document.querySelector('nav').hidden=true;document.querySelector('#show').hidden=false;};
document.querySelector('#show').onclick=()=>{document.querySelector('nav').hidden=false;document.querySelector('#show').hidden=true;};
apply();window.addEventListener('pagehide',()=>world.dispose());
</script></html>`);
console.log('减雾对照入口：/__fog-preview.html');

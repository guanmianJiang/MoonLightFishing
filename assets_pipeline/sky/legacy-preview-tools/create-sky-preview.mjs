import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {skyRadianceGLSL as oldRadiance} from '../assets_pipeline/sky/v1/sky-settings.mjs';

// Temporary isolated scene: does not import the game UI, save preferences or saves.
const debugRoot=new URL('../public/assets/__sky-v1/',import.meta.url);
await mkdir(debugRoot,{recursive:true});
for(let i=1;i<=6;i++)await copyFile(new URL(`../assets_pipeline/sky/v1/sky-toon-0${i}.png`,import.meta.url),new URL(`sky-toon-0${i}.png`,debugRoot));
const waterPreview=await readFile(new URL('./create-water-optics-preview.mjs',import.meta.url),'utf8');
const modes=waterPreview.slice(waterPreview.indexOf('const mode=name=>'),waterPreview.indexOf('for(const button of document.querySelectorAll'));
await writeFile(new URL('../src/__sky-v2-preview.html',import.meta.url),`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>天空第二版验证</title>
<style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}nav{position:fixed;top:8px;left:8px;right:8px;z-index:10;background:#fff7e4e8;padding:8px;border-radius:12px;font:12px sans-serif}button{min-height:44px;margin:2px;border:0;border-radius:8px;background:#cbe4db;padding:8px}output{display:block}</style>
<div id="world"></div><nav>天空第二版 · 固定波相位<br>
${Array.from({length:6},(_,i)=>'<button data-sky="0'+(i+1)+'">天空 0'+(i+1)+'</button>').join('')}<br>
<button id="before">旧版对照</button><button id="after">新版</button>
<button data-rotate="0">旋转 0°</button><button data-rotate="180">旋转 180°</button><button data-rotate="360">旋转 360°</button><button data-rotate="82">默认 82°</button><br>
<button id="close">近景</button><button id="top">俯瞰</button><button id="aim">瞄准</button><button id="wait">等待</button><button id="bite">咬钩预览</button><button id="fight">收线预览</button><button id="landing">出水预览</button><br>
<button data-weather="sun">晴天</button><button data-weather="rain">雨后</button><button id="hide">收起验证栏</button><output id="stats"></output></nav>
<button id="show" hidden style="position:fixed;top:4px;left:4px;z-index:10;font:10px sans-serif;min-height:24px;background:#fff7e4b0">验证</button>
<script type="module">
import * as T from './three.module.js';
import {createWorld} from './scene.js';import {newSave,makeCast} from './engine.mjs';import {createFight} from './reference-loop.mjs';
import {renderSettings,defaultRenderSettings} from './render-settings.js';import {skyRadianceGLSL} from './sky-settings.mjs';
Object.assign(renderSettings,structuredClone(defaultRenderSettings));
const state={...newSave(),casts:1,overview:false,keepFishingView:true,aiming:false,aimPoint:[-7.8,4.6],pending:null};
const world=createWorld(document.querySelector('#world'),()=>state,()=>{});world.cancelIntro();world.setWeather('sun');world.setPreviewTime(8);
const materials=new Map();world.scene.traverse(object=>{for(const material of [object.material].flat())if(material?.uniforms?.uSky)materials.set(material,material.fragmentShader);});
let id='02',before=false,weather='sun',loading=false;
const oldRadiance=${JSON.stringify(oldRadiance)},oldTextures=new Map();
const stats=()=>document.querySelector('#stats').textContent=(loading?'加载中':before?'旧版':'新版')+' · 天空 '+id+' · '+renderSettings.skyRotation+'° · '+weather+' · 绘制 '+world.getStats().calls+' · 几何 '+world.getStats().geometries;
async function select(){loading=true;stats();try{
 renderSettings.skyCloudHeight=before?1:defaultRenderSettings.skyCloudHeight;renderSettings.skyFogStrength=defaultRenderSettings.skyFogStrength;renderSettings.waterFogDensity=defaultRenderSettings.waterFogDensity;renderSettings.sceneFogStrength=before?(weather==='mist'?1:.0019/.00125):defaultRenderSettings.sceneFogStrength;world.setWeather(weather);
 for(const [material,shader] of materials){material.fragmentShader=before?shader.replace(skyRadianceGLSL,oldRadiance)
 .replace(/vec3 horizonDirection=[\\s\\S]*?vec3 horizonAir=skyEnvironmentRadiance[^;]+;/,'vec3 horizonAir=vec3(.54,.70,.73);')
 .replace('float aerialHaze=waterAerialHaze(distanceToEye,uSetting_waterFogDensity);','float distanceHaze=smoothstep(24.,118.,distanceToEye);float grazingHaze=1.-smoothstep(.025,.34,ndv);float aerialHaze=clamp(distanceHaze*(.38+.62*grazingHaze),0.,.965);')
 .replace('1.-aerialHaze*.14','1.-aerialHaze*.42'):shader;material.needsUpdate=true;}
 if(before){let texture=oldTextures.get(id);if(!texture){texture=await new T.TextureLoader().loadAsync('./assets/__sky-v1/sky-toon-'+id+'.png');texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;oldTextures.set(id,texture);}for(const material of materials.keys())material.uniforms.uSky.value=texture;}
 else{const path='./assets/sky-toon-'+id+'.png';await world.setSkyTexture(path);renderSettings.skyTexture=path;}
 loading=false;stats();
 }catch(error){document.querySelector('#stats').textContent='加载失败 '+error.message;console.error(error);}}
for(const button of document.querySelectorAll('[data-sky]'))button.onclick=()=>{id=button.dataset.sky;select();};
document.querySelector('#before').onclick=()=>{before=true;select();};document.querySelector('#after').onclick=()=>{before=false;select();};
for(const button of document.querySelectorAll('[data-rotate]'))button.onclick=()=>{renderSettings.skyRotation=Number(button.dataset.rotate);stats();};
for(const button of document.querySelectorAll('[data-weather]'))button.onclick=()=>{weather=button.dataset.weather;select();};
${modes}
document.querySelector('#hide').onclick=()=>{document.querySelector('nav').hidden=true;document.querySelector('#show').hidden=false;};
document.querySelector('#show').onclick=()=>{document.querySelector('nav').hidden=false;document.querySelector('#show').hidden=true;};
setInterval(()=>{if(!loading)stats();},500);stats();
window.addEventListener('pagehide',()=>{for(const texture of oldTextures.values())texture.dispose();world.dispose();});
</script></html>`);
console.log('天空验证入口：/__sky-v2-preview.html');

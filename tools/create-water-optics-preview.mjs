import {writeFile,mkdir} from 'node:fs/promises';

// Isolated validation fixture: no game-save writes or render preference writes.
await mkdir(new URL('../docs/validation/water-optics-2026-10-01/',import.meta.url),{recursive:true});
await writeFile(new URL('../src/__water-optics-preview.html',import.meta.url),`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>水体光学验证</title>
<style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}nav{position:fixed;top:8px;left:8px;right:8px;z-index:10;background:#fff7e4e8;padding:8px;border-radius:12px;font:12px sans-serif}button{min-height:44px;margin:2px;border:0;border-radius:8px;background:#cbe4db;padding:8px}output{display:block}</style>
<div id="world"></div><nav>水体光学验证 · 晴天 · 固定波相位<br>
<button id="close">近景</button><button id="top">俯瞰</button><button id="aim">瞄准</button><button id="wait">等待</button><br>
<button id="bite">咬钩预览</button><button id="fight">收线预览</button><button id="landing">出水预览</button><br>
<button data-abs="0">吸收 0</button><button data-abs="default">吸收默认</button><button data-abs="3">吸收 3</button><br>
<button id="reflection">反射开关</button><button id="local">物体倒影开关</button><button id="rotate">天空旋转 180°</button><button id="hide">收起验证栏</button><output id="stats"></output></nav>
<button id="show" hidden style="position:fixed;top:4px;left:4px;z-index:10;font:10px sans-serif;min-height:24px;background:#fff7e4b0">验证</button>
<script type="module">
import {createWorld} from './scene.js';import {newSave,makeCast} from './engine.mjs';
import {createFight} from './reference-loop.mjs';
import {renderSettings,defaultRenderSettings} from './render-settings.js';
Object.assign(renderSettings,structuredClone(defaultRenderSettings));
const defaults=structuredClone(renderSettings);
const state={...newSave(),casts:1,overview:false,keepFishingView:true,aiming:false,aimPoint:[-7.8,4.6],pending:null};
const world=createWorld(document.querySelector('#world'),()=>state,()=>{});world.cancelIntro();world.setWeather('sun');world.setPreviewTime(8);
const mode=name=>{state.pending=null;state.revealing=false;state.aiming=name==='aim';state.overview=name==='top';
 if(['wait','bite','fight','landing'].includes(name)){
  const now=Date.now();state.pending=makeCast({...newSave(),casts:1},now-6000,()=>.1);
  state.pending.readyAt=name==='wait'?now+600000:now-1000;state.pending.decisionAt=state.pending.readyAt-2000;
  if(name==='fight'){state.pending.fight=createFight(state.pending.catch);Object.assign(state.pending.fight,{elapsed:8,distance:3.2,lineLength:3.25,tension:.45,held:true,fishState:'turn'});}
  if(name==='landing'){state.pending.landedFromFight=true;state.revealing=true;state.revealStart=now-2200;}
 }
 if(name==='top')world.topView();else world.reset();};
for(const name of ['close','top','aim','wait','bite','fight','landing'])document.getElementById(name).onclick=()=>mode(name);
for(const button of document.querySelectorAll('[data-abs]'))button.onclick=()=>renderSettings.waterAbsorption=button.dataset.abs==='default'?defaults.waterAbsorption:Number(button.dataset.abs);
document.querySelector('#reflection').onclick=()=>renderSettings.reflectionStrength=renderSettings.reflectionStrength?0:defaults.reflectionStrength;
document.querySelector('#local').onclick=()=>renderSettings.reflectionSceneStrength=renderSettings.reflectionSceneStrength?0:defaults.reflectionSceneStrength;
document.querySelector('#rotate').onclick=()=>renderSettings.skyRotation=renderSettings.skyRotation===defaults.skyRotation?(defaults.skyRotation+180)%360:defaults.skyRotation;
document.querySelector('#hide').onclick=()=>{document.querySelector('nav').hidden=true;document.querySelector('#show').hidden=false;};
document.querySelector('#show').onclick=()=>{document.querySelector('nav').hidden=false;document.querySelector('#show').hidden=true;};
setInterval(()=>document.querySelector('#stats').textContent='吸收 '+renderSettings.waterAbsorption+' · 反射 '+renderSettings.reflectionStrength+' · 物体 '+renderSettings.reflectionSceneStrength,250);
window.addEventListener('pagehide',()=>world.dispose());
</script></html>`,'utf8');
console.log('水体光学验证入口：/__water-optics-preview.html');

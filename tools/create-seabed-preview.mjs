import {writeFile} from 'node:fs/promises';

// Temporary local validation entry; remove src/__seabed-preview.html after QA.
await writeFile(new URL('../src/__seabed-preview.html',import.meta.url),`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>沙底视觉验证</title>
<style>html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}nav{position:fixed;top:8px;left:8px;right:8px;z-index:10;background:#fff7e4e8;padding:8px;border-radius:12px;font:12px sans-serif}button{min-height:44px;margin:2px;border:0;border-radius:8px;background:#cbe4db;padding:8px}output{display:block}canvas{display:block}</style>
<div id="world"></div><nav>沙底验证 · 晴天 · 固定水面时刻（非正式 HUD）<br>
<button id="close">近景</button><button id="top">俯瞰</button><button id="aim">瞄准</button><button id="wait">等待</button><br>
<button data-absorption="0">吸收 0</button><button id="absorptionDefault">吸收默认</button><button data-absorption="3">吸收 3</button><button id="details">散落物切换</button><output id="stats"></output></nav>
<script type="module">
import {createWorld} from './scene.js';
import {newSave,makeCast} from './engine.mjs';
import {renderSettings} from './render-settings.js';
const state={...newSave(),casts:1,overview:false,keepFishingView:true,aiming:false,aimPoint:[-7.8,4.6],pending:null};
const defaultAbsorption=renderSettings.waterAbsorption;
const world=createWorld(document.querySelector('#world'),()=>state,()=>{});world.cancelIntro();world.setWeather('sun');world.setPreviewTime(8);
// Include refraction, shadow and postprocessing passes; renderer's default
// auto-reset otherwise reports only the final two-triangle full-screen quad.
world.renderer.info.autoReset=false;const samples=[];
const sampleFrame=()=>{samples.push(world.getStats());if(samples.length>16)samples.shift();world.renderer.info.reset();requestAnimationFrame(sampleFrame);};requestAnimationFrame(sampleFrame);
const mode=name=>{state.pending=null;state.aiming=name==='aim';state.overview=name==='top';
 if(name==='wait'){state.pending=makeCast({...newSave(),casts:1},Date.now()-6000,()=>.1);state.pending.decisionAt=Date.now()+600000;state.pending.readyAt=Date.now()+600000;}
 if(name==='top')world.topView();else world.reset();};
for(const name of ['close','top','aim','wait'])document.getElementById(name).onclick=()=>mode(name);
for(const button of document.querySelectorAll('[data-absorption]'))button.onclick=()=>renderSettings.waterAbsorption=Number(button.dataset.absorption);
document.getElementById('absorptionDefault').onclick=()=>renderSettings.waterAbsorption=defaultAbsorption;
document.getElementById('details').onclick=()=>{samples.length=0;world.scene.traverse(object=>{if(object.name.startsWith('seabed-'))object.visible=!object.visible;});};
setInterval(()=>{document.querySelector('#stats').textContent='吸收 '+renderSettings.waterAbsorption+' · '+JSON.stringify({callsMin:Math.min(...samples.map(s=>s.calls)),callsMax:Math.max(...samples.map(s=>s.calls)),trianglesMin:Math.min(...samples.map(s=>s.triangles))});},500);
</script></html>`,'utf8');
console.log('临时预览入口：/__seabed-preview.html');

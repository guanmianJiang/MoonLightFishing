import {readFile, writeFile, mkdir} from 'node:fs/promises';

const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app-final.js', import.meta.url), 'utf8');
const main = html.slice(html.indexOf('  <main '), html.indexOf('  <dialog id="result"'));
const sheets = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].map(([tag]) => tag).join('\n');
const renderFight = app.slice(app.indexOf('function renderFight('), app.indexOf('function renderStrikeControl('));
await mkdir(new URL('../docs/validation/ui-fight-status-2026-10-01/', import.meta.url), {recursive: true});
await writeFile(new URL('../src/__fight-status-preview.html', import.meta.url), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>搏鱼状态卡验证</title>
${sheets}
<style>#previewControls{position:fixed;left:12px;bottom:12px;z-index:30;max-width:150px;padding:7px;border-radius:12px;background:#e8efdbe8;font:12px sans-serif}#previewControls button{min-height:44px;margin:2px;padding:5px 8px;color:#3a6250;background:#cadfc8;border:0;border-radius:9px}#previewShow{position:fixed;bottom:12px;left:12px;z-index:30;min-height:28px;padding:5px;font:10px sans-serif}#previewControls[hidden],#previewShow[hidden]{display:none!important}</style>
${main}
<nav id="previewControls" aria-label="验证场景"><button data-scenario="strained">线绷紧</button><button data-scenario="slack">线松了</button><button data-scenario="lift">抬竿</button><button data-scenario="far">往外游</button><button data-scenario="long">长名称</button><button id="previewHide">收起验证栏</button></nav><button id="previewShow" hidden>验证</button>
<script type="module">
import {createWorld} from './scene.js';
import {newSave,makeCast} from './engine.mjs';
import {createFight,pumpOpportunity} from './reference-loop.mjs';
import {fightRigGeometry} from './fight-rig.mjs';
import {fightPerformance} from './fight-performance.mjs';
import {fightOutlook,fightOutlookDisplay} from './fight-outlook.mjs';
import {fightGuidance,liftOutcomeText} from './fight-guidance.mjs';
import {fishBehavior} from './fish-behavior.mjs';
import {reelControlFeedback} from './reel-control-feedback.mjs';
import {defaultRenderSettings,renderSettings} from './render-settings.js';
Object.assign(renderSettings,structuredClone(defaultRenderSettings));
const $=s=>document.querySelector(s),fightUI=Object.fromEntries([...document.querySelectorAll('[id]')].map(node=>[node.id,node]));
const state={...newSave(),casts:1,keepFishingView:true,overview:false,aiming:false};
state.pending=makeCast(state,Date.now()-15000,()=>.4,[-4,5]);
state.pending.catch={id:'perch',weight:.8,length:22,time:Date.now()};
const world=createWorld($('#world'),()=>state,()=>{});world.cancelIntro();world.setPreviewTime(8);world.setWeather('sun');$('#bootStatus').hidden=true;
let holdPointer=false,holdSpace=false,reelGesture=null,tapFlashUntil=0,pumpHintUntil=0,pumpStartDistance=null,pumpHintText='',tapHintUntil=0;
const fightText=(node,text)=>node.textContent=text,fightAttr=(node,key,value)=>node.setAttribute(key,value),fightData=(node,key,value)=>node.dataset[key]=value,fightClass=(node,key,value)=>node.classList.toggle(key,value);
const setMembraneScale=()=>{},setMembraneAngle=()=>{},updateLeverPose=()=>{},joystickVisual=()=>null;
${renderFight}
function scenario(name){
 const f=createFight(state.pending.catch);Object.assign(f,{distance:6.1,load:.75,tension:.75,slack:0,radialVelocity:-.6,fishState:'recover',behaviorId:'perch',fishPosition:.5,surge:0,force:0,warningAge:0,overload:0,elapsed:10});
 if(name==='slack')Object.assign(f,{slack:.8,load:.1,tension:.1,radialVelocity:.4});
 if(name==='lift')Object.assign(f,{load:.35,tension:.35,pumpPulse:1,pumpAge:.5,fishState:'recover',radialVelocity:-.7});
 if(name==='far')Object.assign(f,{distance:f.startDistance+2.8,load:.7,tension:.7,radialVelocity:.8,fishState:'burst',surge:.8});
 state.pending.fight=f;
 $('#game').className='fishing fighting';$('#game').dataset.uiMode='fight';$('#game').dataset.phase='hooked';
 for(const id of ['biteReadout','rhythmAura','sceneAction','landFish','landingCue'])$('#'+id).hidden=true;
 $('#fight').hidden=false;$('#fightControl').hidden=false;
 renderFight(f);if(name==='long')$('#fightSpecies').textContent='远海银纹长尾鱼 · 连续横向双冲与贴底';
 $('#weather').textContent='晴天';
}
for(const button of document.querySelectorAll('[data-scenario]'))button.onclick=()=>scenario(button.dataset.scenario);
$('#previewHide').onclick=()=>{$('#previewControls').hidden=true;$('#previewShow').hidden=false};
$('#previewShow').onclick=()=>{$('#previewControls').hidden=false;$('#previewShow').hidden=true};
scenario('strained');
</script></html>`);
console.log('Created src/__fight-status-preview.html from the actual DOM, renderFight and fight geometry; no save writes.');

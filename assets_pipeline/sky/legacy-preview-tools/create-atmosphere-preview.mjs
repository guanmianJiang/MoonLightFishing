import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=await readFile(new URL('./create-water-optics-preview.mjs',import.meta.url),'utf8');
const modes=source.slice(source.indexOf('const mode=name=>'),source.indexOf('for(const button of document.querySelectorAll')).replace('getElementById(name)','getElementById("qa-"+name)');
const index=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const styles=[...index.matchAll(/<link rel="stylesheet"[^>]+>/g)].map(match=>match[0]).join('\n');
await mkdir(new URL('../docs/validation/atmosphere-controls-2026-10-01/',import.meta.url),{recursive:true});
await writeFile(new URL('../src/__atmosphere-preview.html',import.meta.url),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>天空与雾设置验证</title>${styles}
<style>[hidden]{display:none!important}html,body,#world{margin:0;width:100%;height:100%;overflow:hidden}#renderSettingsButton{position:fixed;top:8px;right:12px;z-index:40}#qa{position:fixed;bottom:8px;left:8px;right:8px;z-index:20;background:#fff7e4e8;padding:8px;border-radius:12px;font:12px sans-serif}#qa button{min-height:44px;min-width:44px;margin:2px;border:0;border-radius:8px;background:#cbe4db;padding:8px}#qa output{display:block}#qa-show{position:fixed;bottom:4px;left:4px;z-index:20}</style>
<div id="world"></div><button id="journal" hidden>手记占位</button>
<nav id="qa"><button id="qa-previous">上一版参数</button><button id="qa-current">当前默认</button><br><button id="qa-wait">等待</button><button id="qa-fight">收线预览</button><button id="qa-close">近景</button><button id="qa-top">俯瞰</button><button id="qa-aim">瞄准</button><button id="qa-bite">咬钩预览</button><button id="qa-landing">出水预览</button><br><button data-weather="sun">晴天</button><button data-weather="rain">雨后</button><button data-weather="mist">雾天</button><button id="qa-hide">收起验证栏</button><output id="qa-stats"></output></nav><button id="qa-show" hidden>验证</button>
<script type="module">
import {createWorld} from './scene.js';import {newSave,makeCast} from './engine.mjs';import {createFight} from './reference-loop.mjs';
import {renderSettings,defaultRenderSettings} from './render-settings.js';import {createRenderSettingsPanel} from './render-settings-panel.js';
const state={...newSave(),casts:1,overview:false,keepFishingView:true,aiming:false,aimPoint:[-7.8,4.6],pending:null};
const world=createWorld(document.querySelector('#world'),()=>state,()=>{});world.cancelIntro();world.setPreviewTime(8);world.setWeather('sun');createRenderSettingsPanel(world);
document.querySelector('[data-action=publish]').disabled=true;
document.querySelector('#qa-previous').onclick=()=>Object.assign(renderSettings,{skyCloudHeight:1,skyFogStrength:1,sceneFogStrength:1,waterFogDensity:1});
document.querySelector('#qa-current').onclick=()=>Object.assign(renderSettings,structuredClone(defaultRenderSettings));
for(const button of document.querySelectorAll('[data-weather]'))button.onclick=()=>world.setWeather(button.dataset.weather);
${modes}
document.querySelector('#qa-hide').onclick=()=>{document.querySelector('#qa').hidden=true;document.querySelector('#qa-show').hidden=false;};document.querySelector('#qa-show').onclick=()=>{document.querySelector('#qa').hidden=false;document.querySelector('#qa-show').hidden=true;};
setInterval(()=>{const values=['skyCloudHeight','skyFogStrength','sceneFogStrength','waterFogDensity'].map(key=>renderSettings[key]);document.querySelector('#qa-stats').textContent='高度/天空雾/场景雾/远水雾 '+values.join(' / ')+' · 对象雾 '+world.scene.fog.density.toFixed(7)+' · draw '+world.getStats().calls;},500);
mode('wait');window.addEventListener('pagehide',()=>world.dispose());
</script></html>`);
console.log('隔离端口验证入口：/__atmosphere-preview.html（真实画面设置模块；不发布默认、不写存档）');

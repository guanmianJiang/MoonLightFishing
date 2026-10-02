// Temporary review harness, importing the same assets and rig as the game.
import {writeFile} from 'node:fs/promises';
await writeFile('src/__fish-animation-preview.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>鱼体动作复核</title><style>body{margin:0;background:#d9e6d8;color:#354f48;font:14px system-ui}canvas{display:block}aside{position:fixed;bottom:0;background:#fbf8e8ee;padding:12px;box-sizing:border-box;width:100%}button{font:inherit;border:1px solid #b0c5b8;border-radius:8px;padding:7px;margin:3px;background:#faf5e4}button[aria-pressed=true]{background:#ebc09b}h1{font-size:16px;margin:0 0 6px}output{display:block;font-size:12px}</style><aside><h1 id="label">鲤鱼 · 靠钩</h1><div id="fish"></div><div id="stage"></div><button id="freeze">停住动作</button><button id="step">前进 1/8 秒</button><output id="stats"></output></aside><script type="module">
import * as T from './three.module.js';import {loadSpecimen,animateSpecimen,disposeSpecimenAnimation} from './fishing-art.js';
const scene=new T.Scene();scene.background=new T.Color('#d9e6d8');scene.add(new T.HemisphereLight('#fff3db','#7a9d91',2));const sun=new T.DirectionalLight('#fff0d1',2.3);sun.position.set(-3,4,3);scene.add(sun);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.toneMapping=T.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(32,1,.01,20);camera.position.set(-.25,1.8,8.2);camera.lookAt(0,-.25,0);
const names={carp:'鲤鱼',minnow:'小银鱼',perch:'鲈鱼',catfish:'鲶鱼',oldgold:'老金鱼',moon:'月鱼',shrimp:'虾'},stages={approach:'靠钩',hooked:'咬实',fight:'搏鱼',landing:'出水',held:'托举',release:'放流',swim:'游离'};
let model=null,id='carp',stage='approach',last=0,frozen=false,elapsed=0,token=0;
async function select(next){const key=++token,idBefore=id;id=next;if(model){scene.remove(model);disposeSpecimenAnimation(model)}model=await loadSpecimen(id);if(key!==token)return;model.rotation.y=.12;scene.add(model);mark();}
function mark(){document.querySelector('#label').textContent=names[id]+' · '+stages[stage];document.querySelectorAll('[data-fish]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fish===id));document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.stage===stage));}
for(const [value,label] of Object.entries(names)){const b=document.createElement('button');b.textContent=label;b.dataset.fish=value;b.onclick=()=>select(value);document.querySelector('#fish').append(b)}
for(const [value,label] of Object.entries(stages)){const b=document.createElement('button');b.textContent=label;b.dataset.stage=value;b.onclick=()=>{stage=value;mark()};document.querySelector('#stage').append(b)}
document.querySelector('#freeze').onclick=()=>{frozen=!frozen;document.querySelector('#freeze').textContent=frozen?'继续动作':'停住动作'};
function motion(dt){if(!model)return;elapsed+=dt;animateSpecimen(model,{id,weight:id==='minnow'?.05:2.8},{stage,effort:stage==='fight'?1:.5,surge:stage==='fight'?.8:0,hookAge:1},dt);}
document.querySelector('#step').onclick=()=>{motion(.0625);motion(.0625)};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();await select(id);
function frame(ms){const dt=last?Math.min(.05,(ms-last)/1000):0;last=ms;if(!frozen)motion(dt);renderer.render(scene,camera);document.querySelector('#stats').textContent='实例变形顶点 '+(model?.userData.fishBodyRig?.vertexCount||0)+' · draw call '+renderer.info.render.calls+' · 动作时间 '+elapsed.toFixed(3)+'s';requestAnimationFrame(frame)}requestAnimationFrame(frame);
</script></html>`);

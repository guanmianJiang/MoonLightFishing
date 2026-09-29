import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReelSurface,reelSurfaceState,reelControlCaption} from '../src/reel-material.mjs';

test('reel surface follows physical load, gesture direction and actual turns',()=>{
 const calm=reelSurfaceState({fight:{load:.22,surge:0,reelTurns:2},held:true,visual:{scale:1,angle:0},now:1200});
 const strained=reelSurfaceState({fight:{load:.9,surge:.8,reelTurns:4},held:false,paying:true,ready:true,visual:{scale:2.5,angle:-90},now:1500});
 assert.deepEqual([calm.load,calm.surge,calm.turns,calm.held,calm.paying],[.22,0,2,1,0]);
 assert.equal(strained.load,.9);
 assert.equal(strained.surge,.8);
 assert.equal(strained.turns,4);
 assert.equal(strained.paying,1);
 assert.equal(strained.ready,1);
 assert.equal(strained.scale,2.5);
 assert.ok(Math.abs(strained.angle-Math.PI/2)<1e-9);
 assert.equal(strained.time,1.5);
});

test('invalid and reduced-motion surface inputs stay finite and quiet',()=>{
 const state=reelSurfaceState({fight:{load:Infinity,surge:-1,reelTurns:NaN},visual:{scale:Infinity,angle:NaN},now:Infinity,reducedMotion:true});
 assert.deepEqual(state,{load:0,surge:0,turns:0,scale:1,angle:0,held:0,paying:0,ready:0,time:0});
 assert.equal(reelSurfaceState({fight:{load:3,surge:2},visual:{scale:6,angle:600}}).scale,3);
});

test('the prompt moves below the icon and describes the current gesture',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const control=html.split('<div id="fightControl" class="fight-actions"')[1]?.split('</button>')[0]||'';
 assert.match(control,/<canvas id="fightSurface"/);
 assert.match(control,/<svg class="fight-reel-icon"/);
 assert.doesNotMatch(control,/id="fightHoldLabel"/);
 assert.match(html,/<\/button>\s*<span class="fight-control-caption"[^>]*><strong id="fightHoldLabel">提竿<\/strong>/);
 assert.equal(reelControlCaption({mode:'strike'}),'按住提竿');
 assert.equal(reelControlCaption({mode:'retrieve'}),'点按收回');
 assert.equal(reelControlCaption({}),'按住收线');
 assert.equal(reelControlCaption({held:true}),'正在收线');
 assert.equal(reelControlCaption({ready:true}),'上提抬竿');
 assert.equal(reelControlCaption({danger:true}),'松手让线');
 assert.equal(reelControlCaption({paying:true}),'下压让线');
 assert.equal(reelControlCaption({lifted:true}),'滑回收线');
});

test('unavailable WebGL leaves the SVG material visible',()=>{
 const listeners=new Map(),classes=new Set();
 const button={parentElement:{hidden:false},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
 const canvas={isConnected:true,addEventListener:(name,handler)=>listeners.set(name,handler),getContext:()=>null};
 const surface=createReelSurface(canvas,button);
 assert.equal(surface.render(reelSurfaceState()),false);
 assert.equal(classes.has('shader-ready'),false);
 classes.add('shader-ready');
 let prevented=false;
 listeners.get('webglcontextlost')({preventDefault:()=>{prevented=true}});
 assert.equal(prevented,true);
 assert.equal(classes.has('shader-ready'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fishingSurfaceGeometry as geometry,fishingSurfaceReturn as spring} from '../src/reel-surface.mjs';
import {fishingSurfaceGeometry as draftGeometry} from '../docs/design/prototypes/fishing-control-v7/surface.mjs';
import {reelSurfaceSample as sample} from './helpers/reel-surface-runtime-sample.mjs';

test('runtime and approved draft share geometry across all directions and pressure states',()=>{
 for(const pressed of [0,.25,1])for(let angle=0;angle<360;angle+=15){
  const a=angle*Math.PI/180,input={dx:80*Math.cos(a),dy:80*Math.sin(a),pressed,risk:angle===90,guide:angle===270};
  assert.deepEqual(geometry(input),draftGeometry(input));
 }
});
test('actual view paints every axis continuously and does not move the input node',()=>{
 const s=sample();
 for(const [dx,dy] of [[-60,0],[60,0],[0,-60],[0,60],[-60,-60],[60,60]]){
  s.view.update({mode:'reel',dx,dy,pressed:true});
  assert.equal(s.nodes.face.attributes.d,geometry({dx,dy,pressed:1}).facePath);
  assert.equal(s.styles['--grip-depth'],'4px');assert.equal(s.frames(),0);
 }
 assert.ok(!s.root.style.transform);assert.equal(s.nodes.confirm.hidden,true);
});
test('unchanged fight frames do not recalculate/write static paths or start animation',()=>{
 const s=sample(),input={mode:'reel'};s.view.update(input);const writes=s.writes();
 for(let i=0;i<120;i++)s.view.update(input);
 assert.equal(s.writes(),writes);assert.equal(s.frames(),0);
 s.view.update({...input,result:true});assert.equal(s.nodes.confirm.hidden,false);assert.equal(s.writes(),writes);
});
test('release keeps connected geometry and current risk updates through the reverse swing',()=>{
 const s=sample();s.view.update({mode:'reel',dx:-60,pressed:true});s.view.release();
 s.tick(70);assert.ok(parseFloat(s.styles['--grip-x'])<0);s.view.update({mode:'reel',guide:true,risk:true,result:true});
 assert.equal(s.root.dataset.load,'danger');assert.equal(s.nodes.confirm.hidden,true);
 assert.equal(s.nodes.edge.attributes.stroke,'#ad634c');assert.equal(s.nodes['wall-tone'].attributes['stop-color'],'#bf7b61');
 s.tick(147);assert.ok(parseFloat(s.styles['--grip-x'])>0);assert.ok(parseFloat(s.styles['--grip-depth'])>=0);
 assert.equal(s.nodes.face.attributes.d,geometry({dx:-48*spring(.35),pressed:Math.pow(.65,3),risk:true}).facePath);
 s.tick(420);assert.equal(s.frames(),0);assert.equal(s.styles['--grip-x'],'0px');assert.equal(s.styles['--grip-depth'],'0px');
});
test('new hold, reset, cancelled release and mode change cannot retain a return frame',()=>{
 for(const stop of [s=>s.view.update({mode:'reel',pressed:true,dx:60}),s=>s.view.reset(),s=>s.view.release({cancelled:true}),s=>s.view.update({mode:'retrieve'})]){
  const s=sample();s.view.update({mode:'reel',pressed:true,dx:-60});s.view.release();s.tick(147);stop(s);
  assert.equal(s.frames(),0);const path=s.nodes.face.attributes.d;s.tick(500);assert.equal(s.nodes.face.attributes.d,path);
 }
});
test('reduced motion, including a live preference change, returns immediately without RAF',()=>{
 const s=sample();s.motion.matches=true;s.view.update({mode:'reel',dx:60,pressed:true});s.view.release();assert.equal(s.frames(),0);assert.equal(s.styles['--grip-depth'],'0px');
 const t=sample();t.view.update({mode:'reel',dy:60,pressed:true});t.view.release();t.tick(70);t.reduce();assert.equal(t.frames(),0);assert.equal(t.styles['--grip-y'],'0px');
});
test('nonfinite coordinates and unknown/hidden modes reset safely; destroy clears result and callbacks',()=>{
 const s=sample();s.view.update({mode:'reel',dx:NaN,dy:Infinity});assert.equal(s.styles['--grip-x'],'0px');assert.equal(s.styles['--grip-y'],'0px');
 s.view.update({mode:'reel',result:true,correction:'先收紧'});assert.equal(s.nodes.confirm.hidden,false);
 s.view.update({mode:'unknown',result:true});assert.equal(s.nodes.confirm.hidden,true);assert.equal(s.nodes.correction.hidden,true);
 s.view.destroy();assert.equal(s.frames(),0);
});
test('runtime initial geometry and relative hook are explicit and old panels are absent',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const control=html.slice(html.indexOf('<div id="fightControl"'),html.indexOf('<button id="landFish"'));
 for(const [name,path] of Object.entries({face:geometry().facePath,wall:geometry().wallPath,inner:geometry().innerPath,shadow:geometry().footPath,edge:geometry().edgePath}))assert.ok(control.includes('data-reel="'+name+'" d="'+path+'"'));
 assert.equal((control.match(/<button /g)||[]).length,1);assert.match(control,/width:124px;height:124px/);
 assert.doesNotMatch(control,/fightSpool|fightLever|fightTensionArc|fight-control-caption|fight-motion-guide|鱼线稳定/);
 assert.ok(html.indexOf('reel-surface.css')>html.indexOf('coastal-ui.css'));
 assert.equal(readFileSync(new URL('../public/assets/ui/fishing-hook.svg',import.meta.url),'utf8'),readFileSync(new URL('../docs/design/prototypes/fishing-control-v7/hook.svg',import.meta.url),'utf8'));
});

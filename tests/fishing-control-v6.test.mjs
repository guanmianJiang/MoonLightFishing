import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fishingSurfaceGeometry as geometry,fishingSurfaceReturn} from '../docs/design/prototypes/fishing-control-surface.mjs';
import {fishingControlSample as sample,fishingFragment as fragment} from './helpers/fishing-control-sample.mjs';

test('fragment uses the tested geometry and contains no detached base or directional arrows',()=>{
 const module=readFileSync(new URL('../docs/design/prototypes/fishing-control-surface.mjs',import.meta.url),'utf8');
 assert.ok(fragment.includes(module.replaceAll('export ','')));
 assert.doesNotMatch(fragment,/moon-grip-base|moon-grip-chevron|moon-grip-top|moon-grip-bottom|moon-grip-left|moon-grip-right|__SURFACE_SOURCE__|鱼线稳定|rod-cork|fetch\(/);
 const s=sample();assert.equal(s.frameCount(),0);assert.equal(s.nodes['.moon-grip-action'].textContent,'收线');
 assert.ok(s.nodes['.moon-grip-wall'].attributes.d.includes('C'));
});

test('rear attachment stays anchored; top and foot deform by related continuous weights',()=>{
 const idle=geometry(),drag=geometry({dx:100,pressed:1});
 assert.equal(drag.top[32].x,idle.top[32].x);assert.equal(drag.top[0].x-idle.top[0].x,12);
 assert.ok(Math.abs(drag.foot[0].x-idle.foot[0].x-1.8)<1e-10);
 assert.equal(drag.thickness,3);assert.equal(drag.foot[32].y-drag.top[32].y,3);
 for(let i=0;i<64;i++)assert.ok(drag.wallPath.includes('M'+Number(drag.top[i].x.toFixed(3))+' '+Number(drag.top[i].y.toFixed(3))));
 assert.equal((drag.wallPath.match(/ Z/g)||[]).length,64,'all perimeter patches stitched');
});

test('four directions and diagonal offsets have equal bounds and finite closed surfaces',()=>{
 for(let degrees=0;degrees<360;degrees+=15){
  const a=degrees*Math.PI/180,g=geometry({dx:100*Math.cos(a),dy:100*Math.sin(a),pressed:1});
  assert.ok(Math.abs(Math.hypot(g.offset.x,g.offset.y)-12)<1e-9);
  for(const p of [...g.top,...g.foot,...g.inset])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  assert.ok(g.facePath.endsWith(' Z'));assert.ok(g.innerPath.endsWith(' Z'));
  assert.ok(g.top.every(p=>p.x>=1&&p.x<=147&&p.y>=1&&p.y<=141));
  // Inspect the actual authored cubic boundary, including points between the shared vertices.
  const segments=[...g.facePath.matchAll(/C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g)].map(m=>m.slice(1).map(Number));
  const boundary=[];
  for(let i=0;i<64;i++){
   const previous=segments[(i+63)%64],c=segments[i],next=segments[(i+1)%64];
   const A={x:previous[4],y:previous[5]};
   assert.ok(Math.abs((c[4]-c[2])-(next[0]-c[4]))<.0021,'continuous horizontal tangent');
   assert.ok(Math.abs((c[5]-c[3])-(next[1]-c[5]))<.0021,'continuous vertical tangent');
   for(let j=0;j<4;j++){
    const t=j/4,u=1-t;
    boundary.push({x:u*u*u*A.x+3*u*u*t*c[0]+3*u*t*t*c[2]+t*t*t*c[4],y:u*u*u*A.y+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5]});
   }
  }
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const n=boundary.length;
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
   if(i===0&&j===n-1)continue;
   const A=boundary[i],B=boundary[(i+1)%n],C=boundary[j],D=boundary[(j+1)%n];
   assert.ok(!(cross(A,B,C)*cross(A,B,D)<0&&cross(C,D,A)*cross(C,D,B)<0),'non-crossing surface');
  }
 }
});

test('bad coordinates fall back, pressure clamps, edge is local and risk suppresses the opportunity direction',()=>{
 const idle=geometry(),bad=geometry({dx:NaN,dy:Infinity,pressed:NaN});assert.deepEqual(bad,idle);
 assert.equal(geometry({pressed:2}).thickness,3);assert.equal(geometry({pressed:-1}).thickness,7);
 assert.equal(idle.edgeVisible,false);assert.equal(geometry({guide:true}).edgeVisible,true);
 const danger=geometry({guide:true,risk:true});assert.ok(parseFloat(danger.edgePath.split(' ')[1])>70,'risk at lower edge');
 assert.equal((danger.edgePath.match(/ L/g)||[]).length,12,'one short segment, never full meter');
});

test('surface and correction geometry stay within narrow portrait and below the scene focus',()=>{
 const css=readFileSync(new URL('../docs/design/prototypes/fishing-control-v6.css',import.meta.url),'utf8');
 assert.match(css,/right:20px;bottom:28px;width:148px;height:148px/);
 for(const width of [288,320,390])for(let angle=0;angle<360;angle+=15){
  const h=width*16/9,x=width-168,y=h-176,g=geometry({dx:100*Math.cos(angle*Math.PI/180),dy:100*Math.sin(angle*Math.PI/180),pressed:1});
  for(const p of [...g.top,...g.foot])assert.ok(x+p.x>=8&&x+p.x<=width-8&&y+p.y>=8&&y+p.y<=h-8);
  assert.ok(y+16>h*.6,'core surface remains below upper scene focus');assert.ok(y-28>8);
 }
});

test('single-pointer hold renders pressure; second pointer cannot move or release it',()=>{
 const s=sample();s.down();assert.equal(s.control.styles['--grip-depth'],'4px');assert.equal(s.input.attributes['aria-pressed'],'true');
 const old=s.nodes['.moon-grip-face'].attributes.d;s.move(100,100,2);s.up('pointerup',2);assert.equal(s.nodes['.moon-grip-face'].attributes.d,old);
 for(const [dx,dy,aim] of [[-60,0,'left'],[60,0,'right'],[40,-40,'up-right'],[-40,40,'down-left']]){
  s.move(dx,dy);assert.equal(s.control.dataset.aim,aim);assert.equal(s.control.dataset.input,'side');assert.equal(s.nodes['.moon-grip-action'].textContent,'调竿');
 }
});

test('lift opportunity and original lane/threshold/hysteresis are preserved, no false acceptance',()=>{
 const s=sample();s.choose('window');s.down();s.move(0,-42);assert.equal(s.control.dataset.input,'hold');
 s.move(31,-60);assert.equal(s.control.dataset.input,'side');s.move(0,-43);assert.equal(s.control.dataset.result,'lift');
 s.move(0,-12);assert.equal(s.control.dataset.input,'hold');s.move(0,-60);assert.equal(s.control.dataset.result,'none');assert.equal(s.nodes['.moon-grip-correction'].textContent,'先稳住');
 s.choose('slack');s.down();s.move(0,-60);assert.equal(s.nodes['.moon-grip-action'].textContent,'收线');assert.equal(s.nodes['.moon-grip-correction'].textContent,'先收紧');
 s.choose('steady');s.down();s.move(0,23);assert.equal(s.control.dataset.input,'hold');s.move(0,24);assert.equal(s.control.dataset.input,'payout');
 s.move(0,11);assert.equal(s.control.dataset.input,'payout');s.move(0,10);assert.equal(s.control.dataset.input,'hold');
});

test('risk keeps its connected side tone, prevents success and stops repeating release after payout',()=>{
 const s=sample();s.choose('danger');s.down();assert.equal(s.nodes['.moon-grip-correction'].textContent,'松手');
 s.move(0,-60);assert.equal(s.control.dataset.result,'none');s.move(0,30);assert.equal(s.nodes['.moon-grip-correction'].hidden,true);
 s.up();assert.equal(s.control.dataset.tone,'danger');assert.equal(s.nodes['.moon-grip-wall-tone'].attributes['stop-color'],'#bf7b61');
});

test('bite continues on same pointer and object retrieval stays a tap',()=>{
 const s=sample();s.choose('bite');assert.equal(s.nodes['.moon-grip-action'].textContent,'提竿');s.down();assert.equal(s.control.dataset.result,'hooked');
 s.expire();assert.equal(s.control.dataset.input,'hold');assert.equal(s.control.dataset.result,'none');
 s.choose('retrieve');s.down();assert.equal(s.control.dataset.result,'retrieved');assert.equal(s.input.attributes['aria-pressed'],'false');assert.equal(s.frameCount(),0);
});

test('release returns all surfaces together and stops RAF; new touch immediately takes over',()=>{
 const s=sample();s.down();s.move(-60,0);s.up();assert.equal(s.input.attributes['aria-pressed'],'false');assert.equal(s.frameCount(),1);
 s.tick(0);s.tick(110);assert.ok(parseFloat(s.control.styles['--grip-x'])<0);s.tick(220);assert.equal(s.frameCount(),0);assert.equal(s.control.styles['--grip-depth'],'0px');
 s.down();s.move(60,0);s.up();s.tick(300);s.down();assert.equal(s.frameCount(),0);assert.equal(s.control.styles['--grip-x'],'0px');assert.equal(s.control.styles['--grip-depth'],'4px');
});

test('cancel, lost capture, blur and hidden page clean input, events and return animation',()=>{
 for(const cancel of [s=>s.up('pointercancel'),s=>s.up('lostpointercapture'),s=>s.window.emit('blur'),s=>{s.document.hidden=true;s.document.emit('visibilitychange');}]){
  const s=sample();s.choose('bite');s.down();cancel(s);assert.equal(s.frameCount(),0);assert.equal(s.control.styles['--grip-depth'],'0px');assert.equal(s.control.dataset.result,'none');
 }
 const s=sample();s.down();s.move(60,0);s.up();s.window.emit('blur');assert.equal(s.frameCount(),0);assert.equal(s.control.styles['--grip-x'],'0px');
});

test('damping is bounded and monotonic; reduced motion skips return RAF',()=>{
 let prev=1;for(let i=0;i<=100;i++){const w=fishingSurfaceReturn(i/100);assert.ok(w>=0&&w<=prev);prev=w;}assert.equal(prev,0);
 const s=sample({reduced:true});s.down();s.move(0,50);s.up();assert.equal(s.frameCount(),0);assert.equal(s.control.styles['--grip-depth'],'0px');
 const t=sample();t.down();t.move(50,0);t.up();t.motion.matches=true;t.motion.emit('change');assert.equal(t.frameCount(),0);
});

test('four-way playback is finite and manual input cancels it',()=>{
 const s=sample();s.play();s.tick(0);s.tick(1300);assert.equal(s.control.dataset.aim,'left');s.tick(2600);assert.equal(s.control.dataset.aim,'right');
 s.tick(3900);assert.equal(s.control.dataset.result,'lift');s.tick(5200);assert.equal(s.control.dataset.input,'payout');s.tick(6300);assert.equal(s.control.dataset.aim,'up-right');
 s.tick(7000);s.tick(7100);s.tick(7320);assert.equal(s.frameCount(),0);assert.equal(s.control.dataset.input,'idle');
 s.play();s.tick(0);s.tick(1300);s.down();assert.equal(s.control.dataset.input,'hold');assert.equal(s.frameCount(),0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {uiIcon} from '../src/ui/icons.mjs';

// Executes the design sample, not the production fight or physics.
const fragment=readFileSync(new URL('../docs/design/prototypes/fishing-control-v5.html',import.meta.url),'utf8');
const code=fragment.match(/<script>([\s\S]*?)<\/script>/)[1];
function sample(){
 const selectors=['#moon-grip-scene','#moon-grip-play','.moon-grip-control','.moon-grip-input','.moon-grip-correction','.moon-grip-reader','.moon-grip-action'];
 const node=()=>({textContent:'',value:'',dataset:{},attributes:{},styles:{},events:new Map(),setAttribute(k,v){this.attributes[k]=v;},setPointerCapture(){},addEventListener(k,fn){const list=this.events.get(k)||[];list.push(fn);this.events.set(k,list);},emit(k,args={}){for(const fn of this.events.get(k)||[])fn({preventDefault(){},...args});}});
 const nodes=Object.fromEntries(selectors.map(s=>[s,node()]));
 for(const el of Object.values(nodes))el.style={setProperty:(k,v)=>el.styles[k]=v};
 const root={querySelector:s=>nodes[s]},window=node(),document=node();document.getElementById=()=>root;
 let frame=null,timer=null;
 vm.runInNewContext(code,{document,window,setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){timer=null;},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame(){frame=null;}});
 const choose=value=>{nodes['#moon-grip-scene'].value=value;nodes['#moon-grip-scene'].emit('change');};
 const input=nodes['.moon-grip-input'],control=nodes['.moon-grip-control'],correction=nodes['.moon-grip-correction'];
 const down=(pointerId=1)=>input.emit('pointerdown',{pointerId,clientX:100,clientY:100});
 const move=(x,y,pointerId=1)=>input.emit('pointermove',{pointerId,clientX:x,clientY:y});
 const up=(type='pointerup',pointerId=1)=>input.emit(type,{pointerId});
 return{nodes,input,control,correction,choose,down,move,up,window,document,play:()=>nodes['#moon-grip-play'].emit('click'),tick:t=>{const f=frame;frame=null;f?.(t);},expire:()=>{const f=timer;timer=null;f?.();}};
}

test('main key shows one action, no status paragraph or gauge; only its cap moves',()=>{
 const s=sample();s.choose('steady');assert.equal(s.correction.hidden,true);
 assert.equal(s.control.dataset.input,'idle');s.down();
 assert.equal(s.control.dataset.input,'hold');assert.equal(s.control.styles['--grip-depth'],'5px');
 assert.equal(s.correction.hidden,true);assert.equal(s.input.attributes['aria-pressed'],'true');
 assert.equal(s.nodes['.moon-grip-action'].textContent,'收线');
 assert.doesNotMatch(fragment, /moon-grip-rail|moon-grip-load|鱼线稳定|正在<|按住<|rod-cork|rod-reel|<circle/);
 s.up();assert.equal(s.control.styles['--grip-depth'],'0px');assert.equal(s.control.dataset.input,'idle');
});

test('bite uses the same pointer for strike and hold; object uses a single confirmation',()=>{
 const s=sample();s.choose('bite');s.down();assert.equal(s.nodes['#moon-grip-scene'].value,'steady');
 assert.equal(s.control.dataset.result,'hooked');assert.equal(s.control.dataset.input,'hold');
 s.expire();assert.equal(s.control.dataset.result,'none');assert.equal(s.control.dataset.input,'hold');
 s.choose('retrieve');s.down();assert.equal(s.control.dataset.result,'retrieved');assert.equal(s.input.attributes['aria-pressed'],'false');
});

test('danger remains after release or payout and suppresses success and repeated commands',()=>{
 const s=sample();s.choose('danger');assert.equal(s.correction.hidden,true);s.down();
 assert.equal(s.correction.textContent,'松手');s.move(100,50);assert.equal(s.control.dataset.result,'none');
 s.move(100,130);assert.equal(s.control.dataset.input,'payout');assert.equal(s.correction.hidden,true);
 assert.equal(s.control.dataset.tone,'danger');s.up();assert.equal(s.correction.hidden,true);assert.equal(s.control.dataset.tone,'danger');
});

test('upward acceptance requires opportunity, threshold and lane; once per opportunity',()=>{
 const s=sample();s.choose('slack');s.down();s.move(100,50);
 assert.equal(s.correction.textContent,'先收紧');assert.equal(s.control.dataset.result,'none');
 s.choose('window');s.down();s.move(100,58);assert.equal(s.control.dataset.input,'hold');
 s.move(100,57);assert.equal(s.control.dataset.input,'lift');assert.equal(s.control.dataset.result,'lift');
 s.move(100,89);assert.equal(s.control.dataset.input,'hold');assert.equal(s.control.dataset.guide,'none');
 s.move(100,50);assert.equal(s.control.dataset.result,'none');assert.equal(s.correction.textContent,'先稳住');
 s.choose('window');s.down();s.move(131,40);assert.equal(s.control.dataset.input,'side');assert.equal(s.control.dataset.result,'none');
});

test('payout hysteresis, radial bounds and invalid coordinates do not alter the anchor',()=>{
 const s=sample();s.choose('steady');s.down();s.move(100,123);assert.equal(s.control.dataset.input,'hold');
 s.move(100,124);assert.equal(s.control.dataset.input,'payout');s.move(100,111);assert.equal(s.control.dataset.input,'payout');
 s.move(100,110);assert.equal(s.control.dataset.input,'hold');
 s.move(900,900);const x=parseFloat(s.control.styles['--grip-x']),y=parseFloat(s.control.styles['--grip-y']);
 assert.ok(Math.hypot(x,y)<=14.000001);assert.ok(Math.abs(x-y)<1e-8);
 const old=s.control.styles['--grip-x'];s.move(NaN,Infinity);assert.equal(s.control.styles['--grip-x'],old);
 assert.equal(s.input.styles.transform,undefined);assert.equal(s.control.styles.transform,undefined);
 s.up();assert.equal(s.control.styles['--grip-x'],'0px');assert.equal(s.control.styles['--grip-y'],'0px');
});

test('second pointer, cancel, blur and state changes clear input',()=>{
 const s=sample();s.down();s.move(100,140,2);assert.equal(s.control.dataset.input,'hold');
 s.up('pointercancel');assert.equal(s.input.attributes['aria-pressed'],'false');
 s.down();s.window.emit('blur');assert.equal(s.control.dataset.input,'idle');
 s.down();s.choose('steady');assert.equal(s.control.styles['--grip-y'],'0px');assert.equal(s.control.dataset.result,'none');
});

test('one-shot gesture preview uses the same states, ends cleanly and yields to manual input',()=>{
 const s=sample();s.play();s.tick(0);s.tick(1300);assert.equal(s.control.dataset.aim,'left');
 s.tick(2000);assert.equal(s.control.dataset.input,'hold');s.tick(2600);assert.equal(s.control.dataset.aim,'right');
 s.tick(3300);assert.equal(s.control.dataset.input,'hold');s.tick(3900);assert.equal(s.control.dataset.input,'lift');
 s.tick(4600);assert.equal(s.control.dataset.input,'hold');s.tick(5200);assert.equal(s.control.dataset.input,'payout');
 s.tick(5900);assert.equal(s.control.dataset.input,'hold');s.tick(6300);assert.equal(s.control.dataset.aim,'up-right');
 s.tick(7000);assert.equal(s.control.dataset.input,'idle');assert.equal(s.nodes['#moon-grip-play'].textContent,'播放四向');
 s.play();s.tick(0);s.tick(1300);s.down();assert.equal(s.control.dataset.input,'hold');
 s.tick(2800);assert.equal(s.control.dataset.input,'hold','cancelled preview cannot steal manual pointer');
 s.play();s.choose('danger');s.tick(5600);assert.equal(s.control.dataset.input,'idle');assert.equal(s.control.dataset.tone,'danger');
});

test('all four directions have equal reach and distinct corresponding feedback',()=>{
 const s=sample();s.choose('steady');s.down();
 for(const [dx,dy,aim] of [[-60,0,'left'],[60,0,'right'],[0,-60,'up'],[0,60,'down']]){
  s.choose('steady');s.down();s.move(100+dx,100+dy);
  assert.equal(s.control.dataset.aim,aim);
  assert.ok(Math.abs(Math.hypot(parseFloat(s.control.styles['--grip-x']),parseFloat(s.control.styles['--grip-y']))-14)<1e-8);
  if(aim==='left'||aim==='right'){
   assert.equal(s.control.dataset.input,'side');assert.equal(s.control.dataset.result,'none');
   assert.ok(s.input.attributes['aria-label'].includes('正在调竿'));
  }
 }
 s.choose('steady');s.down();s.move(87,100);assert.equal(s.control.dataset.aim,'left');assert.equal(s.control.dataset.input,'side');
 assert.ok(parseFloat(s.control.styles['--grip-tilt']) < 0);
 s.move(113,100);assert.equal(s.control.dataset.aim,'right');assert.ok(parseFloat(s.control.styles['--grip-tilt']) > 0);
 for(const direction of ['left','right','top','bottom'])assert.ok(fragment.includes('class="moon-grip-'+direction+'"'),'visible direction markup '+direction);
});

test('diagonal input stays continuous without bypassing the vertical gesture lane',()=>{
 const s=sample();s.choose('window');s.down();
 for(const [dx,dy,aim] of [[-40,-40,'up-left'],[40,-40,'up-right'],[40,40,'down-right'],[-40,40,'down-left']]){
  s.move(100+dx,100+dy);assert.equal(s.control.dataset.aim,aim);assert.equal(s.control.dataset.input,'side');
  assert.equal(s.control.dataset.result,'none');assert.ok(Math.hypot(parseFloat(s.control.styles['--grip-x']),parseFloat(s.control.styles['--grip-y']))<=14.000001);
 }
 s.move(107,100);assert.equal(s.control.dataset.aim,'none','deadzone does not invent a direction');
 s.move(108,100);assert.equal(s.control.dataset.aim,'right');
 s.up();assert.equal(s.control.dataset.aim,'none');assert.equal(s.control.styles['--grip-tilt'],'0deg');
});

test('authored CSS keeps the substantial key, touch area and directions inside portrait bounds',()=>{
 // Resolves the actual authored CSS numbers. This is a geometry check, not a browser screenshot.
 const css=fragment.match(/<style>([\s\S]*?)<\/style>/)[1];
 const rule=name=>{
  const body=css.match(new RegExp('^#moon-fishing-control-v5 \\.'+name+'\\{([^}]+)\\}','m'))?.[1];
  assert.ok(body,'missing geometry '+name);
  return Object.fromEntries([...body.matchAll(/(?:^|;)([\w-]+):([^;]+)/g)].map(([,k,v])=>[k,v]));
 };
 const props=rule('moon-grip-control'),head=rule('moon-grip-head'),input=rule('moon-grip-input'),base=rule('moon-grip-base');
 const n=(p,k)=>parseFloat(p[k]);const width=n(props,'width'),height=n(props,'height');
 const common=rule('moon-grip-top,#moon-fishing-control-v5 \\.moon-grip-bottom,#moon-fishing-control-v5 \\.moon-grip-left,#moon-fishing-control-v5 \\.moon-grip-right');
 const markers=['top','bottom','left','right'].map(id=>{const p=rule('moon-grip-'+id);return{x:n(p,'left'),y:p.top?n(p,'top'):height-n(p,'bottom')-n(common,'height'),w:n(common,'width'),h:n(common,'height')};});
 assert.ok(n(head,'width')>=112&&n(head,'height')>=100,'visible key has a full thumb contact surface');
 assert.ok(n(input,'width')>=n(head,'width')&&n(input,'height')>=n(head,'height'));
 for(const fieldWidth of [288,320,390]){
  const fieldHeight=fieldWidth*16/9,baseX=fieldWidth-n(props,'right')-width,baseY=fieldHeight-n(props,'bottom')-height;
  for(const rect of markers){assert.ok(baseX+rect.x>=8);assert.ok(baseX+rect.x+rect.w<=fieldWidth-8);assert.ok(baseY+rect.y>=8);assert.ok(baseY+rect.y+rect.h<=fieldHeight-8);}
  for(let degrees=0;degrees<360;degrees+=15){
   const s=sample();s.choose('steady');s.down();s.move(100+80*Math.cos(degrees*Math.PI/180),100+80*Math.sin(degrees*Math.PI/180));
   const dx=parseFloat(s.control.styles['--grip-x']),dy=parseFloat(s.control.styles['--grip-y'])+5;
   const x=baseX+n(input,'left')+n(head,'left')+dx,y=baseY+n(input,'top')+n(head,'top')+dy;
   assert.ok(x>=8&&x+n(head,'width')<=fieldWidth-8,'cap horizontal boundary');
   assert.ok(y>=8&&y+n(head,'height')<=fieldHeight-8,'cap vertical boundary');
   assert.ok(baseX+n(base,'left')>=8&&baseX+n(base,'left')+n(base,'width')<=fieldWidth-8);
   assert.ok(baseY+n(base,'top')+n(base,'height')<=fieldHeight-8);
   assert.ok(baseX+n(input,'left')>=8&&baseX+n(input,'left')+n(input,'width')<=fieldWidth-8);
   assert.ok(baseY+n(input,'top')+n(input,'height')<=fieldHeight-8);
  }
  const cue=rule('moon-grip-correction');assert.ok(baseX+n(cue,'left')>=8);assert.ok(baseX+width-n(cue,'right')<=fieldWidth-8);
 }
});

test('accepted actions change the single label; rejected gestures do not claim a lift',()=>{
 const s=sample(),label=s.nodes['.moon-grip-action'];
 s.choose('bite');assert.equal(label.textContent,'提竿');s.down();assert.equal(label.textContent,'收线');
 s.choose('window');s.down();s.move(100,50);assert.equal(label.textContent,'抬竿');
 s.move(100,100);assert.equal(label.textContent,'收线');s.move(100,130);assert.equal(label.textContent,'让线');
 s.move(100,100);assert.equal(label.textContent,'收线');s.move(150,100);assert.equal(label.textContent,'调竿');
 s.up();assert.equal(label.textContent,'收线');s.choose('slack');s.down();s.move(100,50);
 assert.equal(label.textContent,'收线');assert.equal(s.control.dataset.result,'none');
 s.choose('retrieve');assert.equal(label.textContent,'收回');
});

test('lost capture and hidden page release pressure and stop playback',()=>{
 const s=sample();s.down();s.up('lostpointercapture');assert.equal(s.control.styles['--grip-depth'],'0px');
 s.play();s.tick(0);s.window.emit('blur');s.tick(5200);
 assert.equal(s.control.dataset.input,'idle');assert.equal(s.control.styles['--grip-depth'],'0px');
 s.choose('bite');s.down();assert.equal(s.control.dataset.result,'hooked');
 s.document.hidden=true;s.document.emit('visibilitychange');
 assert.equal(s.control.dataset.result,'none');assert.equal(s.control.dataset.input,'idle');
 s.play();s.tick(0);s.document.emit('visibilitychange');s.tick(7000);
 assert.equal(s.control.dataset.input,'idle');assert.equal(s.nodes['#moon-grip-play'].textContent,'播放四向');
});

test('fishing symbol reuses the existing game icon and is a self-contained SVG image',()=>{
 const encoded=fragment.match(/class="moon-grip-symbol" src="data:image\/svg\+xml;base64,([^"]+)"/)[1];
 const svg=Buffer.from(encoded,'base64').toString('utf8');
 assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
 const expected=uiIcon('cast').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" style="color:#465b49" ');
 assert.equal(svg,expected,'reuse existing vector rather than introducing another fishing pictogram');
 assert.doesNotMatch(fragment,/__EXISTING_CAST_ICON__|fetch\(|XMLHttpRequest|WebSocket|https:\/\/cdn/);
});

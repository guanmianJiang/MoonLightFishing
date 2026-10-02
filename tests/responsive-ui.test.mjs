import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {responsiveUILayout,mountResponsiveUI} from '../src/ui/responsive-layout.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const rules=[];postcss.parse(read('src/responsive-ui.css')).walkRules(rule=>rules.push(rule));
const val=(rule,name)=>rule.nodes.find(node=>node.prop===name)?.value;

test('actual portrait sizes have bounded action width, gutters and short-screen details',()=>{
 for(const [w,h] of [[320,568],[360,640],[390,844],[430,932],[480,1000],[280,390]]){
  const l=responsiveUILayout(w,h);assert.ok(l.gutter>=8&&l.gutter<=16);assert.ok(l.actionWidth>=160&&l.actionWidth<=248);
  // Real footer usable width with cancel + gap. Flex is allowed to shrink the primary.
  assert.ok(w-2*l.gutter-80-12>=160);
  assert.ok(l.routeBodyMax>=40&&l.routeBodyMax<=160);
  assert.equal(l.heightMode,h<680?'short':'regular');assert.equal(l.widthMode,w<350?'narrow':'regular');
 }
 assert.ok(responsiveUILayout(320,568).routeBodyMax<responsiveUILayout(390,844).routeBodyMax);
 assert.deepEqual(responsiveUILayout(NaN,0),responsiveUILayout(320,568));assert.deepEqual(responsiveUILayout(-2,Infinity),responsiveUILayout(320,568));
});

function fixture(observer=true){
 let writes=0,callback,disconnected=false;
 const style=()=>({values:new Map(),setProperty(k,v){writes++;this.values.set(k,v);}});
 const events=()=>({handlers:new Map(),addEventListener(k,fn){this.handlers.set(k,fn);},removeEventListener(k,fn){if(this.handlers.get(k)===fn)this.handlers.delete(k);}});
 const root={style:style(),dataset:{}},rect={width:320,height:568},game={style:style(),dataset:{},ownerDocument:{documentElement:root},getBoundingClientRect:()=>rect};
 const viewport=Object.assign(events(),{height:568,offsetTop:0});
 const view=Object.assign(events(),{innerHeight:900,visualViewport:viewport});
 if(observer)view.ResizeObserver=class{constructor(fn){callback=fn;}observe(node){assert.equal(node,game);}disconnect(){disconnected=true;}};
 return {root,rect,game,view,viewport,get writes(){return writes;},get disconnected(){return disconnected;},resize:()=>callback()};
}

test('desktop window uses game frame width and observer updates without redundant writes',()=>{
 const f=fixture(),dispose=mountResponsiveUI(f.game,f.view);
 assert.equal(f.game.dataset.uiWidth,'narrow');assert.equal(f.root.style.values.get('--ui-frame-width'),'320px');
 const first=f.writes;f.resize();assert.equal(f.writes,first);
 f.rect.width=430;f.rect.height=932;f.resize();assert.equal(f.game.dataset.uiWidth,'regular');assert.equal(f.game.dataset.uiHeight,'regular');
 assert.equal(f.game.style.values.get('--ui-action-width'),'237px');
 dispose();assert.ok(f.disconnected);assert.equal(f.view.handlers.size,0);assert.equal(f.viewport.handlers.size,0);
});

test('keyboard viewport updates modal height and offset while keeping scene input sizing',()=>{
 const f=fixture(),dispose=mountResponsiveUI(f.game,f.view);const size=f.game.style.values.get('--ui-action-width');
 f.viewport.height=310;f.viewport.offsetTop=42;f.viewport.handlers.get('resize')();
 assert.equal(f.root.style.values.get('--ui-visible-height'),'310px');assert.equal(f.root.style.values.get('--ui-visible-top'),'42px');
 assert.equal(f.game.style.values.get('--ui-action-width'),size);assert.equal(f.game.dataset.uiHeight,'short');
 assert.equal(f.root.dataset.uiViewport,'short');
 f.viewport.offsetTop=80;f.viewport.handlers.get('scroll')();assert.equal(f.root.style.values.get('--ui-visible-top'),'80px');dispose();
});

test('missing observer and visual viewport fall back to window resize; invalid metrics stay finite',()=>{
 const f=fixture(false);delete f.view.visualViewport;f.rect.width=0;f.rect.height=NaN;
 const dispose=mountResponsiveUI(f.game,f.view);assert.equal(f.root.style.values.get('--ui-frame-width'),'320px');
 assert.equal(f.root.style.values.get('--ui-visible-height'),'900px');f.view.innerHeight=600;f.view.handlers.get('resize')();
 assert.equal(f.root.style.values.get('--ui-visible-height'),'600px');dispose();assert.equal(f.view.handlers.size,0);assert.doesNotThrow(()=>mountResponsiveUI(null,f.view)());
});

test('final responsive layer preserves core input size and replaces viewport-dependent action sizing',()=>{
 assert.ok(read('src/index.html').indexOf('responsive-ui.css')>read('src/index.html').indexOf('button-states.css'));
 assert.ok(read('src/app-final.js').includes("mountResponsiveUI($('#game'))"));
 const action=rules.find(rule=>rule.selector.includes('#cast:is'));
 assert.equal(val(action,'width'),'var(--ui-action-width)');assert.ok(!val(action,'width').includes('vw'));
 for(const rule of rules.filter(rule=>rule.selector.includes('#fightControl')))for(const prop of ['width','height','transform','scale','touch-action'])assert.equal(val(rule,prop),undefined);
 assert.ok(!rules.some(rule=>rule.selector.includes('#fightHold')));
 const footer=rules.find(rule=>rule.selector==='#game > footer');assert.equal(val(footer,'width'),'auto');assert.equal(val(footer,'overflow'),'auto');
 assert.ok(val(footer,'bottom').includes('--ui-bottom'));
 const bait=rules.find(rule=>rule.selector==='#game[data-ui-mode="prepare"] #baits .bait');assert.equal(val(bait,'min-width'),'44px');
 assert.equal(val(rules.find(rule=>rule.selector==='#game[data-ui-mode="prepare"] #baits'),'overflow-x'),'auto');
 const dialog=rules.find(rule=>rule.selector===':is(#result,#book,#tripEnd)');assert.ok(val(dialog,'width').includes('--ui-frame-width'));assert.ok(val(dialog,'max-height').includes('--ui-visible-height'));
 assert.ok(val(dialog,'max-height').includes('safe-area-inset-bottom'));
 const settings=rules.find(rule=>rule.selector==='#renderSettingsPanel');assert.ok(val(settings,'right').includes('--ui-frame-width'));
 assert.equal(val(rules.find(rule=>rule.selector==='#renderSettingsPanel .render-settings-fields'),'overflow'),'auto');
});

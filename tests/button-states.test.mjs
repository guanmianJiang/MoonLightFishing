import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=postcss.parse(read('src/button-states.css'));
const rules=[];css.walkRules(rule=>rules.push(rule));
const value=(rule,prop)=>rule.nodes.find(node=>node.type==='decl'&&node.prop===prop)?.value;
const guarded=rule=>{for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&parent.name==='media'&&/hover\s*:\s*hover/.test(parent.params)&&/pointer\s*:\s*fine/.test(parent.params))return true;return false;};

test('shared state layer loads last after the dedicated fishing input',()=>{
 const sheets=[...read('src/index.html').matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(sheets.at(-1),'responsive-ui.css');assert.ok(sheets.indexOf('reel-surface.css')<sheets.indexOf('button-states.css'));assert.ok(sheets.indexOf('button-states.css')<sheets.indexOf('responsive-ui.css'));
});

test('every existing hover rule is restricted to a precise hover pointer',()=>{
 for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(file=>file.endsWith('.css'))){
  postcss.parse(read('src/'+file)).walkRules(rule=>{if(rule.selector.includes(':hover'))assert.ok(guarded(rule),file+': '+rule.selector);});
 }
});

test('shared interactive rules exclude elastic input and keep minimum touch size',()=>{
 const base=rules.find(rule=>value(rule,'min-height')==='44px');
 assert.ok(base.selector.includes(':not(#fightHold)'));assert.equal(value(base,'min-width'),'44px');assert.equal(value(base,'touch-action'),'manipulation');
 for(const rule of rules.filter(rule=>rule.selector.includes('#fightHold')))assert.ok(rule.selector.includes(':not(#fightHold)'));
 assert.equal(value(base,'transform'),'var(--button-rest-transform)');
 const spot=rules.find(rule=>rule.selector==='#game #spots .spot'&&value(rule,'--button-rest-transform'));
 assert.equal(value(spot,'--button-rest-transform'),'translate(-50%,-100%)');
});

test('disabled state wins over active and hover without moving map anchors',()=>{
 const disabled=rules.find(rule=>rule.selector.includes(':is(:disabled,[aria-disabled="true"])'));
 const active=rules.find(rule=>rule.selector.includes(':not(#fightHold)')&&rule.selector.endsWith(':active'));
 assert.ok(rules.indexOf(disabled)>rules.indexOf(active));assert.equal(value(disabled,'translate'),'0 0');
 assert.equal(value(disabled,'transform'),'var(--button-rest-transform)');assert.ok(disabled.nodes.find(node=>node.prop==='translate').important);
 const hover=rules.find(rule=>rule.selector.includes(':not(#fightHold)')&&rule.selector.endsWith(':hover'));
 assert.ok(hover.selector.includes(':not(:disabled)'));assert.ok(hover.selector.includes(':not([aria-disabled="true"])'));
 assert.equal(value(active,'translate'),'0 3px');
});

test('selection, expansion and locked locations have distinct non-dark recipes',()=>{
 const selected=rules.find(rule=>rule.selector.includes('[aria-selected="true"]'));
 for(const state of ['[aria-pressed="true"]','[aria-expanded="true"]','.selected','.active','details[open]'])assert.ok(selected.selector.includes(state));
 assert.equal(value(selected,'--button-bottom'),'#a8c79c');
 assert.ok(rules.some(rule=>rule.selector==='#game #spots .spot.locked'&&value(rule,'--button-ink')));
 const primary=rules.find(rule=>rule.selector.includes('#sceneAction')&&value(rule,'--button-top'));
 assert.equal(value(primary,'--button-top'),'#f7dfb9');assert.ok(primary.selector.includes('.process-recommended'));
});

test('view toggle reports the actual existing close-view calculation',()=>{
 const source=read('src/app-final.js');
 const calc=source.match(/const closeView=([^;]+);/)[1];
 const sync=source.match(/\$\('#viewToggle'\)\.setAttribute\('aria-pressed',String\(closeView\)\);/)[0];
 for(const [pending,aiming,keepFishingView,overview,expected] of [[null,false,false,false,false],[{},false,false,false,true],[null,true,false,false,true],[{},false,false,true,false],[null,false,true,false,true]]){
  let actual;vm.runInNewContext('const closeView='+calc+';'+sync,{p:pending,aiming,keepFishingView,overview,$:()=>({setAttribute:(name,val)=>{assert.equal(name,'aria-pressed');actual=val;}})});
  assert.equal(actual,String(expected));
 }
 assert.ok(read('src/ui/journal.jsx').includes('aria-pressed={active() === id}'));
});

test('keyboard focus remains independent of hover and reduced motion removes movement',()=>{
 const focus=rules.find(rule=>rule.selector.endsWith(':focus-visible'));
 assert.ok(!guarded(focus));assert.equal(value(focus,'outline'),'2px solid #426f59');
 const reduced=rules.find(rule=>rule.parent.params==='(prefers-reduced-motion:reduce)');
 assert.equal(value(reduced,'transition'),'none');assert.equal(value(reduced,'translate'),'0 0');
});

test('hover, toggled and press give separate surface and depth feedback',()=>{
 const hovered=rules.find(rule=>rule.selector.includes(':not(#fightHold)')&&rule.selector.endsWith(':hover'));
 assert.equal(value(hovered,'translate'),'0 -2px');assert.ok(value(hovered,'background').includes('var(--button-hover-bottom)'));
 assert.equal(value(hovered,'border-color'),'var(--button-edge)');
 const selected=rules.find(rule=>rule.selector.includes('[aria-selected="true"]'));
 assert.notEqual(value(selected,'--button-hover-bottom'),value(selected,'--button-bottom'));
 assert.equal(value(selected,'border-color'),'#648861');assert.ok(value(selected,'box-shadow').includes('inset 0 -3px'));
 const pressed=rules.find(rule=>rule.selector.includes(':not(#fightHold)')&&rule.selector.endsWith(':active'));
 assert.ok(value(pressed,'background').includes('#3f4c3429'));assert.ok(value(pressed,'box-shadow').includes('0 1px 0'));
});

test('aim action shrinks on narrow screens and camera group children fit their frame',()=>{
 const action=rules.find(rule=>value(rule,'width')==='clamp(160px,55vw,248px)');
 assert.equal(value(action,'flex'),'0 1 auto');assert.equal(value(action,'min-height'),'64px');
 const cancel=rules.find(rule=>rule.selector==='#game[data-ui-mode="aim"] #cancelAim'&&value(rule,'width')==='80px');
 assert.equal(value(cancel,'min-height'),'56px');
 // At 280px usable width, cancel 80 + gap 12 leaves 188; primary can shrink.
 for(const available of [280,320,366,456])assert.ok(available-80-12>=160);
 const group=rules.find(rule=>rule.selector==='#game .camera-controls .zoom-group'&&value(rule,'width'));
 const child=rules.find(rule=>rule.selector==='#game .camera-controls .zoom-group button'&&value(rule,'width'));
 assert.equal(value(group,'box-sizing'),'border-box');assert.equal(value(group,'width'),'48px');assert.equal(value(child,'width'),'44px');
 assert.equal(value(child,'min-width'),'44px'); // 44 + padding 2 + border 2 = 48.
 const icon=rules.find(rule=>rule.selector==='#game #cast .ui-icon');
 assert.equal(value(icon,'width'),'30px');assert.equal(value(icon,'padding'),'0');assert.equal(value(icon,'background'),'none');
});

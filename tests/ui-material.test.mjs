import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const material=postcss.parse(read('src/ui-material.css')),states=postcss.parse(read('src/button-states.css'));
const rules=[];material.walkRules(rule=>rules.push(rule));
const val=(rule,prop)=>rule.nodes.find(node=>node.prop===prop)?.value;

test('material layer precedes core input, button states and final adaptation',()=>{
 const links=[...read('src/index.html').matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(links.indexOf('coastal-ui.css')<links.indexOf('ui-material.css'));
 assert.ok(links.indexOf('ui-material.css')<links.indexOf('reel-surface.css'));
 assert.ok(links.indexOf('ui-material.css')<links.indexOf('button-states.css'));assert.equal(links.at(-1),'responsive-ui.css');
});

test('material changes cannot scale input, move panels or fade their text',()=>{
 for(const rule of rules){
  assert.ok(!rule.selector.includes('#fightHold')&&!rule.selector.includes('#fightControl'));
  for(const prop of ['width','height','top','bottom','left','right','padding','margin','display','position','transform','opacity','pointer-events','touch-action','animation','transition'])assert.equal(val(rule,prop),undefined,rule.selector+': '+prop);
 }
});

test('blur is limited to small transient HUD with opaque fallback and motion reduction',()=>{
 const blurs=rules.filter(rule=>val(rule,'backdrop-filter')==='blur(6px)');
 assert.equal(blurs.length,1);assert.equal(blurs[0].selector,'#game :is(#aimCue,.toast)');assert.equal(blurs[0].parent.name,'supports');
 assert.ok(rules.some(rule=>rule.parent.name==='supports'&&rule.parent.params.startsWith('not ')&&val(rule,'--ui-hud-surface')));
 assert.ok(rules.some(rule=>rule.parent.params==='(prefers-reduced-motion:reduce)'&&val(rule,'backdrop-filter')==='none'));
 const reading=rules.find(rule=>rule.selector===':is(#result,#book,#tripEnd,#renderSettingsPanel)');assert.equal(val(reading,'backdrop-filter'),'none');
});

test('HUD and reading surfaces have separate opacity and paired edge shadows',()=>{
 const tokens=rules.find(rule=>rule.selector===':root');assert.notEqual(val(tokens,'--ui-hud-surface'),val(tokens,'--ui-read-surface'));
 assert.ok(val(tokens,'--ui-read-surface').includes('fa'));assert.ok(val(tokens,'--ui-surface-shadow').includes('inset 0 -1px'));
 for(const part of ['.route-card','.toolbar','.zoom-group','#aimCue','.toast','.fight-summary','#actionCue','#baitHint'])assert.ok(rules.some(rule=>rule.selector.includes(part)&&val(rule,'background')),part);
});

test('button light surface leaves disabled matte and retains selected and pressed feedback',()=>{
 const all=[];states.walkRules(rule=>all.push(rule));
 const base=all.find(rule=>val(rule,'min-height')==='44px');assert.ok(val(base,'background').includes('linear-gradient(115deg'));assert.ok(val(base,'box-shadow').includes('inset 0 -2px'));
 const disabled=all.find(rule=>rule.selector.includes(':is(:disabled,[aria-disabled="true"])'));assert.ok(!val(disabled,'background').includes('115deg'));assert.equal(val(disabled,'translate'),'0 0');
 const selected=all.find(rule=>rule.selector.includes('[aria-selected="true"]'));assert.equal(val(selected,'--button-bottom'),'#a8c79c');
 const active=all.find(rule=>rule.selector.includes(':not(#fightHold)')&&rule.selector.endsWith(':active'));assert.equal(val(active,'translate'),'0 3px');assert.ok(val(active,'background').includes('#3f4c3429'));
});

test('material roles separate information, tools and action dock instead of one green fill',()=>{
 const tokens=rules.find(rule=>rule.selector===':root');
 const faces=['--ui-hud-surface','--ui-dock-surface','--ui-tool-surface','--ui-read-surface'].map(name=>val(tokens,name));
 assert.equal(new Set(faces).size,4);assert.ok(faces.every(Boolean));
 assert.equal(val(rules.find(rule=>rule.selector==='#game .toolbar'),'background'),'var(--ui-dock-surface)');
 assert.equal(val(rules.find(rule=>rule.selector==='#game .camera-controls .zoom-group'),'background'),'var(--ui-tool-surface)');
 assert.equal(val(rules.find(rule=>rule.selector==='#result #resultChoiceIntro'),'background'),'none');
 assert.equal(val(rules.find(rule=>rule.selector==='#result #resultChoiceIntro::after'),'content'),'none');
 assert.equal(val(rules.find(rule=>rule.selector==='#result :is(.process-icon,.process-arrow)'),'box-shadow'),'none');
});

test('unselected bait loses its frame while selected, pressed and hover remain scoped separately',()=>{
 const all=[];states.walkRules(rule=>all.push(rule));
 const idle=all.find(rule=>rule.selector.includes('.bait:where('));
 assert.ok(idle.selector.includes(':not(.selected)'));assert.ok(idle.selector.includes(':not([aria-pressed="true"])'));
 assert.equal(val(idle,'background'),'none');assert.equal(val(idle,'box-shadow'),'none');
 // :where contributes zero specificity, so interactive state recipes can supersede idle.
 assert.ok(!idle.selector.includes(':hover'));
 assert.ok(all.some(rule=>rule.selector.includes('[aria-selected="true"]')&&val(rule,'--button-bottom')));
 assert.ok(all.some(rule=>rule.selector.endsWith(':active')&&val(rule,'translate')==='0 3px'));
 const primary=all.find(rule=>rule.selector.includes('#sceneAction')&&val(rule,'--button-depth'));
 assert.equal(val(primary,'--button-depth'),'5px');
});

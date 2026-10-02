import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {fishingUILayout} from '../src/ui/fishing-ui-state.mjs';

const css=readFileSync(new URL('../src/coastal-ui.css',import.meta.url),'utf8');
const rules=[];postcss.parse(css).walkRules(rule=>rules.push(rule));
const declares=(rule,prop,value)=>rule.nodes.some(node=>node.type==='decl'&&node.prop===prop&&node.value===value);

test('utility controls cannot be removed by watch or action-stage style rules',()=>{
 // Parse real CSS, including rules inside media queries. A span can hide; its button cannot.
 const hidesTools=rules.filter(rule=>declares(rule,'display','none')&&/(?:\.top-actions|\.hud-tools\s+:is\(#journal,#renderSettingsButton\)|#renderSettingsButton|#journal)\s*$/.test(rule.selector));
 assert.deepEqual(hidesTools.map(rule=>rule.selector),[]);
 const tools=rules.find(rule=>rule.selector==='#game .top-actions');
 assert.ok(declares(tools,'display','flex'));assert.ok(declares(tools,'pointer-events','auto'));assert.ok(declares(tools,'margin-left','auto'));
 for(const input of [{},{aiming:true},{phase:'waiting',pending:{}},{phase:'hooked',pending:{}},{phase:'fighting',pending:{fight:{status:'active'}}},{revealing:true},{phase:'result'}]){
  assert.ok(['prepare','aim','watch','strike','fight','landing','result'].includes(fishingUILayout(input).mode));
 }
});

test('waiting and hooked zoom controls remain available and narrow fighting tools avoid the status card',()=>{
 const hiddenZoom=rules.filter(rule=>declares(rule,'display','none')&&rule.selector.includes('.zoom-group')&&/watch|strike/.test(rule.selector));
 assert.deepEqual(hiddenZoom.map(rule=>rule.selector),[]);
 const narrow=rules.find(rule=>rule.selector==='#game.fighting > header .top-actions');
 assert.equal(narrow.parent.params,'(max-width: 350px)');assert.ok(declares(narrow,'top','132px'));assert.ok(declares(narrow,'right','0'));
 const targets=rules.find(rule=>rule.selector==='#game .hud-tools > button');assert.ok(declares(targets,'min-height','44px'));assert.ok(declares(targets,'min-width','44px'));
 // Preparation actions must still be absent during active fishing; this is only a tools fix.
 assert.ok(rules.some(rule=>rule.selector.includes('data-ui-mode="watch"')&&rule.selector.endsWith('> footer')&&declares(rule,'display','none')));
});

test('sky settings explain the empty panorama direction and keep their existing touch entry',()=>{
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
 assert.ok(panel.includes('当前方向没有云时，可调整水平旋转'));
 assert.ok(panel.includes("document.querySelector('#journal').before(button)"));
 assert.ok(panel.includes("button.setAttribute('aria-controls','renderSettingsPanel')"));
 assert.ok(panel.includes("select.setAttribute('aria-label','天空球')"));
 assert.ok(panel.includes("['skyRotation','水平旋转 (°)',0,360,1]"));
});

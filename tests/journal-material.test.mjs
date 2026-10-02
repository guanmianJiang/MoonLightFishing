import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
const css=readFileSync(new URL('../src/journal-experience.css',import.meta.url),'utf8');
const rules=[];postcss.parse(css).walkRules(rule=>rules.push(rule));
const all=selector=>rules.filter(rule=>rule.selector===selector);
const last=(selector,prop)=>all(selector).flatMap(rule=>rule.nodes.filter(node=>node.prop===prop)).at(-1)?.value;

test('shell, reading plane and navigation provide separate static depth',()=>{
 assert.notEqual(last('#book','background'),last('#book #bookContent','background'));
 assert.ok(last('#book','box-shadow').includes('0 4px 0'));
 assert.ok(last('#book #bookContent','box-shadow').startsWith('inset'));
 assert.ok(last('#book .journal-primary-tabs','box-shadow').includes('inset 0 2px'));
 assert.ok(last('#book #bookTabs .journal-primary-tabs button[aria-pressed="true"]','box-shadow').includes('0 2px 0'));
 assert.equal(last('#book #bookTabs .journal-primary-tabs button[aria-pressed="true"]','--button-hover-bottom'),'#e7dfbc');
});

test('known encounter cards are raised while unknown slots and statistics remain recessed',()=>{
 assert.ok(last('#book .atlas-card','box-shadow').includes('0 2px 0'));
 assert.ok(last('#book .atlas-unknown','box-shadow').startsWith('inset'));
 assert.ok(!last('#book .atlas-unknown','box-shadow').includes('0 2px 0'));
 assert.ok(last('#book .journal-achievements','box-shadow').startsWith('inset'));
 assert.equal(last('#book #bookContent .journal-achievements button','background'),'none');
 assert.equal(last('#book #bookContent .journal-achievements button','box-shadow'),'none');
 assert.equal(last('#book #bookContent .journal-primary','--button-depth'),'5px');
 assert.equal(last('#book .atlas-grid','grid-template-columns'),'repeat(2,minmax(0,1fr))');
});

test('image contact shadows cannot affect scene, core input or introduce ongoing effects',()=>{
 for(const rule of rules){
  assert.ok(rule.selector.startsWith('#book'));
  for(const prop of ['animation','backdrop-filter','-webkit-backdrop-filter','opacity'])assert.equal(last(rule.selector,prop),undefined);
  for(const decl of rule.nodes.filter(node=>node.prop==='filter')){assert.equal(rule.selector,'#book .atlas-visual img');assert.equal(decl.value,'drop-shadow(0 3px 2px #63735b40)');}
  if(rule.selector.includes(':hover')){assert.equal(rule.parent.name,'media');assert.ok(rule.parent.params.includes('pointer:fine'));assert.equal(last(rule.selector,'transform'),undefined);}
 }
 const focus=all('#book #bookContent .atlas-card > summary:focus-visible')[0];
 assert.ok(focus.nodes.some(node=>node.prop==='outline-offset'&&node.value==='-3px'));
 assert.equal(last('#book #bookTabs .journal-primary-tabs button','min-height'),'48px'); // Short-height compatibility override.
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,processHint,PROCESS_ACTIONS} from '../src/engine.mjs';
import {catchActionPlan} from '../src/catch-presentation.mjs';
import {catchChoiceMarkup,catchDecisionCopy} from '../src/ui/catch-choice-markup.mjs';
import {uiIcon} from '../src/ui/icons.mjs';
import {catchActionCue} from '../src/ui/action-guidance.mjs';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function setup(){
 const state=newSave(),nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},textContent:'',innerHTML:''});return nodes.get(id)};
 const context=vm.createContext({state,$,catchActionPlan,PROCESS_ACTIONS,processHint,catchChoiceMarkup,catchDecisionCopy,catchActionCue,uiIcon});
 vm.runInContext(source.slice(source.indexOf('function setResultActionsExpanded('),source.indexOf('function showResult(')),context);
 vm.runInContext(source.slice(source.indexOf("$('#moreCatchActions').onclick="),source.indexOf("$('#result').addEventListener('click'")),context);
 return {state,$,context};
}

test('ordinary repeat catch opens with one visible action and an accessible alternative control',()=>{
 const {$,context}=setup();
 context.renderResultChoices({id:'minnow'}, {id:'minnow'},3);
 assert.equal($('#result').dataset.expanded,'false');
 assert.equal($('#moreCatchActions').attributes['aria-expanded'],'false');
 assert.match($('#processActions').innerHTML,/data-process="study"/);
 assert.doesNotMatch($('#processActions').innerHTML,/data-process="release"/);
 assert.match($('#otherCatchActions').innerHTML,/data-process="release"/);
 $('#moreCatchActions').onclick();
 assert.equal($('#result').dataset.expanded,'true');
 assert.equal($('#moreCatchActions').attributes['aria-expanded'],'true');
});

test('first catch keeps one primary decision and starts its notes folded',()=>{
 const {$,context}=setup();
 context.renderResultChoices({id:'minnow'}, {id:'minnow'},1);
 assert.equal($('#result').dataset.expanded,'false');
 assert.equal($('#catchDetails').open,false);
 assert.equal($('#resultChoiceHelp').textContent,'完成 2 次记录 · 0 / 2');
 assert.equal($('#resultChoiceTitle').textContent,'这次记录，可以推进约定');
 assert.match($('#processActions').innerHTML,/process-icon/);
});

test('special and tracked catches retain every alternative without forcing them open',()=>{
 for(const [c,f] of [[{id:'minnow',tagId:'old-1'},{id:'minnow'}],[{id:'moon'},{id:'moon',special:true}]]){
  const {state,$,context}=setup();
  context.renderResultChoices(c,f,1);
  assert.equal($('#result').dataset.expanded,'false');
  const markup=$('#processActions').innerHTML+$('#otherCatchActions').innerHTML;
  for(const action of PROCESS_ACTIONS)assert.match(markup,new RegExp(`data-process="${action.id}"`));
  assert.equal(state.pending,null,'rendering a decision cannot create or process a catch');
 }
});

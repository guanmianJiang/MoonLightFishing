import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,processHint,PROCESS_ACTIONS} from '../src/engine.mjs';
import {catchActionPlan} from '../src/catch-presentation.mjs';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function setup(){
 const state=newSave(),nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},textContent:'',innerHTML:''});return nodes.get(id)};
 const context=vm.createContext({state,$,catchActionPlan,PROCESS_ACTIONS,processHint});
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

test('first catch displays all decisions immediately',()=>{
 const {$,context}=setup();
 context.renderResultChoices({id:'minnow'}, {id:'minnow'},1);
 assert.equal($('#result').dataset.expanded,'true');
 assert.match($('#resultChoiceHelp').textContent,/多看一眼/);
});

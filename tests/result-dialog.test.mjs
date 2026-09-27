import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,processCatch} from '../dist/engine.mjs';

const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function setup(castsLeft=4, caught=null){
 const state=newSave();state.trip.castsLeft=castsLeft;
 state.pending={phase:'result',catch:caught,spot:'reed'};
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{open:true,addEventListener(type,fn){this[type]=fn},close(){this.open=false}});return nodes.get(id)};
 let summaries=0;
 const context=vm.createContext({state,$,processCatch,aiming:false,overview:false,sound(){},save(){},viewer:null,renderSetup(){},update(){},showTripEnd(){summaries++}});
 vm.runInContext(source.slice(source.indexOf('function handleProcess('),source.indexOf("$('#nextTrip').onclick")),context);
 return {state,$,summaries:()=>summaries};
}
for(const route of ['confirm','close','escape'])test(`empty result settles and closes via ${route}`,()=>{
 const {state,$}=setup();
 if(route==='confirm')$('#processActions').click({target:{closest:()=>({dataset:{process:'study'}})}});
 if(route==='close')$('#closeEmptyResult').onclick();
 if(route==='escape')$('#result').cancel({preventDefault(){}});
 assert.equal($('#result').open,false);
 assert.equal(state.pending,null);
 assert.equal(state.trip.castsLeft,3);
 assert.equal(state.knowledge,0);
 $('#closeEmptyResult').onclick();
 assert.equal(state.trip.castsLeft,3);
});
test('closing the last empty result opens the trip summary',()=>{
 const {$,state,summaries}=setup(1);$('#closeEmptyResult').onclick();
 assert.equal(state.trip.castsLeft,0);assert.equal(summaries(),1);
});
test('Escape leaves a caught specimen awaiting an explicit choice',()=>{
 const {$,state}=setup(4,{id:'minnow'});let prevented=false;
 $('#result').cancel({preventDefault(){prevented=true}});
 assert.ok(prevented);assert.ok(state.pending);assert.equal(state.trip.castsLeft,4);assert.equal($('#result').open,true);
});

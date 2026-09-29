import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,processCatch,settleEmptyCast} from '../src/engine.mjs';
import {shouldStartLanding} from '../src/reel-transition.mjs';
import {isObjectCatch} from '../src/catch-kind.mjs';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function setup(castsLeft=4, caught=null){
 const state=newSave();state.trip.castsLeft=castsLeft;
 state.pending={phase:'result',catch:caught,spot:'reed',reaction:caught?null:'鱼口渐弱，鱼松口离开了。'};
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{open:id==='#result',textContent:'',addEventListener(type,fn){this[type]=fn},close(){this.open=false}});return nodes.get(id)};
 let summaries=0,resets=0;
 const context=vm.createContext({state,$,processCatch,settleEmptyCast,aiming:false,overview:false,keepFishingView:false,world:{reset(){resets++}},sound(){},save(){},viewer:null,renderSetup(){},update(){},showTripEnd(){summaries++}});
 vm.runInContext(source.slice(source.indexOf('function settleEmptyResult('),source.indexOf('function finishReel(')),context);
 vm.runInContext(source.slice(source.indexOf('function handleProcess('),source.indexOf("$('#nextTrip').onclick")),context);
 return {state,$,context,summaries:()=>summaries,resets:()=>resets};
}

test('empty result settles automatically into waterside ready view',()=>{
 const {state,$,context,resets}=setup();
 context.settleEmptyResult();
 assert.equal(state.pending,null);
 assert.equal(state.trip.castsLeft,3);
 assert.equal(state.knowledge,0);
 assert.equal(context.keepFishingView,true);
 assert.equal(resets(),1);
 assert.match($('#observation').textContent,/鱼口/);
 context.settleEmptyResult();
 assert.equal(state.trip.castsLeft,3);
});

test('last empty result opens the trip summary exactly once',()=>{
 const {state,context,summaries}=setup(1);
 context.settleEmptyResult();context.settleEmptyResult();
 assert.equal(state.trip.castsLeft,0);
 assert.equal(summaries(),1);
});

test('restoring an already processed empty result clears the stale pending state',()=>{
 const {state,context}=setup();
 state.pending.processed='study';state.trip.castsLeft=3;
 context.settleEmptyResult();
 assert.equal(state.pending,null);
 assert.equal(state.trip.castsLeft,3);
 assert.equal(context.keepFishingView,true);
});

test('caught specimen still requires an explicit decision and returns near water',()=>{
 const caught={id:'minnow',weight:.1,length:10,time:1000};
 const {state,$,context,resets}=setup(4,caught);let prevented=false;
 context.revealing=true;
 $('#result').cancel({preventDefault(){prevented=true}});
 assert.ok(prevented);assert.ok(state.pending);
 $('#processActions').click({target:{closest:()=>({dataset:{process:'study'}})}});
 assert.equal($('#result').open,false);
 assert.equal(state.pending,null);
 assert.equal(context.revealing,false);
 assert.equal(context.keepFishingView,true);
 assert.equal(resets(),1);
});

test('landed catch only starts its automatic lift before result settlement',()=>{
 const pending={phase:'cast',landedFromFight:true,catch:{id:'minnow'}};
 assert.equal(shouldStartLanding(pending,false),true);
 assert.equal(shouldStartLanding(pending,true),false);
 pending.phase='result';
 assert.equal(shouldStartLanding(pending,false),false);
 assert.equal(shouldStartLanding(null,false),false);
});

test('a landed catch cannot replay its lift or sound after the result opens',()=>{
 const pending={phase:'cast',landedFromFight:true,catch:{id:'minnow'}};
 const state={pending};const nodes=new Map();const timers=[];let resultCount=0,settleCount=0,vibrationCount=0,audioCount=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:''});return nodes.get(id)};
 const context=vm.createContext({state,$,revealing:false,revealStart:0,Date,isObjectCatch,ensureAudio:()=>Promise.resolve(),sound:()=>{audioCount++},navigator:{vibrate:()=>{vibrationCount++}},update(){},startReelLoop(){throw Error('landed catch must not start the reel loop')},stopReelLoop(){},setInterval(){throw Error('landed catch must not pulse the reel sound')},clearInterval(){},setTimeout(fn,ms){timers.push({fn,ms})},finishCast(){pending.phase='result';settleCount++},save(){},showResult(){resultCount++},renderSetup(){}});
 vm.runInContext(source.slice(source.indexOf('function finishReel('),source.indexOf('async function reel(')),context);
 context.finishReel();
 assert.equal(timers.length,1);
 assert.equal(timers[0].ms,3200);
 timers[0].fn();
 assert.equal(pending.phase,'result');
 assert.equal(context.revealing,true,'hold the 3D fish behind the open result');
 context.finishReel();
 assert.equal(timers.length,1);
 assert.equal(settleCount,1);
 assert.equal(resultCount,1);
 assert.equal(context.revealing,true);
 assert.equal(vibrationCount,0,'landing vibration occurs at the physics win, not during the later result animation');
 assert.equal(audioCount,0);
});

test('restoring an open catch result waits quietly for the player decision',()=>{
 const caught={id:'minnow',weight:.13,length:12.3,variation:'普通'};
 const state={pending:{phase:'result',catch:caught,spot:'reed',weather:{name:'晴'}},log:[caught]};
 const nodes=new Map();let audioCount=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{open:false,classList:{toggle(){}},style:{},textContent:'',innerHTML:'',showModal(){this.open=true}});return nodes.get(id)};
 const context=vm.createContext({state,$,FISH:[{id:'minnow',name:'银背鲫',desc:'测试鱼'}],SPOTS:[{id:'reed',name:'芦苇湾'}],CLUES:{},viewer:null,renderResultChoices(){},sound(){audioCount++}});
 vm.runInContext(source.slice(source.indexOf('function showResult('),source.indexOf('function showTripEnd(')),context);
 context.showResult(false);
 assert.equal($('#result').open,true);
 assert.equal(audioCount,0);
 context.showResult();
 assert.equal(audioCount,0);
 $('#result').open=false;
 context.showResult();
 assert.equal(audioCount,1);
});

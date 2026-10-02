import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,processCatch,settleEmptyCast} from '../src/engine.mjs';
import {shouldStartLanding} from '../src/reel-transition.mjs';
import {isObjectCatch} from '../src/catch-kind.mjs';
import {uiIcon} from '../src/ui/icons.mjs';
import {catchRevealPresentation} from '../src/ui/catch-reveal.mjs';
import {FISH} from '../src/data/catalog.mjs';
import {catchProcessFeedback} from '../src/catch-process-feedback.mjs';
import {createOutcomeDirector} from '../src/outcome-feedback.mjs';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function installOutcome(context){
 Object.assign(context,{outcomeDirector:createOutcomeDirector(),outcomeEvent:null,fightLoss:null,document:{hidden:false}});
 vm.runInContext(source.slice(source.indexOf('function presentOutcome('),source.indexOf("let tab='basket'")),context);
}
function setup(castsLeft=4, caught=null){
 const state=newSave();state.trip.castsLeft=castsLeft;
 state.pending={phase:'result',catch:caught,spot:'reed',reaction:caught?null:'鱼口渐弱，鱼松口离开了。'};
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{open:id==='#result',textContent:'',addEventListener(type,fn){this[type]=fn},close(){this.open=false}});return nodes.get(id)};
 let summaries=0,resets=0;const notices=[];
 const timers=[];const context=vm.createContext({state,$,FISH,processCatch,settleEmptyCast,catchProcessFeedback,catchProcessEvent:null,catchProcessTimer:null,lastRelease:null,outcomeEvent:null,Date,setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},ensureAudio:()=>Promise.resolve(),aiming:false,overview:false,keepFishingView:false,world:{reset(){resets++}},sound(){},toast(...args){notices.push(args)},save(){},viewer:null,renderSetup(){},update(){},showTripEnd(){summaries++}});
 vm.runInContext(source.slice(source.indexOf('function settleEmptyResult('),source.indexOf('function finishReel(')),context);
 vm.runInContext(source.slice(source.indexOf('function finishCatchProcess('),source.indexOf("$('#nextTrip').onclick")),context);
 context.completeProcess=()=>timers.at(-1)?.fn();
 return {state,$,context,notices,timers,summaries:()=>summaries,resets:()=>resets};
}

test('a normal processed catch produces one notice and no duplicate central message',()=>{
 const {state,$,context,notices}=setup(4,{id:'minnow',weight:.1,length:10,time:1000});
 $('#story').textContent='old message';context.handleProcess('study');context.completeProcess();
 assert.equal(notices.length,1);assert.equal(notices[0][2],'reward');
 assert.equal($('#story').textContent,'');assert.equal($('#observation').textContent,notices[0][0]);
 assert.equal(state.pending,null);
 context.handleProcess('study');assert.equal(notices.length,1,'a repeat handler cannot repeat the reward notice');
});

test('tracked release has one tracking notice rather than a second generic result',()=>{
 const {state,$,context,notices}=setup(4,{id:'minnow',weight:.1,length:10,time:1000});
 context.handleProcess('release');context.completeProcess();
 assert.equal(notices.length,1);assert.match(notices[0][0],/追踪/);
 assert.equal($('#story').textContent,'');assert.equal(state.tracked.length,1);
});

test('an event result keeps one event notice and a rejected action keeps its pending catch',()=>{
 const {state,$,context,notices}=setup(4,{id:'perch',weight:.8,length:22,time:1000});
 state.trip.rule={id:'predator',name:'捕食鱼活跃',triggers:0};context.handleProcess('keep');context.completeProcess();
 assert.deepEqual(notices[0],['水域事件：捕食鱼活跃',false,'reward','水域有了变化']);
 assert.equal(notices.length,1);assert.equal($('#story').textContent,'');
 const blocked=setup(4,{id:'minnow',weight:.1,length:10,time:1000});
 blocked.state.collection=Array.from({length:20},()=>({id:'minnow'}));
 blocked.context.handleProcess('keep');
 assert.equal(blocked.notices.length,1);assert.match(blocked.notices[0][0],/满/);
 assert.ok(blocked.state.pending);assert.equal(blocked.$('#result').open,true);
});

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
 $('#processActions').click({target:{closest:()=>({dataset:{process:'study'}})}});context.completeProcess();
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
 const state={pending,log:[]};const nodes=new Map();const timers=[];let resultCount=0,settleCount=0,vibrationCount=0,audioCount=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:''});return nodes.get(id)};
 const context=vm.createContext({state,$,revealing:false,revealStart:0,Date,isObjectCatch,ensureAudio:()=>Promise.resolve(),sound:()=>{audioCount++},navigator:{vibrate:()=>{vibrationCount++}},update(){},startReelLoop(){throw Error('landed catch must not start the reel loop')},stopReelLoop(){},setInterval(){throw Error('landed catch must not pulse the reel sound')},clearInterval(){},setTimeout(fn,ms){timers.push({fn,ms})},finishCast(){pending.phase='result';settleCount++},save(){},showResult(){resultCount++},renderSetup(){}});
 context.reelSurface={reset(){}};context.reelConfirmUntil=0;context.reelCorrectionUntil=0;
 context.FISH=FISH;installOutcome(context);
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
 assert.equal(audioCount,1,'one arrival cue, with no duplicate on a repeated landing update');
});

test('restoring an open catch result waits quietly for the player decision',()=>{
 const caught={id:'minnow',weight:.13,length:12.3,variation:'普通'};
 const state={pending:{phase:'result',catch:caught,spot:'reed',weather:{name:'晴'}},log:[caught]};
 const nodes=new Map();let audioCount=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{open:false,dataset:{},classList:{toggle(){}},style:{},textContent:'',innerHTML:'',focus(){this.focused=true},showModal(){this.open=true}});return nodes.get(id)};
 const context=vm.createContext({state,$,uiIcon,catchRevealPresentation,FISH:[{id:'minnow',name:'银背鲫',desc:'测试鱼'}],SPOTS:[{id:'reed',name:'芦苇湾'}],CLUES:{},viewer:null,renderResultChoices(){},sound(){audioCount++}});
 installOutcome(context);
 vm.runInContext(source.slice(source.indexOf('function showResult('),source.indexOf('function showTripEnd(')),context);
 context.showResult(false);
 assert.equal($('#result').open,true);
 assert.equal($('#processActions [data-process]').focused,true);
 assert.equal(audioCount,0);
 assert.equal($('#result').dataset.reveal,'false','restoring the save cannot replay the reveal');
 assert.equal($('#catchGrade').hidden,true,'a catch without a report cannot invent a medal');
 assert.equal($('#resultTitle').textContent,'新朋友上岸');
 context.showResult();
 assert.equal(audioCount,0);
 assert.equal($('#result').dataset.reveal,'false');
 $('#result').open=false;
 context.showResult();
 assert.equal(audioCount,0,'a restored result is consumed silently and cannot replay its audio');
 assert.equal($('#result').dataset.reveal,'true','a real opening can play one short reveal');
 context.showResult();assert.equal(audioCount,0,'a repeated render cannot replay the catch sound');
});

 test('handling saves once immediately and postpones notices and final-trip review until the motion ends',()=>{
 const {state,context,notices,timers,summaries,resets,$}=setup(1,{id:'minnow',weight:.1,length:10,time:1000});
 let saves=0,starts=0;context.save=()=>saves++;context.world.beginCatchProcess=event=>{starts++;assert.equal(state.pending.catch.id,event.id)};
 context.handleProcess('release');assert.equal(state.pending,null);assert.equal(state.trip.castsLeft,0);assert.equal(saves,1);assert.equal(starts,1);
 assert.equal(notices.length,0);assert.equal(summaries(),0);assert.equal(resets(),0);assert.equal($('#result').open,false);assert.equal(timers[0].ms,1850);
 context.handleProcess('study');assert.equal(saves,1);assert.equal(timers.length,1);assert.equal(state.tracked.length,1);
 context.completeProcess();assert.equal(notices.length,1);assert.equal(summaries(),1);assert.equal(resets(),1);assert.equal(context.catchProcessEvent,null);
 context.completeProcess();assert.equal(notices.length,1);assert.equal(summaries(),1);
 });
 test('capacity rejection starts no handling motion or deferred completion',()=>{
 const {state,context,timers}=setup(1,{id:'minnow',weight:.1,length:10,time:1000});state.collection=Array.from({length:20},()=>({id:'minnow'}));
 context.handleProcess('keep');assert.equal(timers.length,0);assert.equal(context.catchProcessEvent,null);assert.equal(state.trip.castsLeft,1);
 });

test('backgrounding concludes the durable settlement and ignores the old completion timer',()=>{
 const {state,context,notices,summaries}=setup(1,{id:'minnow',weight:.1,length:10,time:1000});
 context.document={hidden:true,addEventListener(type,callback){this.callback=callback}};
 context.handleProcess('release');const start=source.indexOf("document.addEventListener('visibilitychange',()=>{if(document.hidden&&catchProcessEvent");
 assert.ok(start>=0,'the processing visibility handler must exist');
 vm.runInContext(source.slice(start,source.indexOf(');if(world)',start)+2),context);
 context.document.callback();assert.equal(context.catchProcessEvent,null);assert.equal(state.pending,null);assert.equal(summaries(),1);
 context.completeProcess();assert.equal(notices.length,1);assert.equal(summaries(),1);
});

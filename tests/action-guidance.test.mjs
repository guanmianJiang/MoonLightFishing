import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {catchActionCue, actionCuePresentation, createActionCueRenderer} from '../src/ui/action-guidance.mjs';
import {catchActionPlan} from '../src/catch-presentation.mjs';
import {newSave, BAITS} from '../src/engine.mjs';
import {GAME_RULES} from '../src/config/game-rules.mjs';

test('catch cue only claims goal progress for a matching live action', () => {
  const goal = {action: 'release', target: 2, progress: 1};
  const before = structuredClone(goal);
  assert.equal(catchActionCue('release', goal).followsGoal, true);
  assert.match(catchActionCue('release', goal).text, /推进约定/);
  assert.equal(catchActionCue('study', goal).followsGoal, false);
  assert.doesNotMatch(catchActionCue('study', goal).text, /约定/);
  assert.deepEqual(goal, before);
});

test('invalid and finished goals never advertise goal progress', () => {
  for (const goal of [null, {}, {action:'study', target:2, progress:2},
    {action:'study', target:2, progress:1, complete:true}, {action:'study', target:Infinity, progress:0},
    {action:'study', target:0, progress:0}, {action:'study', target:2, progress:NaN},
    {action:'study', target:2, progress:-1}]) assert.equal(catchActionCue('study',goal).followsGoal,false);
  assert.equal(catchActionCue('unknown').text, '记下这次相遇');
  for (const action of ['unknown','__proto__','toString']) {
    assert.deepEqual(catchActionCue(action,{action,target:2,progress:0}),{text:'记下这次相遇',followsGoal:false});
  }
});

test('actual capacity and object fallbacks do not pretend to advance the previous goal', () => {
  for (const kind of ['keep','basket','release']) {
    const save = newSave();
    save.trip.goal = {name:'测试约定',action:kind,target:2,progress:0};
    save.collection = Array.from({length:GAME_RULES.collectionLimit},()=>({id:'minnow'}));
    save.economy.basket = Array.from({length:GAME_RULES.basketLimit},()=>({id:'minnow'}));
    const action = catchActionPlan(save, {id:'bottle'}, {object:kind==='release'}, 1).recommended;
    assert.equal(action, 'study');
    assert.equal(catchActionCue(action, save.trip.goal).followsGoal, false);
  }
});

test('aim guidance follows adjusted and queued states before preparation feedback', () => {
  const feedback = {kind:'bait',name:'麦粒',key:1,expiresAt:100};
  const choose=actionCuePresentation({mode:'aim',feedback,now:20});
  assert.match(choose.text,/近水／中段／远水/);
  assert.equal(choose.target,'#castZones');
  const adjusted=actionCuePresentation({mode:'aim',aimAdjusted:true});
  assert.match(adjusted.text,/落点已选/);
  assert.equal(adjusted.target,'#cast');
  const queued = actionCuePresentation({mode:'aim',aimAdjusted:true,queued:true});
  assert.equal(queued.kind,'waiting');
  assert.doesNotMatch(queued.text,/点抛竿确认/);
});

test('context cues disappear in every occupied fishing mode', () => {
  for (const mode of ['watch','strike','fight','landing','result','unknown',undefined])
    assert.equal(actionCuePresentation({mode,opening:true,feedback:{kind:'bait',expiresAt:100},now:20}),null);
  assert.equal(actionCuePresentation(), null);
});

test('confirmation expires at its boundary and restores contextual guidance', () => {
  const feedback = {kind:'bait',name:'夜光虫',target:'#bait',key:2,expiresAt:2400};
  const before = structuredClone(feedback);
  assert.equal(actionCuePresentation({mode:'prepare',feedback,now:2399}).kind,'confirmed');
  assert.equal(actionCuePresentation({mode:'prepare',feedback,now:2400}),null);
  assert.equal(actionCuePresentation({mode:'prepare',feedback,now:2400,opening:true}).key,'prepare:first');
  assert.equal(actionCuePresentation({mode:'prepare',opening:true,trailReady:true}).key,'prepare:trail');
  assert.deepEqual(feedback,before);
  for (const expiresAt of [NaN,Infinity,undefined])
    assert.equal(actionCuePresentation({mode:'prepare',feedback:{...feedback,expiresAt},now:0}),null);
  assert.equal(actionCuePresentation({mode:'prepare',feedback,now:NaN}),null);
  assert.equal(actionCuePresentation({mode:'prepare',feedback,now:-1}),null);
});

test('spot and cancellation cues confirm the actual operation without requiring a click', () => {
  assert.match(actionCuePresentation({mode:'prepare',now:0,feedback:{kind:'spot',name:'栈桥外湾',key:1,expiresAt:10}}).text,/已选好栈桥外湾/);
  assert.match(actionCuePresentation({mode:'prepare',now:0,feedback:{kind:'cancel',key:2,expiresAt:10}}).text,/已取消选点/);
  assert.equal(actionCuePresentation({mode:'prepare',now:0,feedback:{kind:'unknown',expiresAt:10}}),null);
});

function rendererFixture(reduced=false) {
  const calls=[], cancelled=[];
  const node = (left=0,width=280) => ({hidden:false,dataset:{},textContent:'',
    style:{setProperty(key,value){this[key]=value}},getBoundingClientRect(){return {left,width}},
    animate(frames,options){const id=calls.length;calls.push({frames,options});return {cancel(){cancelled.push(id)}}}});
  const cue=node(100),text=node(),mark=node(),live=node(),baitHint=node(),target=node(305,60);
  let liveWrites=0;
  Object.defineProperty(live,'textContent',{get(){return this.value||''},set(value){liveWrites++;this.value=value}});
  const renderer=createActionCueRenderer({cue,text,mark,live,baitHint,findTarget:()=>target,reduced});
  return {renderer,cue,text,mark,live,baitHint,target,calls,cancelled,liveWrites:()=>liveWrites};
}

test('frame refreshes neither animate repeatedly nor re-announce the same feedback', () => {
  const f=rendererFixture();
  const cue={key:'feedback:1',text:'已换上蚯蚓',kind:'confirmed',target:'#bait',announce:true};
  assert.equal(f.renderer.render(cue),true);
  const liveWrites=f.liveWrites();
  for(let i=0;i<120;i++)assert.equal(f.renderer.render({...cue}),false);
  assert.equal(f.calls.length,2);
  assert.equal(f.liveWrites(),liveWrites);
  assert.equal(f.cue.style['--cue-anchor'],'235px');
  assert.equal(f.mark.textContent,'✓');assert.equal(f.baitHint.hidden,true);
  f.renderer.render(null);
  assert.equal(f.cue.hidden,true);assert.equal(f.baitHint.hidden,false);assert.equal(f.live.textContent,'');
  assert.deepEqual(f.cancelled,[0,1]);
});

test('reduced motion and queued states preserve text without animated encouragement', () => {
  const f=rendererFixture(true);
  f.renderer.render({key:'x',text:'落点已调整',kind:'next',target:'#cast',announce:true});
  assert.equal(f.calls.length,0);assert.equal(f.text.textContent,'落点已调整');
  const queued=rendererFixture();
  queued.renderer.render({key:'q',text:'正在准备抛竿…',kind:'waiting',target:'#cast',announce:true});
  assert.equal(queued.calls.length,0);
});

test('alignment uses the game-local cue and remeasures on resize', () => {
  const f=rendererFixture();const p={key:'x',text:'选落点',kind:'next',target:'#cast'};
  f.renderer.render(p);
  f.target.getBoundingClientRect=()=>({left:160,width:44});f.renderer.realign(p);
  assert.equal(f.cue.style['--cue-anchor'],'82px');
  f.target.getBoundingClientRect=()=>({left:-100,width:44});f.renderer.realign(p);
  assert.equal(f.cue.style['--cue-anchor'],'12px');
  assert.equal(f.calls.length,1,'resizing does not replay the guidance');
});

test('newer feedback replaces the old animation, and missing targets retain the cue', () => {
  const f=rendererFixture();
  f.renderer.render({key:'1',text:'已换上蚯蚓',kind:'confirmed',target:'#bait'});
  f.renderer.render({key:'2',text:'已取消选点',kind:'confirmed',target:'#cast'});
  assert.deepEqual(f.cancelled,[0,1]);assert.equal(f.text.textContent,'已取消选点');
  const missing=rendererFixture();
  const renderer=createActionCueRenderer({...missing,findTarget:()=>null,reduced:false});
  renderer.render({key:'3',text:'继续选点',kind:'next',target:'#gone'});
  assert.equal(missing.cue.hidden,false);
});

test('real bait selection gives local feedback once while pending and repeat taps are ignored', () => {
  const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
  const state=newSave(),feedback=[],saves=[];
  const context=vm.createContext({state,BAITS,catchProcessEvent:null,ensureAudio:()=>Promise.resolve(),sound(){},
    save(){saves.push(state.bait)},renderSetup(){},update(){},selectionNotice(...args){feedback.push(args)}});
  vm.runInContext(source.slice(source.indexOf('function selectBait('),source.indexOf('function followGuide(')),context);
  context.selectBait('worm');context.selectBait('worm');
  assert.equal(feedback.length,1);assert.match(feedback[0][2],/data-bait="worm"/);
  assert.deepEqual(saves,['worm']);
  state.pending={phase:'cast'};context.selectBait('glow');
  assert.equal(state.bait,'worm');assert.equal(feedback.length,1);
  state.pending=null;context.catchProcessEvent={action:'release'};context.selectBait('glow');
  assert.equal(state.bait,'worm');assert.equal(feedback.length,1);
});

test('a queued cast rejects subsequent water adjustment and retains the confirmed point', () => {
  const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
  const context=vm.createContext({aiming:true,castQueued:false,aimPoint:null,aimAdjusted:false});
  vm.runInContext(source.slice(source.indexOf('function setAimPoint('),source.indexOf('function startAimFromWater(')),context);
  const point={x:1,z:2};context.setAimPoint(point);
  assert.equal(context.aimAdjusted,true);assert.equal(context.aimPoint,point);
  context.castQueued=true;context.setAimPoint({x:9,z:9});
  assert.equal(context.aimPoint,point);
});

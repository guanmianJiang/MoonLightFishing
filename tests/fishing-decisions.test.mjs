import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,migrateSave,makeCast,chooseTactic,signalFor,finishCast,trackRelease,processHint,processCatch,startNextTrip,spotUnlocked,equipGear,goalForTrip,ruleForTrip,biteWindowForTrip} from '../src/engine.mjs';
import {phaseOf} from '../src/fishing-motion.js';
import {hookTiming} from '../src/fishing-rhythm.mjs';
import {createFight,stepFight} from '../src/reference-loop.mjs';

function sequence(values){let i=0;return()=>values[i++]??.5}
function resolveCast(state,action,index=0){state.pending=makeCast(state,1_000+index*100,sequence([.2,.4,.5,.5,.5]));finishCast(state);return processCatch(state,action)}

test('bridge casts expose a readable signal before the bite',()=>{
 const state=newSave();state.spot='bridge';state.bait='worm';state.casts=3;
 const cast=makeCast(state,1_000,sequence([.9,.25,.5,.5,.5,.5]));
 assert.ok(cast.signal?.observe);
 assert.ok(cast.decisionAt>cast.start&&cast.decisionAt<cast.readyAt);
 assert.equal(cast.readyAt-cast.decisionAt,4300);
 assert.equal(phaseOf(cast,cast.decisionAt),'reading');
});

test('every fishing location now enters the reading decision',()=>{
 for(const spot of ['reed','bridge','deep']){
  const state=newSave();state.spot=spot;state.casts=3;
  const cast=makeCast(state,1_000,sequence([.25,.5,.5,.5,.5]));
  assert.ok(cast.signal?.observe,spot);assert.equal(phaseOf(cast,cast.decisionAt),'reading',spot);
 }
});

test('a direct hook can leave the reading decision immediately',()=>{
 const state=newSave();state.spot='reed';state.pending=makeCast(state,1_000,sequence([.25,.5,.5,.5,.5]));
 assert.equal(phaseOf(state.pending,state.pending.decisionAt),'reading');
 state.pending.directHooked=true;
 assert.equal(phaseOf(state.pending,state.pending.decisionAt),state.pending.catch?'hooked':'empty');
});

test('three correct bite reads award one investigation point and build a streak',()=>{
 const state=newSave();const expected='wait';
 for(let i=0;i<3;i++){state.pending=makeCast(state,1_000+i*100,sequence([.9,.4,.5,.5,.5,.5]));state.pending.signal={id:'steady'};const note=chooseTactic(state,expected,state.pending.decisionAt+1);assert.equal(note.success,true)}
 assert.equal(state.skill.streak,3);assert.equal(state.skill.best,3);assert.equal(state.skill.awards,1);assert.equal(state.knowledge,1);
});

test('a wrong bite read resets the active streak but keeps the best record',()=>{
 const state=newSave();state.skill={streak:2,best:2,awards:0};state.pending=makeCast(state,1_000,sequence([.9,.4,.5,.5,.5,.5]));const expected=signalFor(state.pending.catch.id).tactic;const wrong=['wait','tease','shorten'].find(id=>id!==expected);const note=chooseTactic(state,wrong,state.pending.decisionAt+1,()=>.99);
 assert.equal(note.success,false);assert.equal(state.skill.streak,0);assert.equal(state.skill.best,2);assert.equal(state.skill.awards,0);
});

test('the matching tactic preserves the catch and records a learned reaction',()=>{
 const state=newSave();state.spot='bridge';state.casts=2;state.pending=makeCast(state,2_000,sequence([.9,.4,.5,.5,.5,.5]));
 const expected=signalFor(state.pending.catch.id).tactic,note=chooseTactic(state,expected,state.pending.decisionAt+1);
 assert.equal(note.success,true);assert.ok(state.pending.catch);assert.equal(state.observations.length,1);
 assert.equal(phaseOf(state.pending,state.pending.reactedAt+100),'responding');
 assert.equal(phaseOf(state.pending,state.pending.readyAt-1),'responding');
});

test('a mismatched tactic can scare the visitor away after the opening trips',()=>{
 const state=newSave();state.spot='bridge';state.trip.number=3;state.casts=8;state.pending=makeCast(state,3_000,sequence([.9,.4,.5,.5,.5,.5]));
 const expected=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==expected);
 const note=chooseTactic(state,wrong,state.pending.decisionAt+1,()=>.99);
 assert.equal(note.success,false);assert.equal(state.pending.catch,null);assert.match(note.text,/退|散|停|消失|离开/);
 assert.equal(phaseOf(state.pending,state.pending.reactedAt+100),'spooked');
 assert.equal(phaseOf(state.pending,state.pending.readyAt-1),'spooked');
});

test('early casts can forgive a wrong read without awarding a streak',()=>{
 const state=newSave();state.skill.streak=2;state.pending=makeCast(state,3_000,sequence([.9,.4,.5,.5,.5,.5]));
 const expected=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==expected),note=chooseTactic(state,wrong,state.pending.decisionAt+1,()=>.1);
 assert.equal(note.success,false);assert.equal(note.forgiven,true);assert.ok(state.pending.catch);assert.equal(state.pending.tacticSuccess,true);assert.equal(state.skill.streak,0);
 assert.equal(phaseOf(state.pending,state.pending.readyAt-1),'responding');
});

test('the opening trip keeps a fish on a wrong read so players can learn the full catch loop',()=>{
 const state=newSave();state.pending=makeCast(state,3_000,sequence([.9,.4,.5,.5,.5,.5]));
 const expected=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==expected);
 const note=chooseTactic(state,wrong,state.pending.decisionAt+1,()=>.99);
 assert.equal(note.success,false);assert.equal(note.forgiven,true);assert.ok(state.pending.catch);
 assert.equal(state.skill.streak,0);
});

test('the second trip keeps some forgiveness without guaranteeing every wrong read',()=>{
 const state=newSave();state.trip.number=2;
 for(const [roll,expected] of [[.5,true],[.9,false]]){
  state.pending=makeCast(state,3_000,sequence([.9,.4,.5,.5,.5,.5]));
  const correct=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==correct);
  assert.equal(chooseTactic(state,wrong,state.pending.decisionAt+1,()=>roll).forgiven,expected);
 }
});

test('the first two trips give more time to lift, including an ongoing older save',()=>{
 const state=newSave();assert.equal(makeCast(state,1_000,sequence([.2,.4,.5,.5,.5])).biteWindowMs,9500);
 state.trip.number=2;assert.equal(makeCast(state,1_000,sequence([.2,.4,.5,.5,.5])).biteWindowMs,8000);
 state.trip.number=3;state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));assert.equal(state.pending.biteWindowMs,6500);
 delete state.pending.biteWindowMs;assert.equal(migrateSave(state).pending.biteWindowMs,biteWindowForTrip(3));
});

test('a new player can finish the first water objective despite uncertain bite reads',()=>{
 const state=newSave();
 for(let i=0;i<4;i++){
  state.pending=makeCast(state,1_000+i*20_000,sequence([.2,.4,.5,.5,.5]));
  const correct=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==correct);
  chooseTactic(state,wrong,state.pending.decisionAt+1,()=>.99);
  assert.ok(state.pending.catch);
  assert.ok(hookTiming(state.pending.readyAt,state.pending.readyAt+8_000,state.pending.biteWindowMs).remaining>0);
  const fight=createFight(state.pending.catch);
  for(let frame=0;frame<1000&&fight.status==='active';frame++)stepFight(fight,true,.016);
  assert.equal(fight.status,'won');
  finishCast(state);processCatch(state,i<2?'study':'release');
 }
 assert.equal(state.trip.goal.complete,true);
 assert.equal(spotUnlocked(state,'bridge'),true);
});

test('the bridge can produce a fish heavy enough to trigger the standing pose',()=>{
 const state=newSave();state.spot='bridge';state.bait='worm';
 const cast=makeCast(state,1_000,sequence([.6,.8,.5,.5,.5]));
 assert.equal(cast.catch.id,'catfish');assert.ok(cast.catch.weight>=2.4);
});

test('the early forgiveness ends after the first eight completed casts',()=>{
 const state=newSave();state.trip.number=3;state.casts=8;state.pending=makeCast(state,3_000,sequence([.9,.4,.5,.5,.5,.5]));
 const expected=signalFor(state.pending.catch.id).tactic,wrong=['wait','tease','shorten'].find(id=>id!==expected),note=chooseTactic(state,wrong,state.pending.decisionAt+1,()=>0);
 assert.equal(note.forgiven,false);assert.equal(state.pending.catch,null);assert.equal(state.pending.tacticSuccess,false);
});

test('old saves migrate into the four-cast water cycle',()=>{
 const state=migrateSave({version:1,casts:8,log:[],clues:[],pending:null,spot:'reed',bait:'grain'});
 assert.equal(state.version,2);assert.equal(state.trip.castsLeft,4);assert.deepEqual(state.collection,[]);assert.deepEqual(state.tracked,[]);assert.equal(state.knowledge,0);
});

test('the first trip teaches recording with a two-record objective',()=>{
 const state=newSave();assert.equal(state.trip.goal.id,'study2');assert.equal(state.trip.rule.id,'shoal');assert.equal(state.trip.goal.progress,0);
 resolveCast(state,'study',0);resolveCast(state,'study',1);
 assert.equal(state.trip.goal.progress,2);assert.equal(state.trip.goal.complete,true);
});

test('a completed trip objective grants its reward exactly once',()=>{
 const state=newSave();resolveCast(state,'study',0);resolveCast(state,'study',1);resolveCast(state,'keep',2);const result=resolveCast(state,'keep',3);
 assert.equal(result.tripEnded,true);assert.equal(state.knowledge,3);assert.equal(state.trip.goal.rewarded,true);
 assert.ok(result.summary.some(line=>line.includes('本轮目标完成')));
 assert.equal(processCatch(state,'keep'),null);assert.equal(state.knowledge,3);
});

test('a missed trip objective gives no objective reward',()=>{
 const state=newSave();for(let i=0;i<4;i++)resolveCast(state,'keep',i);
 assert.equal(state.knowledge,0);assert.equal(state.trip.goal.complete,false);
 assert.ok(state.trip.changes.some(line=>line.includes('本轮目标未完成')));
});

test('the next trip rotates to the living-release objective',()=>{
 const state=newSave();for(let i=0;i<4;i++)resolveCast(state,'keep',i);
 assert.equal(startNextTrip(state),true);assert.equal(state.trip.goal.id,'release2');assert.deepEqual(state.trip.goal,goalForTrip(2));assert.deepEqual(state.trip.rule,ruleForTrip(2));
});

test('version two saves without an objective migrate safely',()=>{
 const state=newSave();delete state.trip.goal;delete state.trip.rule;delete state.tracked;delete state.skill;const migrated=migrateSave(state);
 assert.equal(migrated.trip.goal.id,'study2');assert.equal(migrated.trip.goal.progress,0);assert.equal(migrated.trip.rule.id,'shoal');assert.deepEqual(migrated.tracked,[]);assert.deepEqual(migrated.skill,{streak:0,best:0,awards:0});
});

test('releasing a living catch adds it to the three-slot tracking list',()=>{
 const state=newSave(),sample={id:'carp',weight:.5,spot:'reed'};const result=trackRelease(state,sample,'reed',10);
 assert.equal(result.tracked,true);assert.equal(result.upgraded,false);assert.equal(state.tracked.length,1);assert.equal(state.tracked[0].releases,1);
});

test('a tracked individual can return heavier on a later cast',()=>{
 const state=newSave();state.tracked=[{tagId:'tag-a',id:'carp',weight:.5,releases:1,spot:'reed',lastSeen:10}];
 const cast=makeCast(state,2_000,sequence([0,0,0,.5,.5]));
 assert.equal(cast.catch.tagId,'tag-a');assert.equal(cast.catch.returnCount,1);assert.ok(cast.catch.weight>.5);assert.match(cast.catch.variation,/已放流 1 次/);
});

test('releasing a returning individual upgrades its tracking level',()=>{
 const state=newSave();state.tracked=[{tagId:'tag-a',id:'carp',weight:.5,releases:1,spot:'reed',lastSeen:10}];state.pending={phase:'result',spot:'reed',catch:{id:'carp',tagId:'tag-a',returnCount:1,weight:.6,mutation:null}};
 const result=processCatch(state,'release');assert.equal(result.tracking,true);assert.equal(state.tracked[0].releases,2);assert.equal(state.tracked[0].weight,.6);assert.match(result.text,/已放流 2 次/);
});

test('recording a returning individual cashes out progress and ends tracking',()=>{
 const state=newSave();state.tracked=[{tagId:'tag-a',id:'carp',weight:.6,releases:2,spot:'reed',lastSeen:10}];state.pending={phase:'result',spot:'reed',catch:{id:'carp',tagId:'tag-a',returnCount:2,weight:.7,mutation:null}};
 assert.match(processHint(state,'study'),/调查进度 \+3/);const result=processCatch(state,'study');assert.equal(state.knowledge,3);assert.equal(state.tracked.length,0);assert.match(result.text,/追踪样本 \+2/);
});

test('processing hints expose the immediate tradeoff before choosing',()=>{
 const state=newSave(),sample={id:'carp',mutation:null};
 assert.match(processHint(state,'keep',sample),/后续同类减少/);assert.match(processHint(state,'release',sample),/大幅增加/);assert.match(processHint(state,'study',sample),/调查进度 \+1/);
});

test('keeping a living catch immediately lowers its future weight',()=>{
 const state=newSave();state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));const id=state.pending.catch.id,before=state.ecosystem[id];finishCast(state);const result=processCatch(state,'keep');
 assert.ok(state.ecosystem[id]<before);assert.match(result.text,/出现率.*下降/);
});

test('the bottom-water event rewards records of unusual catches',()=>{
 const state=newSave();state.trip.rule=ruleForTrip(2);state.pending={phase:'result',catch:{id:'bottle',mutation:'沉水物'}};
 assert.match(processHint(state,'study'),/调查进度 \+3/);const result=processCatch(state,'study');assert.equal(state.knowledge,3);assert.equal(result.eventTriggered,true);assert.equal(state.trip.rule.triggers,1);assert.match(result.text,/本轮事件 \+1/);
});

test('confirming an empty hook consumes a cast without adding progress',()=>{
 const state=newSave();state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));state.pending.catch=null;finishCast(state);
 const result=processCatch(state,'study');assert.equal(result.text,'本竿为空钩，没有获得样本。');assert.equal(state.knowledge,0);assert.equal(state.trip.goal.progress,0);assert.equal(state.trip.castsLeft,3);
});

test('study sacrifices the catch, grants knowledge, and consumes exactly one cast',()=>{
 const state=newSave();state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));state.pending.directHooked=true;finishCast(state);
 const result=processCatch(state,'study');
 assert.equal(result.action,'study');assert.equal(state.knowledge,1);assert.equal(state.trip.castsLeft,3);
 assert.equal(processCatch(state,'study'),null);
});

test('release changes the next water pool while keeping collection empty',()=>{
 const state=newSave();state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));const id=state.pending.catch.id,before=state.ecosystem[id]||1;finishCast(state);processCatch(state,'release');
 assert.ok(state.ecosystem[id]>before);assert.equal(state.collection.length,0);assert.equal(state.trip.rule.triggers,1);
});

test('four processed catches end a trip and next trip resets the budget',()=>{
 const state=newSave();let last;
 for(let i=0;i<4;i++){state.pending=makeCast(state,1_000+i*100,sequence([.2,.4,.5,.5,.5]));finishCast(state);last=processCatch(state,'study');}
 assert.equal(last.tripEnded,true);assert.equal(state.trip.castsLeft,0);assert.ok(state.trip.changes.length>=5);assert.equal(startNextTrip(state),true);assert.equal(state.trip.castsLeft,4);assert.equal(state.trip.number,2);
});

test('knowledge unlocks water and perception gear',()=>{
 const state=newSave();assert.equal(spotUnlocked(state,'bridge'),false);assert.equal(equipGear(state,'line','copper'),false);state.knowledge=5;assert.equal(spotUnlocked(state,'bridge'),true);assert.equal(equipGear(state,'line','copper'),true);assert.equal(state.gear.line,'copper');
});

test('a full collection rejects keep without consuming the result',()=>{
 const state=newSave();state.collection=Array.from({length:6},(_,i)=>({id:'carp',weight:.2,length:12,time:i}));state.pending=makeCast(state,1_000,sequence([.2,.4,.5,.5,.5]));finishCast(state);
 const blocked=processCatch(state,'keep');assert.ok(blocked.error);assert.equal(state.pending.processed,undefined);assert.equal(state.trip.castsLeft,4);
 const studied=processCatch(state,'study');assert.equal(studied.action,'study');assert.equal(state.trip.castsLeft,3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fishBehavior,fightReport,bestFightReport,migrateFightRecords} from '../src/fish-behavior.mjs';
import {createFight,stepFight,pumpOpportunity,pumpRod} from '../src/reference-loop.mjs';
import {fightGuidance} from '../src/fight-guidance.mjs';
import {newSave} from '../src/engine.mjs';

function simulate(id,weight,choose){
 const f=createFight({id,weight});
 const sequence=[];let previous=f.fishState;
 for(let i=0;i<6000&&f.status==='active';i++){
  const held=choose(f);
  stepFight(f,held,.016);
  if(f.fishState!==previous){sequence.push(f.fishState);previous=f.fishState}
 }
 return {f,sequence};
}
function practiced(f){
 if(f.fishState==='recover'&&f.stateAge>.15&&pumpOpportunity(f,false).ready)pumpRod(f,false);
 return f.fishState!=='run'&&f.fishState!=='anchor'&&f.load<.62;
}

test('known species have distinct readable behavior and unknown saves fall back safely',()=>{
 assert.equal(fishBehavior('perch').chainEvery,2);
 assert.ok(fishBehavior('minnow').windup<fishBehavior('carp').windup);
 assert.ok(fishBehavior('catfish').anchor>0);
 assert.equal(fishBehavior('unlisted').id,'standard');
 const old=createFight({weight:2});delete old.behaviorId;
 for(let i=0;i<100;i++)stepFight(old,true,.016);
 assert.ok(Number.isFinite(old.distance));
});

test('perch gives a second visible warning before its next run',()=>{
 const {sequence}=simulate('perch',2,()=>false);
 assert.deepEqual(sequence.slice(0,5),['windup','run','windup','run','recover']);
 const f=createFight({id:'perch',weight:2});
 for(let i=0;i<600&&!(f.fishState==='windup'&&f.runCount===1);i++)stepFight(f,false,.016);
 assert.equal(fightGuidance(f,false).step,'release');
 assert.equal(pumpOpportunity(f,false).ready,false);
});

test('catfish anchors on the bottom and blocks a premature lift',()=>{
 const f=createFight({id:'catfish',weight:5});
 for(let i=0;i<900&&f.fishState!=='anchor';i++)stepFight(f,false,.016);
 assert.equal(f.fishState,'anchor');
 assert.equal(pumpOpportunity(f,false).state,'anchor');
 assert.equal(pumpRod(f,false).ok,false);
 assert.match(fightGuidance(f,false).title,/贴底/);
});

test('species tactics change the result: waiting through runs and lifting on recovery can land a perch',()=>{
 const held=simulate('perch',2,()=>true).f;
 const managed=simulate('perch',2,practiced).f;
 assert.equal(held.status,'lost');
 assert.equal(managed.status,'won');
 assert.ok(managed.cleanRuns>=2);
 assert.ok(managed.goodPumps>=1);
 assert.ok(managed.elapsed<80);
});

test('heavy bottom fish and rare gold fish are possible without upgrades when their habits are read',()=>{
 for(const [id,weight] of [['catfish',5],['oldgold',10]]){
  const {f}=simulate(id,weight,practiced);
  assert.equal(f.status,'won',id);
  assert.ok(f.cleanRuns>0,id);
 }
});

test('fight report rewards counters and keeps the best record without fabricating old results',()=>{
 const great=fightReport({elapsed:19.84,runsSeen:5,cleanRuns:4,goodPumps:2});
 const rough=fightReport({elapsed:40,runsSeen:3,cleanRuns:0,goodPumps:0});
 assert.deepEqual(great,{grade:'S',cleanRuns:4,runsSeen:5,goodPumps:2,seconds:19.8});
 assert.equal(rough.grade,'C');
 assert.equal(bestFightReport([{id:'carp'},{id:'perch',fightReport:rough}],'carp'),null);
 assert.deepEqual(bestFightReport([{id:'perch',fightReport:rough},{id:'perch',fightReport:great}],'perch'),great);
 assert.equal(fightReport({runsSeen:-2,cleanRuns:99,goodPumps:-1,elapsed:-5}).grade,'C');
});

test('new saves start with empty mastery and old or malformed records are safe to read',()=>{
 assert.deepEqual(newSave().fightRecords,{});
 assert.deepEqual(migrateFightRecords(undefined),{});
 assert.deepEqual(migrateFightRecords({perch:{grade:'A',runsSeen:3,cleanRuns:99,goodPumps:2,seconds:Infinity},bell:{grade:'S'},fake:{grade:'S'}}),{perch:{grade:'A',runsSeen:3,cleanRuns:3,goodPumps:2,seconds:0}});
});
